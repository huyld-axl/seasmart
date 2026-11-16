const pool = require('../config/db')
const { withTransaction } = require('../utils/transaction')
const { KPI_MONTHS } = require('../constants/dashboard')
const { daysInMonth, lastMonths, revenueByMonth, pace, contractLabel, revenueLabel } = require('../utils/kpi_math')
const { round2 } = require('../utils/voyage_math')

// KPI của màn Tổng quan và mục tiêu tháng (docs/mcah-ke-hoach-tong-quan.md mục 1.4, 4.1, 4.3).
// Hợp đồng tính cho người phụ trách cơ hội; chuyến không có cơ hội thì người tạo hợp đồng.
const CREDITED_TO = 'COALESCE(o.owner_user_id, c.created_by)'
const CREDIT_JOIN = `LEFT JOIN seafarer_voyage sv ON sv.id = c.seafarer_voyage_id
  LEFT JOIN opportunity o ON o.id = sv.opportunity_id`

const firstDay = (month) => `${month}-01`
const lastDay = (month) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
const nextFirstDay = (month) => { const [y, m] = month.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` }
const num = (v) => (v == null ? null : Number(v))

async function today(db) {
  const [rows] = await db.query('SELECT TO_CHAR(CURRENT_DATE, \'YYYY-MM-DD\') AS today')
  return rows[0].today
}

// Hợp đồng hiệu lực / đã kết thúc có ngày giao với [from, to], kèm dòng tiền và người được tính.
async function revenueContracts(db, from, to, userId) {
  const [rows] = await db.query(
    `SELECT c.id, TO_CHAR(c.start_date, 'YYYY-MM-DD') AS start_date, TO_CHAR(c.end_date, 'YYYY-MM-DD') AS end_date, ${CREDITED_TO} AS credited_to
     FROM seafarer_contract c ${CREDIT_JOIN}
     WHERE c.deleted_at IS NULL AND c.status IN ('ACTIVE', 'ENDED') AND c.start_date <= ? AND c.end_date >= ?
     ${userId ? `AND ${CREDITED_TO} = ?` : ''}`,
    userId ? [to, from, userId] : [to, from]
  )
  if (!rows.length) return []
  const [items] = await db.query('SELECT contract_id, kind, receivable_usd, payable_usd FROM contract_item WHERE contract_id IN (?)', [rows.map((r) => r.id)])
  const byContract = new Map(rows.map((r) => [r.id, { ...r, items: [] }]))
  for (const item of items) byContract.get(item.contract_id)?.items.push(item)
  return [...byContract.values()]
}

// Số hợp đồng duyệt lần đầu trong [from, toExclusive), theo tháng và người được tính.
async function signedCounts(db, from, toExclusive, userId) {
  const [rows] = await db.query(
    `SELECT TO_CHAR(f.first_at, 'YYYY-MM') AS month, ${CREDITED_TO} AS credited_to, COUNT(*)::int AS n
     FROM (SELECT contract_id, MIN(created_at) AS first_at FROM contract_approval_log WHERE action = 'APPROVE' GROUP BY contract_id) f
     JOIN seafarer_contract c ON c.id = f.contract_id AND c.deleted_at IS NULL
     ${CREDIT_JOIN}
     WHERE f.first_at >= ? AND f.first_at < ? ${userId ? `AND ${CREDITED_TO} = ?` : ''}
     GROUP BY 1, 2`,
    userId ? [from, toExclusive, userId] : [from, toExclusive]
  )
  return rows
}

async function targetsOf(db, month, userId) {
  const [rows] = await db.query(
    `SELECT user_id, contracts, revenue_usd FROM kpi_target WHERE month = ? ${userId ? 'AND user_id = ?' : ''}`,
    userId ? [firstDay(month), userId] : [firstDay(month)]
  )
  return rows
}

// Tổng mục tiêu; không ai đặt ô đó thì null (chưa đặt mục tiêu, khác 0).
const sumTarget = (rows, field) => {
  const set = rows.map((r) => r[field]).filter((v) => v != null)
  return set.length ? round2(set.reduce((s, v) => s + Number(v), 0)) : null
}

// Việc sắp thành hợp đồng tính cho người này (phần gạch chéo trên thanh tiến độ).
async function pendingOf(db, userId) {
  const [[c]] = await db.query(
    `SELECT COUNT(*) FILTER (WHERE c.status = 'PENDING')::int AS pending, COUNT(*) FILTER (WHERE c.status = 'DRAFT')::int AS draft
     FROM seafarer_contract c ${CREDIT_JOIN}
     WHERE c.deleted_at IS NULL AND c.status IN ('PENDING', 'DRAFT') AND ${CREDITED_TO} = ?`,
    [userId]
  )
  const [[o]] = await db.query(
    `SELECT COUNT(*)::int AS owner_selected FROM opportunity o
     WHERE o.deleted_at IS NULL AND o.status = 'OPEN' AND o.owner_user_id = ?
       AND EXISTS (SELECT 1 FROM opportunity_candidate oc WHERE oc.opportunity_id = o.id AND oc.status <> 'REMOVED' AND oc.owner_selected_at IS NOT NULL)`,
    [userId]
  )
  return { pending: c.pending, draft: c.draft, owner_selected: o.owner_selected }
}

const kpiService = {
  // view: 'company' (có kpi.view_all) hoặc 'own'. month: 'YYYY-MM', mặc định tháng của hôm nay.
  async kpi({ view, userId, month = null }, db = pool) {
    const now = await today(db)
    const cur = month || now.slice(0, 7)
    const months = lastMonths(cur, KPI_MONTHS)
    const days = daysInMonth(cur)
    const isCurrent = cur === now.slice(0, 7)
    const day = isCurrent ? Number(now.slice(8, 10)) : cur < now.slice(0, 7) ? days : 0
    const own = view === 'own' ? userId : null

    const [contracts, signed, targets] = await Promise.all([
      revenueContracts(db, firstDay(months[0]), lastDay(cur), own),
      signedCounts(db, firstDay(months[0]), nextFirstDay(cur), own),
      targetsOf(db, cur, own),
    ])

    const revenue = revenueByMonth(contracts, months)
    const toDate = day === 0 ? 0 : revenueByMonth(contracts, [cur], isCurrent ? now : null)[cur]
    const signedByMonth = Object.fromEntries(months.map((m) => [m, 0]))
    for (const r of signed) signedByMonth[r.month] = (signedByMonth[r.month] || 0) + r.n

    const done = signedByMonth[cur]
    const conTarget = sumTarget(targets, 'contracts')
    const revTarget = sumTarget(targets, 'revenue_usd')
    const conPace = pace(conTarget, day, days)
    const result = {
      view,
      month: cur, day, days_in_month: days,
      revenue: {
        months: months.map((m) => ({ month: m, value: revenue[m], ...(m === cur && isCurrent ? { projected: true } : {}) })),
        to_date: toDate,
        target: revTarget,
        label: revenueLabel(revenue[cur], revTarget),
      },
      contracts: {
        months: months.map((m) => ({ month: m, value: signedByMonth[m] })),
        done, target: conTarget, pace: conPace,
        label: contractLabel(done, conTarget, conPace),
      },
    }

    if (view === 'own') {
      result.contracts.pending = await pendingOf(db, userId)
      return result
    }

    // Từng môi giới viên: có mục tiêu tháng này hoặc có hợp đồng tính cho mình tháng này; tài khoản còn hoạt động.
    const people = new Map()
    const person = (id) => { if (!people.has(id)) people.set(id, { user_id: id, done: 0, target: null, revenue_target: null, revenue: 0 }); return people.get(id) }
    for (const t of targets) Object.assign(person(t.user_id), { target: num(t.contracts), revenue_target: num(t.revenue_usd) })
    for (const r of signed) if (r.month === cur && r.credited_to != null) person(r.credited_to).done += r.n
    for (const c of contracts) {
      if (c.credited_to == null) continue
      const v = revenueByMonth([c], [cur])[cur]
      if (v) person(c.credited_to).revenue = round2(person(c.credited_to).revenue + v)
    }
    const ids = [...people.keys()]
    const [users] = ids.length
      ? await db.query('SELECT id, COALESCE(full_name, email) AS name FROM "user" WHERE id IN (?) AND deleted_at IS NULL AND is_active = 1', [ids])
      : [[]]
    result.people = users
      .map((u) => {
        const p = people.get(u.id)
        const pPace = pace(p.target, day, days)
        return { ...p, name: u.name, pace: pPace, label: contractLabel(p.done, p.target, pPace) }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return result
  },

  // Lưới mục tiêu một tháng: mọi tài khoản còn hoạt động, kèm số đã ký và doanh thu dự kiến để tham khảo.
  async listTargets(month, db = pool) {
    const [users] = await db.query(
      `SELECT u.id AS user_id, COALESCE(u.full_name, u.email) AS name, t.contracts, t.revenue_usd
       FROM "user" u LEFT JOIN kpi_target t ON t.user_id = u.id AND t.month = ?
       WHERE u.deleted_at IS NULL AND u.is_active = 1
       ORDER BY name`,
      [firstDay(month)]
    )
    const kpi = await this.kpi({ view: 'company', month }, db)
    const actual = new Map(kpi.people.map((p) => [p.user_id, p]))
    return {
      month,
      rows: users.map((u) => ({
        user_id: u.user_id, name: u.name, contracts: num(u.contracts), revenue_usd: num(u.revenue_usd),
        done: actual.get(u.user_id)?.done || 0, revenue: actual.get(u.user_id)?.revenue || 0,
      })),
    }
  },

  // Lưu cả lưới trong một transaction. Ô null là bỏ mục tiêu.
  async saveTargets({ month, rows }, actorId, db = pool) {
    const ids = [...new Set(rows.map((r) => r.user_id))]
    if (ids.length !== rows.length) throw { statusCode: 400, message: 'Một tài khoản xuất hiện hai lần' }
    if (rows.some((r) => r.contracts != null && (!Number.isInteger(r.contracts) || r.contracts < 1))) throw { statusCode: 400, message: 'Số hợp đồng mục tiêu phải là số nguyên từ 1' }
    if (rows.some((r) => r.revenue_usd != null && (!Number.isFinite(r.revenue_usd) || r.revenue_usd < 1))) throw { statusCode: 400, message: 'Doanh thu mục tiêu phải từ 1 USD' }
    // multipleOf 0.01 của JSON Schema sai với số thực, kiểm tay.
    if (rows.some((r) => r.revenue_usd != null && Math.abs(Math.round(r.revenue_usd * 100) - r.revenue_usd * 100) > 1e-6)) throw { statusCode: 400, message: 'Doanh thu tối đa 2 chữ số thập phân' }
    await withTransaction(db, async (conn) => {
      if (ids.length) {
        const [found] = await conn.query('SELECT id FROM "user" WHERE id IN (?) AND deleted_at IS NULL', [ids])
        if (found.length !== ids.length) throw { statusCode: 404, message: 'Không tìm thấy tài khoản' }
      }
      for (const r of rows) {
        await conn.query(
          `INSERT INTO kpi_target (user_id, month, contracts, revenue_usd, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, month) DO UPDATE SET contracts = EXCLUDED.contracts, revenue_usd = EXCLUDED.revenue_usd, updated_by = EXCLUDED.updated_by`,
          [r.user_id, firstDay(month), r.contracts ?? null, r.revenue_usd ?? null, actorId, actorId]
        )
      }
    })
    return this.listTargets(month, db)
  },

  // Chép mục tiêu tháng `from` sang `to`, chỉ điền ô đang trống của tháng đích.
  async copyTargets({ from, to }, actorId, db = pool) {
    if (from === to) throw { statusCode: 400, message: 'Tháng nguồn và tháng đích trùng nhau' }
    await db.query(
      `INSERT INTO kpi_target (user_id, month, contracts, revenue_usd, created_by, updated_by)
       SELECT user_id, ?, CASE WHEN contracts >= 1 THEN contracts END, CASE WHEN revenue_usd >= 1 THEN revenue_usd END, ?, ? FROM kpi_target WHERE month = ?
       ON CONFLICT (user_id, month) DO UPDATE SET
         contracts = COALESCE(kpi_target.contracts, EXCLUDED.contracts),
         revenue_usd = COALESCE(kpi_target.revenue_usd, EXCLUDED.revenue_usd),
         updated_by = EXCLUDED.updated_by`,
      [firstDay(to), actorId, actorId, firstDay(from)]
    )
    return this.listTargets(to, db)
  },
}

module.exports = kpiService
