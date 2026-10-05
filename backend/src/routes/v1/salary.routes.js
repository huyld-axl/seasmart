const pool = require('../../config/db')

const ADMIN_ROLES = ['admin', 'operator', 'accountant']

function adminAuth(fastify) {
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
    },
  }
}

function getDaysInMonth(salaryMonth) {
  const d = salaryMonth instanceof Date ? salaryMonth : new Date(salaryMonth)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function calcThanhToanVnd(row, deploymentSalary, daysInMonth, otherCostsTotal) {
  const nf = (v) => (v != null ? parseFloat(v) : 0)
  const workingDays = row.working_days != null ? parseInt(row.working_days) : null
  if (workingDays == null) return null

  let salaryBase
  if (row.salary_gross != null && row.exchange_rate != null) {
    salaryBase =
      (parseFloat(row.salary_gross) * parseFloat(row.exchange_rate) * workingDays) / daysInMonth
  } else if (deploymentSalary != null) {
    salaryBase = (parseFloat(deploymentSalary) * workingDays) / daysInMonth
  } else {
    return null
  }

  const thanhToan =
    salaryBase +
    nf(row.bonus_rejoin) +
    nf(row.bonus_other) -
    nf(row.advance_payment) -
    nf(row.doc_fee) -
    nf(row.flag_cert_fee) -
    nf(row.penalty_amount) -
    nf(row.total_deductions) -
    (otherCostsTotal || 0)
  return parseFloat(thanhToan.toFixed(2))
}

function calcDerived(data) {
  const gross = data.salary_gross != null ? parseFloat(data.salary_gross) : null
  const rate = data.commission_rate != null ? parseFloat(data.commission_rate) : null

  const commissionAmount =
    gross != null && rate != null ? parseFloat(((gross * rate) / 100).toFixed(2)) : null

  const deductions = [
    data.air_ticket,
    data.doc_fee,
    data.signoff_fee,
    data.foreign_labor_fee,
    data.export_cost,
    data.other_cost,
  ].reduce((sum, v) => (v != null ? sum + parseFloat(v) : sum), 0)

  const totalDeductions = deductions > 0 ? parseFloat(deductions.toFixed(2)) : null
  const salaryNet = gross != null ? parseFloat((gross - (totalDeductions || 0)).toFixed(2)) : null
  const exchangeRate = data.exchange_rate != null ? parseFloat(data.exchange_rate) : null
  const salaryNetVnd =
    salaryNet != null && exchangeRate != null
      ? parseFloat((salaryNet * exchangeRate).toFixed(2))
      : null

  return { commissionAmount, totalDeductions, salaryNet, salaryNetVnd }
}

const SALARY_SELECT = `
  SELECT ss.*,
    sd.commission_rate AS deployment_commission_rate,
    sd.contract_start_date, sd.contract_end_date,
    sd.vessel_name,
    sd.salary_currency,
    s.full_name AS seafarer_name, s.seafarer_code,
    r.name_vi AS rank_name
  FROM seafarer_salary ss
  JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
  JOIN seafarer s ON s.id = sd.seafarer_id
  LEFT JOIN \`rank\` r ON r.id = sd.rank_id
`

async function salaryRoutes(fastify) {
  const auth = adminAuth(fastify)

  // ──────────────────────────────────────────────
  // EXCHANGE RATE ENDPOINTS
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/exchange-rates?month=YYYY-MM
  fastify.get('/exchange-rates', { onRequest: [fastify.authenticate] }, async (request) => {
    const { month } = request.query
    let sql = 'SELECT * FROM monthly_exchange_rate ORDER BY rate_month DESC'
    const params = []
    if (month) {
      sql = 'SELECT * FROM monthly_exchange_rate WHERE rate_month = ? LIMIT 10'
      params.push(`${month}-01`)
    }
    const [rows] = await pool.query(sql, params)
    return { data: rows }
  })

  // POST /api/v1/salary/exchange-rates — upsert tỷ giá tháng
  fastify.post('/exchange-rates', auth, async (request, reply) => {
    const { month, from_currency = 'USD', to_currency = 'VND', rate } = request.body
    if (!month || !rate) {
      return reply.code(400).send({ error: 'month và rate là bắt buộc' })
    }
    const rateMonth = `${month}-01`
    await pool.query(
      `INSERT INTO monthly_exchange_rate (rate_month, from_currency, to_currency, rate)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_at = NOW()`,
      [rateMonth, from_currency, to_currency, parseFloat(rate)]
    )

    // Apply exchange_rate to all salary records of that month and recalculate salary_net_vnd
    const [salaries] = await pool.query(
      `SELECT id, salary_net FROM seafarer_salary
       WHERE salary_month = ? AND deleted_at IS NULL`,
      [rateMonth]
    )
    for (const s of salaries) {
      const netVnd =
        s.salary_net != null
          ? parseFloat((parseFloat(s.salary_net) * parseFloat(rate)).toFixed(2))
          : null
      await pool.query(
        'UPDATE seafarer_salary SET exchange_rate = ?, salary_net_vnd = ?, updated_at = NOW() WHERE id = ?',
        [parseFloat(rate), netVnd, s.id]
      )
    }

    const [[row]] = await pool.query(
      'SELECT * FROM monthly_exchange_rate WHERE rate_month = ? AND from_currency = ? AND to_currency = ?',
      [rateMonth, from_currency, to_currency]
    )
    return reply.code(201).send({ ...row, updated_salary_count: salaries.length })
  })

  // POST /api/v1/salary/revenue-exchange-rate — cập nhật tỷ giá doanh thu cho tất cả records tháng
  fastify.post('/revenue-exchange-rate', auth, async (request, reply) => {
    const { month, rate } = request.body
    if (!month || !rate) return reply.code(400).send({ error: 'month và rate là bắt buộc' })
    const rateMonth = `${month}-01`
    const [result] = await pool.query(
      'UPDATE seafarer_salary SET revenue_exchange_rate = ?, updated_at = NOW() WHERE salary_month = ? AND deleted_at IS NULL',
      [parseFloat(rate), rateMonth]
    )
    return reply.code(200).send({ updated_count: result.affectedRows })
  })

  // ──────────────────────────────────────────────
  // FINANCE OVERVIEW — thu chi tổng hợp
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/finance/overview?from=YYYY-MM&to=YYYY-MM
  fastify.get('/finance/overview', { onRequest: [fastify.authenticate] }, async (request) => {
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const from = request.query.from || defaultMonth
    const to = request.query.to || from

    const fromDate = `${from}-01`
    // Last day of to-month
    const toDate = new Date(`${to}-01`)
    toDate.setMonth(toDate.getMonth() + 1)
    toDate.setDate(0)
    const toDateStr = toDate.toISOString().slice(0, 10)

    // ── THU: tiền nhận từ đối tác (job_payment) ──────────────────
    const [revenueByPartner] = await pool.query(
      `SELECT
        p.id AS partner_id,
        p.company_name AS partner_name,
        SUM(jp.amount) AS total_revenue,
        COUNT(DISTINCT jp.job_id) AS job_count
       FROM job_payment jp
       JOIN \`job\` j ON j.id = jp.job_id
       JOIN partner p ON p.id = j.partner_id
       WHERE jp.paid_at BETWEEN ? AND ?
         AND jp.deleted_at IS NULL
       GROUP BY p.id, p.company_name
       ORDER BY total_revenue DESC`,
      [fromDate, toDateStr]
    )

    const [[revenueTotal]] = await pool.query(
      `SELECT COALESCE(SUM(jp.amount), 0) AS total
       FROM job_payment jp
       WHERE jp.paid_at BETWEEN ? AND ? AND jp.deleted_at IS NULL`,
      [fromDate, toDateStr]
    )

    // ── CHI: lương TV + hoa hồng (seafarer_salary) ───────────────
    const [salaryByMonth] = await pool.query(
      `SELECT
        DATE_FORMAT(ss.salary_month, '%Y-%m') AS month,
        COUNT(*) AS seafarer_count,
        COALESCE(SUM(ss.salary_gross), 0) AS total_gross,
        COALESCE(SUM(ss.commission_amount), 0) AS total_commission,
        COALESCE(SUM(ss.total_deductions), 0) AS total_deductions,
        COALESCE(SUM(ss.salary_net), 0) AS total_net_usd,
        COALESCE(SUM(ss.salary_net_vnd), 0) AS total_net_vnd
       FROM seafarer_salary ss
       WHERE ss.salary_month BETWEEN ? AND ? AND ss.deleted_at IS NULL
       GROUP BY DATE_FORMAT(ss.salary_month, '%Y-%m')
       ORDER BY month ASC`,
      [fromDate, toDateStr]
    )

    const [[salaryTotal]] = await pool.query(
      `SELECT
        COALESCE(SUM(salary_gross), 0) AS total_gross,
        COALESCE(SUM(commission_amount), 0) AS total_commission,
        COALESCE(SUM(total_deductions), 0) AS total_deductions,
        COALESCE(SUM(salary_net), 0) AS total_net,
        COALESCE(SUM(salary_net_vnd), 0) AS total_net_vnd,
        COUNT(*) AS record_count
       FROM seafarer_salary
       WHERE salary_month BETWEEN ? AND ? AND deleted_at IS NULL`,
      [fromDate, toDateStr]
    )

    const totalRevenue = parseFloat(revenueTotal.total)
    const totalSalaryNet = parseFloat(salaryTotal.total_net)
    const totalCommission = parseFloat(salaryTotal.total_commission)
    const totalExpense = totalSalaryNet + totalCommission
    const profit = totalRevenue - totalExpense

    // ── Chi tiết: TV đang có lương trong kỳ ──────────────────────
    const [salaryDetail] = await pool.query(
      `SELECT
        s.full_name AS seafarer_name, s.seafarer_code,
        r.name_vi AS rank_name,
        sd.vessel_name,
        COUNT(ss.id) AS months_count,
        COALESCE(SUM(ss.salary_gross), 0) AS total_gross,
        COALESCE(SUM(ss.salary_net), 0) AS total_net,
        COALESCE(SUM(ss.commission_amount), 0) AS total_commission
       FROM seafarer_salary ss
       JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
       JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       WHERE ss.salary_month BETWEEN ? AND ? AND ss.deleted_at IS NULL
       GROUP BY s.id, sd.id
       ORDER BY total_gross DESC`,
      [fromDate, toDateStr]
    )

    return {
      period: { from, to },
      summary: {
        total_revenue: totalRevenue,
        total_salary_net: totalSalaryNet,
        total_commission: totalCommission,
        total_expense: totalExpense,
        profit,
        profit_rate:
          totalRevenue > 0 ? parseFloat(((profit / totalRevenue) * 100).toFixed(2)) : null,
      },
      revenue_by_partner: revenueByPartner,
      salary_by_month: salaryByMonth,
      salary_detail: salaryDetail,
    }
  })

  // ──────────────────────────────────────────────
  // MONTH-FULL: tất cả TV onboard + salary record (null nếu chưa điền)
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/month-full?month=YYYY-MM&partner_id=
  fastify.get('/month-full', { onRequest: [fastify.authenticate] }, async (request) => {
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = request.query.month || defaultMonth
    const rateMonth = `${month}-01`
    const partnerId = request.query.partner_id ? parseInt(request.query.partner_id) : null

    const conditions = ['ss.salary_month = ?', 'ss.deleted_at IS NULL']
    const params = [rateMonth]
    if (partnerId) {
      conditions.push('j.partner_id = ?')
      params.push(partnerId)
    }

    const [rows] = await pool.query(
      `SELECT
        sd.id AS deployment_id,
        sd.commission_rate AS deployment_commission_rate,
        sd.salary AS deployment_salary,
        sd.salary_currency,
        sd.vessel_name,
        sd.status AS deployment_status,
        sd.job_id,
        j.amount AS job_amount,
        j.currency AS job_currency,
        j.partner_id,
        p.company_name AS partner_name,
        s.id AS seafarer_id,
        s.full_name AS seafarer_name,
        s.seafarer_code,
        r.name_vi AS rank_name,
        r.code AS rank_code,
        ss.id AS salary_id,
        ss.salary_gross,
        ss.contract_amount,
        ss.advance_payment,
        ss.bonus_rejoin,
        ss.bonus_other,
        ss.working_days,
        ss.commission_rate,
        ss.commission_amount,
        ss.air_ticket, ss.air_ticket_name,
        ss.doc_fee, ss.signoff_fee, ss.foreign_labor_fee,
        ss.flag_cert_fee,
        ss.export_cost, ss.other_cost, ss.other_cost_note,
        ss.penalty_amount,
        ss.visa_fee,
        ss.owner_bonus,
        ss.export_labor_fee,
        ss.immigration_fee,
        ss.transport_fee,
        ss.total_deductions,
        ss.salary_net,
        ss.exchange_rate,
        ss.salary_net_vnd,
        ss.is_paid,
        ss.paid_at,
        ss.notes AS salary_notes,
        COALESCE((SELECT SUM(amount) FROM salary_other_costs WHERE salary_id = ss.id), 0) AS other_costs_total
       FROM seafarer_salary ss
       JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
       JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN partner p ON p.id = j.partner_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.full_name`,
      params
    )

    // Tính stats tổng hợp
    let thuDuKien = 0
    let chiLuong = 0
    let hoaHong = 0

    for (const r of rows) {
      thuDuKien += parseFloat(r.salary_gross || 0)
      chiLuong += parseFloat(r.salary_net || 0)
      hoaHong += parseFloat(r.commission_amount || 0)
    }

    const profit = thuDuKien - hoaHong - chiLuong

    // Lấy tỷ giá tháng nếu có
    const [[mer]] = await pool.query(
      `SELECT rate FROM monthly_exchange_rate
       WHERE rate_month = ? AND from_currency = 'USD' AND to_currency = 'VND' LIMIT 1`,
      [rateMonth]
    )

    return {
      month,
      exchange_rate: mer?.rate ? parseFloat(mer.rate) : null,
      stats: {
        total_records: rows.length,
        thu_du_kien: parseFloat(thuDuKien.toFixed(2)),
        chi_luong: parseFloat(chiLuong.toFixed(2)),
        hoa_hong: parseFloat(hoaHong.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
      },
      data: rows,
    }
  })

  // ──────────────────────────────────────────────
  // UNPAID BY SEAFARER — thông báo tháng chưa trả
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/unpaid-by-seafarer?seafarer_id=X
  fastify.get(
    '/unpaid-by-seafarer',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const seafarerId = parseInt(request.query.seafarer_id)
      if (!seafarerId) return reply.code(400).send({ error: 'seafarer_id là bắt buộc' })

      const now = new Date()
      const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const [rows] = await pool.query(
        `SELECT ss.id, DATE_FORMAT(ss.salary_month, '%Y-%m') AS month,
         ss.salary_gross, ss.salary_net, ss.salary_net_vnd,
         sd.vessel_name, r.name_vi AS rank_name, r.code AS rank_code
       FROM seafarer_salary ss
       JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
       JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       WHERE sd.seafarer_id = ?
         AND ss.is_paid = 0
         AND ss.deleted_at IS NULL
         AND ss.salary_month < ?
       ORDER BY ss.salary_month ASC`,
        [seafarerId, currentMonthStart]
      )
      return { data: rows }
    }
  )

  // ──────────────────────────────────────────────
  // EXPORT REVENUE — Excel multi-month
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/export-revenue?from=YYYY-MM&to=YYYY-MM
  fastify.get('/export-revenue', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { from, to } = request.query
    if (!from || !to) return reply.code(400).send({ error: 'Cần from và to (YYYY-MM)' })

    const fromDate = `${from}-01`
    const toDate = `${to}-01`

    // Tab 1: bảng lương TV
    const [salaryRows] = await pool.query(
      `SELECT
        DATE_FORMAT(ss.salary_month, '%Y-%m') AS month,
        s.full_name AS seafarer_name,
        r.code AS rank_code, r.name_vi AS rank_name,
        sd.vessel_name,
        p.company_name AS partner_name,
        sd.salary_currency,
        sd.salary AS deployment_salary,
        ss.salary_gross,
        ss.working_days,
        ss.exchange_rate,
        ss.bonus_rejoin,
        ss.bonus_other,
        ss.advance_payment,
        ss.doc_fee,
        ss.flag_cert_fee,
        ss.penalty_amount,
        ss.total_deductions,
        COALESCE((SELECT SUM(amount) FROM salary_other_costs WHERE salary_id = ss.id), 0) AS other_costs_total,
        ss.notes
       FROM seafarer_salary ss
       JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
       JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN partner p ON p.id = j.partner_id
       WHERE ss.salary_month BETWEEN ? AND ?
         AND ss.deleted_at IS NULL
       ORDER BY ss.salary_month, s.full_name`,
      [fromDate, toDate]
    )

    // Tab 2: doanh thu từ chủ tàu
    const [revenueRows] = await pool.query(
      `SELECT
        DATE_FORMAT(vr.revenue_month, '%Y-%m') AS month,
        s.full_name AS seafarer_name,
        r.code AS rank_code, r.name_vi AS rank_name,
        sd.vessel_name,
        p.company_name AS partner_name,
        sd.salary_currency,
        sd.salary AS deployment_salary,
        j.amount AS job_amount,
        j.currency AS job_currency,
        vr.contract_amount,
        vr.revenue_exchange_rate,
        vr.visa_fee,
        vr.owner_bonus,
        vr.export_labor_fee,
        vr.immigration_fee,
        vr.transport_fee,
        vr.penalty_amount,
        vr.other_cost,
        vr.notes AS revenue_notes,
        ss.salary_gross,
        ss.working_days,
        ss.exchange_rate AS salary_exchange_rate,
        ss.salary_net_vnd
       FROM vessel_revenue vr
       JOIN seafarer_salary ss ON ss.id = vr.salary_id
       JOIN seafarer_deployment sd ON sd.id = vr.deployment_id
       JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN partner p ON p.id = j.partner_id
       WHERE vr.revenue_month BETWEEN ? AND ?
         AND vr.deleted_at IS NULL
       ORDER BY vr.revenue_month, s.full_name`,
      [fromDate, toDate]
    )

    const ExcelJS = require('exceljs')
    const n = (v) => (v != null ? parseFloat(v) : 0)
    const daysInMon = (m) => {
      const [y, mo] = m.split('-').map(Number)
      return new Date(y, mo, 0).getDate()
    }

    // ── Calc helpers (khớp FinancePage.jsx) ──
    const calcLuongVnd = (r, days) => {
      if (r.working_days == null) return null
      if (r.salary_currency === 'VND')
        return (parseFloat(r.salary_gross ?? r.deployment_salary ?? 0) * r.working_days) / days
      if (r.salary_gross == null || r.exchange_rate == null) return null
      return (parseFloat(r.salary_gross) * parseFloat(r.exchange_rate) * r.working_days) / days
    }
    // Tab 2: lương TV dùng salary_exchange_rate, ưu tiên salary_net_vnd
    const calcLuongTV = (r, days) => {
      if (r.salary_net_vnd != null) return parseFloat(r.salary_net_vnd)
      if (r.working_days == null) return null
      if (r.salary_currency === 'VND')
        return (parseFloat(r.salary_gross ?? r.deployment_salary ?? 0) * r.working_days) / days
      if (r.salary_gross == null || r.salary_exchange_rate == null) return null
      return (
        (parseFloat(r.salary_gross) * parseFloat(r.salary_exchange_rate) * r.working_days) / days
      )
    }
    const calcGiaTriHdVnd = (r) => {
      const hd = parseFloat(r.contract_amount ?? r.job_amount ?? 0)
      if (r.job_currency === 'VND' || r.salary_currency === 'VND') return hd
      const rate = r.revenue_exchange_rate ?? r.salary_exchange_rate
      if (rate == null) return null
      return hd * parseFloat(rate)
    }
    const calcTongThu = (r) => {
      const dthu = calcGiaTriHdVnd(r)
      if (dthu == null) return null
      return dthu + n(r.visa_fee) + n(r.owner_bonus)
    }
    const calcThanhToan2 = (r, days) => {
      const luong = calcLuongTV(r, days)
      if (luong == null) return null
      return (
        luong +
        n(r.export_labor_fee) +
        n(r.immigration_fee) +
        n(r.transport_fee) +
        n(r.penalty_amount) +
        n(r.other_cost)
      )
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Marineport'

    const blueFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
    const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FFED' } }
    const redFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2F0' } }
    const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } }
    const centerMiddle = { horizontal: 'center', vertical: 'middle', wrapText: true }

    // ── Sheet 1: Tổng hợp (dựa trên Tab 2) ──────────────────────────────
    const s1 = wb.addWorksheet('Tổng hợp')
    s1.mergeCells('A1:D1')
    const t1 = s1.getCell('A1')
    t1.value = `Báo cáo Tài chính ${from} - ${to}`
    t1.font = { bold: true, size: 13 }
    t1.alignment = { horizontal: 'center' }
    s1.addRow([])

    const hdr1 = s1.addRow(['Tháng', 'Tổng thu (VND)', 'Tổng chi (VND)', 'Lãi/Lỗ (VND)'])
    hdr1.font = { bold: true }
    hdr1.fill = blueFill
    ;[{ width: 12 }, { width: 22 }, { width: 22 }, { width: 20 }].forEach((c, i) => {
      s1.getColumn(i + 1).width = c.width
    })

    // group revenue by month
    const revByMonth = {}
    for (const r of revenueRows) {
      if (!revByMonth[r.month]) revByMonth[r.month] = []
      revByMonth[r.month].push(r)
    }
    let gThu = 0,
      gChi = 0
    for (const [month, mRows] of Object.entries(revByMonth)) {
      const days = daysInMon(month)
      let thu = 0,
        chi = 0
      for (const r of mRows) {
        const t = calcTongThu(r)
        const c = calcThanhToan2(r, days)
        if (t != null) thu += t
        if (c != null) chi += c
      }
      gThu += thu
      gChi += chi
      const laiLo = thu - chi
      const row = s1.addRow([month, Math.round(thu), Math.round(chi), Math.round(laiLo)])
      row.getCell(4).font = { color: { argb: laiLo >= 0 ? 'FF07BC0C' : 'FFE74C3C' } }
    }
    const gLaiLo = gThu - gChi
    const totRow1 = s1.addRow(['Tổng', Math.round(gThu), Math.round(gChi), Math.round(gLaiLo)])
    totRow1.font = { bold: true }
    totRow1.fill = yellowFill
    totRow1.getCell(4).font = { bold: true, color: { argb: gLaiLo >= 0 ? 'FF07BC0C' : 'FFE74C3C' } }
    ;[2, 3, 4].forEach((c) => {
      s1.getColumn(c).numFmt = '#,##0'
    })

    // ── Sheet 2: Tiền lương (Tab 1) ─────────────────────────────────────
    const s2 = wb.addWorksheet('Tiền lương')
    // Widths: STT,Tháng,TV,Chứcdanh,Tàu,Chủtàu, gross,days,rate,quyDoi,rejoin,other,tongThu, advance,doc,flag,penalty, thanhToan,notes
    ;[6, 10, 22, 14, 18, 22, 14, 10, 12, 18, 14, 14, 18, 14, 12, 16, 12, 20, 24].forEach((w, i) => {
      s2.getColumn(i + 1).width = w
    })

    // Row 1: group headers
    s2.mergeCells('A1:A2')
    s2.mergeCells('B1:B2')
    s2.mergeCells('C1:C2')
    s2.mergeCells('D1:D2')
    s2.mergeCells('E1:E2')
    s2.mergeCells('F1:F2') // Tháng lương
    s2.mergeCells('G1:M1') // Các khoản thu (7 cols)
    s2.mergeCells('N1:Q1') // Các khoản giảm trừ (4 cols)
    s2.mergeCells('R1:R2') // Thanh toán
    s2.mergeCells('S1:S2') // Ghi chú
    ;[
      ['A', 'STT'],
      ['B', 'Tháng lương'],
      ['C', 'Thuyền viên'],
      ['D', 'Chức danh'],
      ['E', 'Tàu'],
      ['F', 'Chủ tàu'],
      ['R', 'Thanh toán'],
      ['S', 'Ghi chú'],
    ].forEach(([c, v]) => {
      s2.getCell(`${c}1`).value = v
      s2.getCell(`${c}1`).fill = blueFill
      s2.getCell(`${c}1`).font = { bold: true }
      s2.getCell(`${c}1`).alignment = centerMiddle
    })
    s2.getCell('G1').value = 'Các khoản thu'
    s2.getCell('G1').fill = greenFill
    s2.getCell('G1').font = { bold: true, color: { argb: 'FF389E0D' } }
    s2.getCell('G1').alignment = centerMiddle
    s2.getCell('N1').value = 'Các khoản giảm trừ'
    s2.getCell('N1').fill = redFill
    s2.getCell('N1').font = { bold: true, color: { argb: 'FFCF1322' } }
    s2.getCell('N1').alignment = centerMiddle

    // Row 2: sub-headers
    ;[
      ['G', 'Lương HĐ (USD)'],
      ['H', 'Ngày công'],
      ['I', 'Tỷ giá'],
      ['J', 'Quy đổi VNĐ'],
      ['K', 'Thưởng Rejoin'],
      ['L', 'Thưởng khác'],
      ['M', 'Tổng thu'],
    ].forEach(([c, v]) => {
      s2.getCell(`${c}2`).value = v
      s2.getCell(`${c}2`).fill = greenFill
      s2.getCell(`${c}2`).font = { bold: true }
      s2.getCell(`${c}2`).alignment = centerMiddle
    })
    ;[
      ['N', 'Ứng lương'],
      ['O', 'Phí đổi CC'],
      ['P', 'Phí bằng cờ tàu'],
      ['Q', 'Phạt HĐ'],
    ].forEach(([c, v]) => {
      s2.getCell(`${c}2`).value = v
      s2.getCell(`${c}2`).fill = redFill
      s2.getCell(`${c}2`).font = { bold: true }
      s2.getCell(`${c}2`).alignment = centerMiddle
    })
    s2.getRow(1).height = 20
    s2.getRow(2).height = 32

    let stt1 = 0
    for (const r of salaryRows) {
      stt1++
      const days = daysInMon(r.month)
      const luong = calcLuongVnd(r, days)
      const tongThu = luong != null ? luong + n(r.bonus_rejoin) + n(r.bonus_other) : null
      const giamTru =
        n(r.advance_payment) +
        n(r.doc_fee) +
        n(r.flag_cert_fee) +
        n(r.penalty_amount) +
        n(r.total_deductions) +
        n(r.other_costs_total)
      const thanhToan = tongThu != null ? Math.round(tongThu - giamTru) : null
      const row = s2.addRow([
        stt1,
        r.month || '',
        r.seafarer_name,
        r.rank_code || r.rank_name,
        r.vessel_name || '',
        r.partner_name || '',
        r.salary_gross != null ? parseFloat(r.salary_gross) : null,
        r.working_days,
        r.exchange_rate != null ? parseFloat(r.exchange_rate) : null,
        luong != null ? Math.round(luong) : null,
        r.bonus_rejoin != null ? parseFloat(r.bonus_rejoin) : null,
        r.bonus_other != null ? parseFloat(r.bonus_other) : null,
        tongThu != null ? Math.round(tongThu) : null,
        r.advance_payment != null ? parseFloat(r.advance_payment) : null,
        r.doc_fee != null ? parseFloat(r.doc_fee) : null,
        r.flag_cert_fee != null ? parseFloat(r.flag_cert_fee) : null,
        r.penalty_amount != null ? parseFloat(r.penalty_amount) : null,
        thanhToan,
        r.notes || '',
      ])
      if (thanhToan != null)
        row.getCell(18).font = { color: { argb: thanhToan >= 0 ? 'FF389E0D' : 'FFCF1322' } }
    }
    // Tổng hàng cuối
    let sum1 = 0,
      hasAny1 = false
    for (const r of salaryRows) {
      const days = daysInMon(r.month)
      const luong = calcLuongVnd(r, days)
      if (luong == null) continue
      const tongThu = luong + n(r.bonus_rejoin) + n(r.bonus_other)
      const giamTru =
        n(r.advance_payment) +
        n(r.doc_fee) +
        n(r.flag_cert_fee) +
        n(r.penalty_amount) +
        n(r.total_deductions) +
        n(r.other_costs_total)
      sum1 += tongThu - giamTru
      hasAny1 = true
    }
    if (hasAny1) {
      const sr1 = s2.addRow([
        '',
        `Tổng (${salaryRows.length})`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        Math.round(sum1),
        '',
      ])
      sr1.font = { bold: true }
      sr1.fill = yellowFill
      sr1.getCell(18).font = { bold: true, color: { argb: sum1 >= 0 ? 'FF389E0D' : 'FFCF1322' } }
    }
    ;[10, 11, 12, 13, 14, 15, 16, 17, 18].forEach((c) => {
      s2.getColumn(c).numFmt = '#,##0'
    })
    s2.getColumn(7).numFmt = '#,##0.00'
    s2.getColumn(9).numFmt = '#,##0'

    // ── Sheet 3: Doanh thu (Tab 2) ───────────────────────────────────────
    const s3 = wb.addWorksheet('Doanh thu')
    // Widths: STT,Tháng,TV,Chứcdanh,Tàu,Chủtàu, dthuUSD,tyGia,quyDoi,visa,thuong, luongTV,xk,xnc,xe,phat,other,thanhToan, notes, tongThu, loiNhuan
    ;[6, 10, 22, 14, 18, 22, 14, 12, 18, 14, 14, 18, 12, 14, 14, 14, 14, 20, 24, 20, 20].forEach(
      (w, i) => {
        s3.getColumn(i + 1).width = w
      }
    )

    s3.mergeCells('A1:A2')
    s3.mergeCells('B1:B2')
    s3.mergeCells('C1:C2')
    s3.mergeCells('D1:D2')
    s3.mergeCells('E1:E2')
    s3.mergeCells('F1:F2') // Tháng doanh thu
    s3.mergeCells('G1:K1') // Các khoản thu từ chủ tàu (5 cols)
    s3.mergeCells('L1:R1') // Các khoản giảm trừ (7 cols)
    s3.mergeCells('S1:S2') // Ghi chú
    s3.mergeCells('T1:T2') // Tổng thu
    s3.mergeCells('U1:U2') // Lợi nhuận
    ;[
      ['A', 'STT'],
      ['B', 'Tháng doanh thu'],
      ['C', 'Thuyền viên'],
      ['D', 'Chức danh'],
      ['E', 'Tên tàu'],
      ['F', 'Chủ tàu'],
      ['S', 'Ghi chú'],
    ].forEach(([c, v]) => {
      s3.getCell(`${c}1`).value = v
      s3.getCell(`${c}1`).fill = blueFill
      s3.getCell(`${c}1`).font = { bold: true }
      s3.getCell(`${c}1`).alignment = centerMiddle
    })
    s3.getCell('G1').value = 'Các khoản thu từ chủ tàu'
    s3.getCell('G1').fill = greenFill
    s3.getCell('G1').font = { bold: true, color: { argb: 'FF389E0D' } }
    s3.getCell('G1').alignment = centerMiddle
    s3.getCell('L1').value = 'Các khoản giảm trừ'
    s3.getCell('L1').fill = redFill
    s3.getCell('L1').font = { bold: true, color: { argb: 'FFCF1322' } }
    s3.getCell('L1').alignment = centerMiddle
    s3.getCell('T1').value = 'Tổng thu'
    s3.getCell('T1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4FF' } }
    s3.getCell('T1').font = { bold: true, color: { argb: 'FF0958D9' } }
    s3.getCell('T1').alignment = centerMiddle
    s3.getCell('U1').value = 'Lợi nhuận'
    s3.getCell('U1').fill = greenFill
    s3.getCell('U1').font = { bold: true }
    s3.getCell('U1').alignment = centerMiddle
    ;[
      ['G', 'Doanh thu (USD)'],
      ['H', 'Tỷ giá'],
      ['I', 'Quy đổi VND'],
      ['J', 'Phí làm visa'],
      ['K', 'Thưởng'],
    ].forEach(([c, v]) => {
      s3.getCell(`${c}2`).value = v
      s3.getCell(`${c}2`).fill = greenFill
      s3.getCell(`${c}2`).font = { bold: true }
      s3.getCell(`${c}2`).alignment = centerMiddle
    })
    ;[
      ['L', 'Lương TV'],
      ['M', 'Phí XK'],
      ['N', 'Phí cục XNC'],
      ['O', 'Phí xe đưa đón'],
      ['P', 'Phí phạt HĐ'],
      ['Q', 'Chi phí khác'],
      ['R', 'Thanh toán'],
    ].forEach(([c, v]) => {
      s3.getCell(`${c}2`).value = v
      s3.getCell(`${c}2`).fill = redFill
      s3.getCell(`${c}2`).font = { bold: true }
      s3.getCell(`${c}2`).alignment = centerMiddle
    })
    s3.getRow(1).height = 20
    s3.getRow(2).height = 32

    let stt2 = 0
    for (const r of revenueRows) {
      stt2++
      const days = daysInMon(r.month)
      const giaTriHd = calcGiaTriHdVnd(r)
      const tongThu = calcTongThu(r)
      const luongTV = calcLuongTV(r, days)
      const thanhToan2 = calcThanhToan2(r, days)
      const loiNhuan = tongThu != null && thanhToan2 != null ? tongThu - thanhToan2 : null
      const dthuUsd =
        r.contract_amount != null
          ? parseFloat(r.contract_amount)
          : r.job_amount != null
            ? parseFloat(r.job_amount)
            : null
      const tyGia =
        r.revenue_exchange_rate != null
          ? parseFloat(r.revenue_exchange_rate)
          : r.salary_exchange_rate != null
            ? parseFloat(r.salary_exchange_rate)
            : null
      const row = s3.addRow([
        stt2,
        r.month || '',
        r.seafarer_name,
        r.rank_code || r.rank_name,
        r.vessel_name || '',
        r.partner_name || '',
        dthuUsd,
        tyGia,
        giaTriHd != null ? Math.round(giaTriHd) : null,
        r.visa_fee != null ? parseFloat(r.visa_fee) : null,
        r.owner_bonus != null ? parseFloat(r.owner_bonus) : null,
        luongTV != null ? Math.round(luongTV) : null,
        r.export_labor_fee != null ? parseFloat(r.export_labor_fee) : null,
        r.immigration_fee != null ? parseFloat(r.immigration_fee) : null,
        r.transport_fee != null ? parseFloat(r.transport_fee) : null,
        r.penalty_amount != null ? parseFloat(r.penalty_amount) : null,
        r.other_cost != null ? parseFloat(r.other_cost) : null,
        thanhToan2 != null ? Math.round(thanhToan2) : null,
        r.revenue_notes || '',
        tongThu != null ? Math.round(tongThu) : null,
        loiNhuan != null ? Math.round(loiNhuan) : null,
      ])
      if (tongThu != null) row.getCell(20).font = { color: { argb: 'FF0958D9' } }
      if (loiNhuan != null)
        row.getCell(21).font = { color: { argb: loiNhuan >= 0 ? 'FF07BC0C' : 'FFE74C3C' } }
    }
    // Tổng hàng cuối
    let sum2Thu = 0,
      sum2Chi = 0
    for (const r of revenueRows) {
      const days = daysInMon(r.month)
      const t = calcTongThu(r)
      const c = calcThanhToan2(r, days)
      if (t != null) sum2Thu += t
      if (c != null) sum2Chi += c
    }
    const sum2LN = sum2Thu - sum2Chi
    const sr2 = s3.addRow([
      '',
      `Tổng (${revenueRows.length})`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Math.round(sum2Chi),
      '',
      Math.round(sum2Thu),
      Math.round(sum2LN),
    ])
    sr2.font = { bold: true }
    sr2.fill = yellowFill
    sr2.getCell(20).font = { bold: true, color: { argb: 'FF0958D9' } }
    sr2.getCell(21).font = { bold: true, color: { argb: sum2LN >= 0 ? 'FF07BC0C' : 'FFE74C3C' } }

    // numFmt: VND cols (I=9,J=10,K=11,L=12,M=13,N=14,O=15,P=16,Q=17,R=18,T=20,U=21), tỷ giá(H=8), USD(G=7)
    ;[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21].forEach((c) => {
      s3.getColumn(c).numFmt = '#,##0'
    })
    s3.getColumn(7).numFmt = '#,##0.00'
    s3.getColumn(8).numFmt = '#,##0'

    const buffer = await wb.xlsx.writeBuffer()
    reply.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    reply.header('Content-Disposition', `attachment; filename="doanh-thu-${from}-${to}.xlsx"`)
    return reply.send(buffer)
  })

  // ──────────────────────────────────────────────
  // SALARY STATS — dashboard widget
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/stats?month=YYYY-MM
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async (request) => {
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = request.query.month || defaultMonth
    const rateMonth = `${month}-01`

    const [[counts]] = await pool.query(
      `SELECT
        COUNT(DISTINCT sd.id) AS total_onboard,
        SUM(CASE WHEN ss.id IS NULL THEN 1 ELSE 0 END) AS missing_salary,
        SUM(CASE WHEN ss.is_paid = 1 THEN 1 ELSE 0 END) AS paid
       FROM seafarer_deployment sd
       LEFT JOIN seafarer_salary ss
         ON ss.deployment_id = sd.id AND ss.salary_month = ? AND ss.deleted_at IS NULL
       WHERE sd.status IN ('onboard','signed_off')`,
      [rateMonth]
    )

    // Đếm unpaid trực tiếp từ salary records của tháng (khớp với finance page)
    const [[{ unpaid }]] = await pool.query(
      `SELECT COUNT(*) AS unpaid FROM seafarer_salary
       WHERE salary_month = ? AND is_paid = 0 AND deleted_at IS NULL`,
      [rateMonth]
    )
    counts.unpaid = parseInt(unpaid) || 0

    // Dùng cùng formula với FinancePage: join job để lấy contract_amount/job_amount
    const daysInMonth = new Date(rateMonth.slice(0, 4), rateMonth.slice(5, 7), 0).getDate()
    const [[totals]] = await pool.query(
      `SELECT
        COALESCE(SUM(
          CASE
            WHEN sd.salary_currency = 'VND' OR j.currency = 'VND'
              THEN COALESCE(ss.contract_amount, j.amount, 0)
            WHEN ss.exchange_rate > 0
              THEN COALESCE(ss.contract_amount, j.amount, 0) * ss.exchange_rate
            ELSE 0 END
        ), 0) AS total_gross_vnd,
        COALESCE(SUM(
          CASE
            WHEN sd.salary_currency = 'VND' AND ss.working_days IS NOT NULL
              THEN COALESCE(ss.salary_gross, sd.salary, 0) * ss.working_days / ?
                   - COALESCE(ss.total_deductions, 0) + COALESCE(ss.advance_payment, 0)
            WHEN ss.exchange_rate > 0 AND ss.working_days IS NOT NULL AND ss.salary_gross IS NOT NULL
              THEN ss.salary_gross * ss.exchange_rate * ss.working_days / ?
                   - COALESCE(ss.total_deductions, 0) + COALESCE(ss.advance_payment, 0)
            ELSE 0 END
        ), 0) AS total_net_vnd,
        COALESCE(SUM(
          CASE
            WHEN (sd.salary_currency = 'VND' OR j.currency = 'VND') AND ss.commission_rate IS NOT NULL
              THEN COALESCE(ss.contract_amount, j.amount, 0) * ss.commission_rate / 100
            WHEN ss.exchange_rate > 0 AND ss.commission_rate IS NOT NULL
              THEN COALESCE(ss.contract_amount, j.amount, 0) * ss.commission_rate / 100 * ss.exchange_rate
            ELSE 0 END
        ), 0) AS total_hh_vnd
       FROM seafarer_salary ss
       JOIN seafarer_deployment sd ON sd.id = ss.deployment_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       WHERE ss.salary_month = ? AND ss.deleted_at IS NULL`,
      [daysInMonth, daysInMonth, rateMonth]
    )
    totals.total_profit_vnd =
      (totals.total_gross_vnd || 0) - (totals.total_net_vnd || 0) - (totals.total_hh_vnd || 0)

    const [overdueRows] = await pool.query(
      `SELECT DATE_FORMAT(salary_month, '%Y-%m') AS month, COUNT(*) AS unpaid_count
       FROM seafarer_salary
       WHERE is_paid = 0 AND deleted_at IS NULL AND salary_month < ?
       GROUP BY DATE_FORMAT(salary_month, '%Y-%m')
       ORDER BY salary_month DESC`,
      [rateMonth]
    )

    return { month, ...counts, ...totals, overdue_months: overdueRows }
  })

  // ──────────────────────────────────────────────
  // SALARY LIST — tổng hợp tất cả
  // ──────────────────────────────────────────────

  // GET /api/v1/salary?month=YYYY-MM&status=unpaid|paid|missing&seafarer_id=
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { month, status, seafarer_id, page: pageRaw, limit: limitRaw } = request.query
    const page = Math.max(1, parseInt(pageRaw) || 1)
    const limit = Math.min(parseInt(limitRaw) || 50, 200)
    const offset = (page - 1) * limit

    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const targetMonth = month || defaultMonth
    const rateMonth = `${targetMonth}-01`

    if (status === 'missing') {
      // TV onboard/signed_off chưa có salary record tháng này
      let sql = `
        SELECT sd.id AS deployment_id, sd.vessel_name, sd.commission_rate,
          sd.contract_start_date, sd.contract_end_date,
          s.full_name AS seafarer_name, s.seafarer_code, s.id AS seafarer_id,
          r.name_vi AS rank_name
        FROM seafarer_deployment sd
        JOIN seafarer s ON s.id = sd.seafarer_id
        LEFT JOIN \`rank\` r ON r.id = sd.rank_id
        WHERE sd.status IN ('onboard','signed_off')
          AND NOT EXISTS (
            SELECT 1 FROM seafarer_salary ss
            WHERE ss.deployment_id = sd.id AND ss.salary_month = ? AND ss.deleted_at IS NULL
          )`
      const params = [rateMonth]
      if (seafarer_id) {
        sql += ' AND s.id = ?'
        params.push(parseInt(seafarer_id))
      }
      sql += ' ORDER BY s.full_name LIMIT ? OFFSET ?'
      params.push(limit, offset)
      const [rows] = await pool.query(sql, params)
      return { data: rows, month: targetMonth }
    }

    let sql = SALARY_SELECT + ' WHERE ss.salary_month = ? AND ss.deleted_at IS NULL'
    const params = [rateMonth]

    if (status === 'paid') {
      sql += ' AND ss.is_paid = 1'
    } else if (status === 'unpaid') {
      sql += ' AND ss.is_paid = 0'
    }
    if (seafarer_id) {
      sql += ' AND sd.seafarer_id = ?'
      params.push(parseInt(seafarer_id))
    }
    sql += ' ORDER BY s.full_name LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const [rows] = await pool.query(sql, params)
    return { data: rows, month: targetMonth }
  })

  // ──────────────────────────────────────────────
  // PER-DEPLOYMENT ENDPOINTS
  // ──────────────────────────────────────────────

  // GET /api/v1/salary/deployment/:deploymentId
  fastify.get(
    '/deployment/:deploymentId',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const deploymentId = parseInt(request.params.deploymentId)
      const [[dep]] = await pool.query('SELECT id FROM seafarer_deployment WHERE id = ? LIMIT 1', [
        deploymentId,
      ])
      if (!dep) return reply.code(404).send({ error: 'Không tìm thấy deployment' })

      const [rows] = await pool.query(
        SALARY_SELECT +
          ` WHERE ss.deployment_id = ?
        AND ss.deleted_at IS NULL
        AND ss.exchange_rate IS NOT NULL
        AND ss.working_days IS NOT NULL
       ORDER BY ss.salary_month DESC`,
        [deploymentId]
      )
      return { data: rows }
    }
  )

  // POST /api/v1/salary/bulk-generate — tạo record lương cho toàn bộ TV onboard của tháng
  fastify.post('/bulk-generate', auth, async (request, reply) => {
    const { month } = request.body
    if (!month) return reply.code(400).send({ error: 'month là bắt buộc (YYYY-MM)' })
    const rateMonth = month.length === 7 ? `${month}-01` : month

    // Số ngày trong tháng (tính full, ko trừ T7/CN)
    const d = new Date(rateMonth)
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

    // Tỷ giá tháng nếu có
    const [[mer]] = await pool.query(
      `SELECT rate FROM monthly_exchange_rate
       WHERE rate_month = ? AND from_currency = 'USD' AND to_currency = 'VND' LIMIT 1`,
      [rateMonth]
    )
    const exchangeRate = mer?.rate ? parseFloat(mer.rate) : null

    const [deps] = await pool.query(
      `SELECT sd.id, sd.salary, sd.salary_currency, sd.commission_rate,
              j.amount AS job_amount, j.currency AS job_currency
       FROM seafarer_deployment sd
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       WHERE sd.join_date <= LAST_DAY(?)
         AND (sd.sign_off_date >= ? OR sd.sign_off_date IS NULL)
         AND sd.status NOT IN ('signed_off', 'cancelled')`,
      [rateMonth, rateMonth]
    )

    let created = 0
    let skipped = 0
    for (const dep of deps) {
      const isVnd = dep.salary_currency === 'VND'
      const isJobVnd = dep.job_currency === 'VND' || isVnd
      const salaryGross = !isVnd && dep.salary ? parseFloat(dep.salary) : null
      const contractAmount = !isJobVnd && dep.job_amount ? parseFloat(dep.job_amount) : null
      const commRate = dep.commission_rate ? parseFloat(dep.commission_rate) : null
      const commAmount =
        salaryGross != null && commRate != null
          ? parseFloat(((salaryGross * commRate) / 100).toFixed(2))
          : null
      const salaryNet = salaryGross != null ? parseFloat(salaryGross.toFixed(2)) : null
      const salaryNetVnd =
        isVnd && dep.salary
          ? parseFloat(((parseFloat(dep.salary) * daysInMonth) / daysInMonth).toFixed(2))
          : salaryNet != null && exchangeRate != null
            ? parseFloat((salaryNet * exchangeRate).toFixed(2))
            : null

      // Check if soft-deleted record exists for this deployment+month
      const [[deleted]] = await pool.query(
        'SELECT id FROM seafarer_salary WHERE deployment_id = ? AND salary_month = ? AND deleted_at IS NOT NULL',
        [dep.id, rateMonth]
      )

      if (deleted) {
        // Restore soft-deleted record with fresh data from deployment
        await pool.query(
          `UPDATE seafarer_salary SET
            working_days = ?, salary_gross = ?, contract_amount = ?,
            advance_payment = NULL, bonus_rejoin = NULL, bonus_other = NULL,
            commission_rate = ?, commission_amount = ?,
            salary_net = ?, exchange_rate = ?, salary_net_vnd = ?,
            air_ticket = NULL, air_ticket_name = NULL,
            doc_fee = NULL, signoff_fee = NULL, flag_cert_fee = NULL,
            foreign_labor_fee = NULL, export_cost = NULL,
            other_cost = NULL, other_cost_note = NULL,
            penalty_amount = NULL, visa_fee = NULL, owner_bonus = NULL,
            export_labor_fee = NULL, immigration_fee = NULL, transport_fee = NULL,
            revenue_exchange_rate = NULL,
            total_deductions = NULL,
            is_paid = 0, paid_at = NULL, notes = NULL,
            deleted_at = NULL, updated_at = NOW()
           WHERE id = ?`,
          [
            daysInMonth,
            salaryGross,
            contractAmount,
            commRate,
            commAmount,
            salaryNet,
            exchangeRate,
            salaryNetVnd,
            deleted.id,
          ]
        )
        // Restore vessel_revenue with fresh data
        await pool.query(
          `INSERT INTO vessel_revenue (salary_id, deployment_id, revenue_month, contract_amount)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             contract_amount = VALUES(contract_amount),
             revenue_exchange_rate = NULL, visa_fee = NULL, owner_bonus = NULL,
             export_labor_fee = NULL, immigration_fee = NULL, transport_fee = NULL,
             penalty_amount = NULL, other_cost = NULL,
             is_paid = 0, notes = NULL,
             deleted_at = NULL, updated_at = NOW()`,
          [deleted.id, dep.id, rateMonth, contractAmount]
        )
        created++
      } else {
        try {
          const [ins] = await pool.query(
            `INSERT INTO seafarer_salary
               (deployment_id, salary_month, working_days, salary_gross, contract_amount,
                commission_rate, commission_amount, salary_net,
                exchange_rate, salary_net_vnd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              dep.id,
              rateMonth,
              daysInMonth,
              salaryGross,
              contractAmount,
              commRate,
              commAmount,
              salaryNet,
              exchangeRate,
              salaryNetVnd,
            ]
          )
          // Auto-create corresponding vessel_revenue record
          await pool.query(
            `INSERT IGNORE INTO vessel_revenue (salary_id, deployment_id, revenue_month, contract_amount)
             VALUES (?, ?, ?, ?)`,
            [ins.insertId, dep.id, rateMonth, contractAmount]
          )
          created++
        } catch (e) {
          if (e.code === 'ER_DUP_ENTRY') {
            // Salary exists — backfill vessel_revenue if missing (e.g. created before this feature)
            const [[existing]] = await pool.query(
              'SELECT id FROM seafarer_salary WHERE deployment_id = ? AND salary_month = ? AND deleted_at IS NULL LIMIT 1',
              [dep.id, rateMonth]
            )
            if (existing) {
              await pool.query(
                `INSERT IGNORE INTO vessel_revenue (salary_id, deployment_id, revenue_month, contract_amount)
                 VALUES (?, ?, ?, ?)`,
                [existing.id, dep.id, rateMonth, contractAmount]
              )
            }
            skipped++
          } else throw e
        }
      }
    }
    return reply.code(201).send({ created, skipped })
  })

  // PUT /api/v1/salary/bulk-mark-paid — đánh dấu tất cả đã trả cho tháng
  fastify.put('/bulk-mark-paid', auth, async (request, reply) => {
    const { month } = request.body
    if (!month) return reply.code(400).send({ error: 'month là bắt buộc' })
    const rateMonth = month.length === 7 ? `${month}-01` : month
    const [result] = await pool.query(
      `UPDATE seafarer_salary SET is_paid = 1, paid_at = NOW(), updated_at = NOW()
       WHERE salary_month = ? AND is_paid = 0 AND deleted_at IS NULL`,
      [rateMonth]
    )
    return { updated: result.affectedRows }
  })

  // PUT /api/v1/salary/:id
  fastify.put('/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query(
      'SELECT * FROM seafarer_salary WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy bản ghi lương' })

    const fields = [
      'salary_gross',
      'contract_amount',
      'advance_payment',
      'bonus_rejoin',
      'bonus_other',
      'working_days',
      'commission_rate',
      'air_ticket',
      'air_ticket_name',
      'doc_fee',
      'signoff_fee',
      'foreign_labor_fee',
      'flag_cert_fee',
      'export_cost',
      'other_cost',
      'other_cost_note',
      'penalty_amount',
      'visa_fee',
      'owner_bonus',
      'export_labor_fee',
      'immigration_fee',
      'transport_fee',
      'exchange_rate',
      'revenue_exchange_rate',
      'is_paid',
      'paid_at',
      'notes',
    ]
    const merged = { ...existing }
    for (const f of fields) {
      if (request.body[f] !== undefined) merged[f] = request.body[f]
    }

    const { commissionAmount, totalDeductions, salaryNet } = calcDerived(merged)

    // Compute Thanh toán VND (mirrors Tab 1 frontend formula) and save as salary_net_vnd
    const [[depRow]] = await pool.query('SELECT salary FROM seafarer_deployment WHERE id = ?', [
      existing.deployment_id,
    ])
    const [[{ otherCosts }]] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS otherCosts FROM salary_other_costs WHERE salary_id = ?',
      [id]
    )
    const mergedWithDed = { ...merged, total_deductions: totalDeductions }
    const daysInMonth = getDaysInMonth(existing.salary_month)
    const resolvedNetVnd = calcThanhToanVnd(
      mergedWithDed,
      depRow?.salary,
      daysInMonth,
      parseFloat(otherCosts)
    )

    const n = (v) => (v != null ? parseFloat(v) : null)

    await pool.query(
      `UPDATE seafarer_salary SET
        salary_gross = ?, contract_amount = ?, advance_payment = ?,
        bonus_rejoin = ?, bonus_other = ?,
        working_days = ?, commission_rate = ?, commission_amount = ?,
        air_ticket = ?, air_ticket_name = ?,
        doc_fee = ?, signoff_fee = ?, foreign_labor_fee = ?, flag_cert_fee = ?,
        export_cost = ?, other_cost = ?, other_cost_note = ?,
        penalty_amount = ?, visa_fee = ?, owner_bonus = ?,
        export_labor_fee = ?, immigration_fee = ?, transport_fee = ?,
        total_deductions = ?, salary_net = ?,
        exchange_rate = ?, salary_net_vnd = ?,
        is_paid = ?, paid_at = ?, notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        n(merged.salary_gross),
        n(merged.contract_amount),
        n(merged.advance_payment),
        n(merged.bonus_rejoin),
        n(merged.bonus_other),
        merged.working_days != null ? parseInt(merged.working_days) : null,
        n(merged.commission_rate),
        commissionAmount,
        n(merged.air_ticket),
        merged.air_ticket_name || null,
        n(merged.doc_fee),
        n(merged.signoff_fee),
        n(merged.foreign_labor_fee),
        n(merged.flag_cert_fee),
        n(merged.export_cost),
        n(merged.other_cost),
        merged.other_cost_note || null,
        n(merged.penalty_amount),
        n(merged.visa_fee),
        n(merged.owner_bonus),
        n(merged.export_labor_fee),
        n(merged.immigration_fee),
        n(merged.transport_fee),
        totalDeductions,
        salaryNet,
        merged.exchange_rate != null ? parseFloat(merged.exchange_rate) : null,
        resolvedNetVnd,
        merged.is_paid ? 1 : 0,
        merged.is_paid && !merged.paid_at ? new Date() : merged.paid_at || null,
        merged.notes || null,
        id,
      ]
    )

    const [[updated]] = await pool.query(SALARY_SELECT + ' WHERE ss.id = ?', [id])
    // Recalc from deductions table (overrides fixed-column calc if deductions exist)
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM salary_deductions WHERE salary_id = ?',
      [id]
    )
    if (cnt > 0) await recalcSalary(id)
    const [[final]] = await pool.query(SALARY_SELECT + ' WHERE ss.id = ?', [id])
    return final
  })

  // DELETE /api/v1/salary/:id
  fastify.delete('/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    // Reset tất cả cột data về NULL, giữ lại record để bulk-generate có thể restore
    await pool.query(
      `UPDATE seafarer_salary SET
        salary_gross = NULL, contract_amount = NULL,
        working_days = NULL, exchange_rate = NULL, revenue_exchange_rate = NULL,
        advance_payment = NULL, bonus_rejoin = NULL, bonus_other = NULL,
        commission_rate = NULL, commission_amount = NULL,
        air_ticket = NULL, air_ticket_name = NULL,
        doc_fee = NULL, signoff_fee = NULL, flag_cert_fee = NULL,
        foreign_labor_fee = NULL, export_cost = NULL,
        other_cost = NULL, other_cost_note = NULL,
        penalty_amount = NULL, visa_fee = NULL, owner_bonus = NULL,
        export_labor_fee = NULL, immigration_fee = NULL, transport_fee = NULL,
        total_deductions = NULL, salary_net = NULL, salary_net_vnd = NULL,
        is_paid = 0, paid_at = NULL, notes = NULL,
        deleted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [id]
    )
    await pool.query('DELETE FROM salary_deductions WHERE salary_id = ?', [id])
    await pool.query('DELETE FROM salary_other_costs WHERE salary_id = ?', [id])
    await pool.query(
      `UPDATE vessel_revenue SET
        contract_amount = NULL, revenue_exchange_rate = NULL,
        visa_fee = NULL, owner_bonus = NULL,
        export_labor_fee = NULL, immigration_fee = NULL, transport_fee = NULL,
        penalty_amount = NULL, other_cost = NULL,
        is_paid = 0, notes = NULL,
        deleted_at = NOW(), updated_at = NOW()
       WHERE salary_id = ? AND deleted_at IS NULL`,
      [id]
    )
    return { success: true }
  })

  // ──────────────────────────────────────────────
  // SALARY DEDUCTIONS (flexible line items)
  // ──────────────────────────────────────────────

  async function recalcSalary(salaryId) {
    const [[row]] = await pool.query('SELECT * FROM seafarer_salary WHERE id = ?', [salaryId])
    if (!row) return
    const [[{ total }]] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM salary_deductions WHERE salary_id = ?',
      [salaryId]
    )
    const [[{ otherCosts }]] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS otherCosts FROM salary_other_costs WHERE salary_id = ?',
      [salaryId]
    )
    const [[depRow]] = await pool.query('SELECT salary FROM seafarer_deployment WHERE id = ?', [
      row.deployment_id,
    ])
    const totalDed = parseFloat(total)
    const gross = row.salary_gross != null ? parseFloat(row.salary_gross) : null
    const salaryNet = gross != null ? parseFloat((gross - totalDed).toFixed(2)) : null
    const daysInMonth = getDaysInMonth(row.salary_month)
    const rowWithDed = { ...row, total_deductions: totalDed > 0 ? totalDed : null }
    const netVnd = calcThanhToanVnd(rowWithDed, depRow?.salary, daysInMonth, parseFloat(otherCosts))
    await pool.query(
      'UPDATE seafarer_salary SET total_deductions = ?, salary_net = ?, salary_net_vnd = ?, updated_at = NOW() WHERE id = ?',
      [totalDed > 0 ? totalDed : null, salaryNet, netVnd, salaryId]
    )
  }

  // GET /api/v1/salary/:salaryId/deductions
  fastify.get('/:salaryId/deductions', { onRequest: [fastify.authenticate] }, async (request) => {
    const salaryId = parseInt(request.params.salaryId)
    const [rows] = await pool.query(
      'SELECT * FROM salary_deductions WHERE salary_id = ? ORDER BY id',
      [salaryId]
    )
    return { data: rows }
  })

  // POST /api/v1/salary/:salaryId/deductions
  fastify.post('/:salaryId/deductions', auth, async (request, reply) => {
    const salaryId = parseInt(request.params.salaryId)
    const { label, amount } = request.body
    if (!label) return reply.code(400).send({ error: 'label là bắt buộc' })
    const [result] = await pool.query(
      'INSERT INTO salary_deductions (salary_id, label, amount) VALUES (?, ?, ?)',
      [salaryId, label, parseFloat(amount) || 0]
    )
    await recalcSalary(salaryId)
    const [[row]] = await pool.query('SELECT * FROM salary_deductions WHERE id = ?', [
      result.insertId,
    ])
    return reply.code(201).send(row)
  })

  // PUT /api/v1/salary/deductions/:id
  fastify.put('/deductions/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query('SELECT * FROM salary_deductions WHERE id = ?', [id])
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy' })
    const { label, amount } = request.body
    await pool.query('UPDATE salary_deductions SET label = ?, amount = ? WHERE id = ?', [
      label || existing.label,
      amount != null ? parseFloat(amount) : existing.amount,
      id,
    ])
    await recalcSalary(existing.salary_id)
    const [[updated]] = await pool.query('SELECT * FROM salary_deductions WHERE id = ?', [id])
    return updated
  })

  // DELETE /api/v1/salary/deductions/:id
  fastify.delete('/deductions/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query('SELECT * FROM salary_deductions WHERE id = ?', [id])
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy' })
    await pool.query('DELETE FROM salary_deductions WHERE id = ?', [id])
    await recalcSalary(existing.salary_id)
    return { success: true }
  })

  // ──────────────────────────────────────────────
  // OTHER COSTS (chi phí khác của công ty, bảng riêng)
  // ──────────────────────────────────────────────

  fastify.get('/:salaryId/other-costs', { onRequest: [fastify.authenticate] }, async (request) => {
    const salaryId = parseInt(request.params.salaryId)
    const [rows] = await pool.query(
      'SELECT * FROM salary_other_costs WHERE salary_id = ? ORDER BY id',
      [salaryId]
    )
    return { data: rows }
  })

  fastify.post('/:salaryId/other-costs', auth, async (request, reply) => {
    const salaryId = parseInt(request.params.salaryId)
    const { label, amount } = request.body
    if (!label) return reply.code(400).send({ error: 'label là bắt buộc' })
    const [result] = await pool.query(
      'INSERT INTO salary_other_costs (salary_id, label, amount) VALUES (?, ?, ?)',
      [salaryId, label, parseFloat(amount) || 0]
    )
    const [[row]] = await pool.query('SELECT * FROM salary_other_costs WHERE id = ?', [
      result.insertId,
    ])
    return reply.code(201).send(row)
  })

  fastify.put('/other-costs/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query('SELECT * FROM salary_other_costs WHERE id = ?', [id])
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy' })
    const { label, amount } = request.body
    await pool.query('UPDATE salary_other_costs SET label = ?, amount = ? WHERE id = ?', [
      label || existing.label,
      amount != null ? parseFloat(amount) : existing.amount,
      id,
    ])
    const [[updated]] = await pool.query('SELECT * FROM salary_other_costs WHERE id = ?', [id])
    return updated
  })

  fastify.delete('/other-costs/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query('SELECT * FROM salary_other_costs WHERE id = ?', [id])
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy' })
    await pool.query('DELETE FROM salary_other_costs WHERE id = ?', [id])
    return { success: true }
  })
}

module.exports = salaryRoutes
