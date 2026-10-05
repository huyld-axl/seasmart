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

const REVENUE_SELECT = `
  SELECT
    vr.id AS revenue_id,
    vr.salary_id,
    vr.deployment_id,
    vr.contract_amount,
    vr.revenue_exchange_rate,
    vr.visa_fee,
    vr.owner_bonus,
    vr.export_labor_fee,
    vr.immigration_fee,
    vr.transport_fee,
    vr.penalty_amount,
    vr.other_cost,
    vr.is_paid,
    vr.notes AS revenue_notes,
    ss.salary_gross,
    ss.working_days,
    ss.exchange_rate AS salary_exchange_rate,
    ss.salary_net_vnd,
    ss.total_deductions,
    ss.advance_payment,
    sd.salary AS deployment_salary,
    sd.salary_currency,
    sd.vessel_name,
    sd.job_id,
    j.amount AS job_amount,
    j.currency AS job_currency,
    j.partner_id,
    p.company_name AS partner_name,
    s.id AS seafarer_id,
    s.full_name AS seafarer_name,
    s.seafarer_code,
    r.name_vi AS rank_name,
    r.code AS rank_code
  FROM vessel_revenue vr
  JOIN seafarer_salary ss ON ss.id = vr.salary_id
  JOIN seafarer_deployment sd ON sd.id = vr.deployment_id
  JOIN seafarer s ON s.id = sd.seafarer_id
  LEFT JOIN \`rank\` r ON r.id = sd.rank_id
  LEFT JOIN \`job\` j ON j.id = sd.job_id
  LEFT JOIN partner p ON p.id = j.partner_id
`

async function revenueRoutes(fastify) {
  const auth = adminAuth(fastify)

  // GET /api/v1/revenue?month=YYYY-MM&partner_id=
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = request.query.month || defaultMonth
    const rateMonth = `${month}-01`
    const partnerId = request.query.partner_id ? parseInt(request.query.partner_id) : null

    const conditions = ['vr.revenue_month = ?', 'vr.deleted_at IS NULL']
    const params = [rateMonth]
    if (partnerId) {
      conditions.push('j.partner_id = ?')
      params.push(partnerId)
    }

    const [rows] = await pool.query(
      REVENUE_SELECT + ` WHERE ${conditions.join(' AND ')} ORDER BY s.full_name`,
      params
    )

    // Lấy tỷ giá tháng nếu có (fallback cho Tab 2)
    const [[mer]] = await pool.query(
      `SELECT rate FROM monthly_exchange_rate
       WHERE rate_month = ? AND from_currency = 'USD' AND to_currency = 'VND' LIMIT 1`,
      [rateMonth]
    )

    return {
      month,
      exchange_rate: mer?.rate ? parseFloat(mer.rate) : null,
      data: rows,
    }
  })

  // PUT /api/v1/revenue/:id
  fastify.put('/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[existing]] = await pool.query(
      'SELECT * FROM vessel_revenue WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
    if (!existing) return reply.code(404).send({ error: 'Không tìm thấy bản ghi doanh thu' })

    const fields = [
      'contract_amount',
      'revenue_exchange_rate',
      'visa_fee',
      'owner_bonus',
      'export_labor_fee',
      'immigration_fee',
      'transport_fee',
      'penalty_amount',
      'other_cost',
      'is_paid',
      'notes',
    ]
    const merged = { ...existing }
    for (const f of fields) {
      if (request.body[f] !== undefined) merged[f] = request.body[f]
    }

    const n = (v) => (v != null ? parseFloat(v) : null)

    await pool.query(
      `UPDATE vessel_revenue SET
        contract_amount = ?,
        revenue_exchange_rate = ?,
        visa_fee = ?,
        owner_bonus = ?,
        export_labor_fee = ?,
        immigration_fee = ?,
        transport_fee = ?,
        penalty_amount = ?,
        other_cost = ?,
        is_paid = ?,
        notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        n(merged.contract_amount),
        n(merged.revenue_exchange_rate),
        n(merged.visa_fee),
        n(merged.owner_bonus),
        n(merged.export_labor_fee),
        n(merged.immigration_fee),
        n(merged.transport_fee),
        n(merged.penalty_amount),
        n(merged.other_cost),
        merged.is_paid ? 1 : 0,
        merged.notes || null,
        id,
      ]
    )

    const [[updated]] = await pool.query(REVENUE_SELECT + ' WHERE vr.id = ?', [id])
    return updated
  })

  // POST /api/v1/revenue/exchange-rate — cập nhật tỷ giá doanh thu cho tất cả records tháng
  fastify.post('/exchange-rate', auth, async (request, reply) => {
    const { month, rate } = request.body
    if (!month || !rate) return reply.code(400).send({ error: 'month và rate là bắt buộc' })
    const rateMonth = `${month}-01`
    const [result] = await pool.query(
      'UPDATE vessel_revenue SET revenue_exchange_rate = ?, updated_at = NOW() WHERE revenue_month = ? AND deleted_at IS NULL',
      [parseFloat(rate), rateMonth]
    )
    return reply.code(200).send({ updated_count: result.affectedRows })
  })

  // PUT /api/v1/revenue/bulk-mark-paid — đánh dấu tất cả đã thanh toán cho tháng
  fastify.put('/bulk-mark-paid', auth, async (request, reply) => {
    const { month } = request.body
    if (!month) return reply.code(400).send({ error: 'month là bắt buộc' })
    const rateMonth = month.length === 7 ? `${month}-01` : month
    const [result] = await pool.query(
      `UPDATE vessel_revenue SET is_paid = 1, paid_at = NOW(), updated_at = NOW()
       WHERE revenue_month = ? AND is_paid = 0 AND deleted_at IS NULL`,
      [rateMonth]
    )
    return { updated: result.affectedRows }
  })
}

module.exports = revenueRoutes
