const pool = require('../config/db')
const { EXPIRING_DAYS } = require('../utils/crew_overview')
const { DEADLINE_WARN_DAYS } = require('../constants/opportunity_voyage')
const { SCHEDULE_DAYS } = require('../constants/dashboard')
const { leaveFlag, daysFrom } = require('../utils/opportunity_rules')
const { LIST_SELECT, decorate } = require('./opportunity.service')

const MAX_ROWS = 200
// Hợp đồng tính cho người phụ trách cơ hội; không có cơ hội thì người tạo (giống kpi.service).
const CREDITED_TO = 'COALESCE(cr_o.owner_user_id, c.created_by)'
const CREDIT_JOIN = `LEFT JOIN seafarer_voyage cr_sv ON cr_sv.id = c.seafarer_voyage_id
  LEFT JOIN opportunity cr_o ON cr_o.id = cr_sv.opportunity_id`

// Thêm điều kiện "cột = ?" khi có giá trị.
const andEq = (column, value, params) => {
  if (value == null) return ''
  params.push(value)
  return ` AND ${column} = ?`
}

async function today(db) {
  const [rows] = await db.query('SELECT TO_CHAR(CURRENT_DATE, \'YYYY-MM-DD\') AS today')
  return rows[0].today
}

// Quá hạn lâu nhất trước, rồi gần hạn nhất.
const byUrgency = (a, b) => (a.late === b.late ? (a.late ? b.days - a.days : a.days - b.days) : a.late ? -1 : 1)
const tab = (rows) => ({ count: rows.length, late: rows.filter((r) => r.late).length, rows })

const dashboardService = {
  // Chứng chỉ của mọi thuyền viên đã quá hạn hoặc sắp hết hạn (trong EXPIRING_DAYS ngày), gần hạn nhất lên trước.
  // Bỏ chứng chỉ bị thu hồi, không thời hạn, và chứng chỉ đã có bản mới thay (cùng loại, bản kia không thời hạn hoặc hết hạn muộn hơn).
  // ownerId: chỉ thuyền viên do người này tạo (phạm vi "own"), null là tất cả.
  // trip: chuyến chưa rời của thuyền viên (ONBOARD nếu đã tới ngày xuống tàu, UPCOMING nếu chưa), null là ở bờ.
  async certificateAlerts({ ownerId = null } = {}, db = pool) {
    const [rows] = await db.query(
      `SELECT sc.id, sc.seafarer_id, s.full_name AS seafarer_name, s.seafarer_code,
              COALESCE(r.name_vi, s.rank_name_vi) AS rank_name,
              COALESCE(ct.name_vi, sc.certificate_name_raw, 'Chứng chỉ chưa rõ loại') AS certificate_name,
              ct.category AS certificate_category, sc.certificate_number,
              TO_CHAR(sc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              (sc.expiry_date - CURRENT_DATE) AS days_left,
              sv.id AS voyage_id, ves.vessel_name, (sv.join_date > CURRENT_DATE) AS upcoming
       FROM seafarer_certificate sc
       JOIN seafarer s ON s.id = sc.seafarer_id AND s.deleted_at IS NULL
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
       LEFT JOIN seafarer_voyage sv ON sv.seafarer_id = s.id AND sv.leave_date IS NULL AND sv.deleted_at IS NULL
       LEFT JOIN vessel ves ON ves.id = sv.vessel_id
       WHERE sc.deleted_at IS NULL AND sc.status <> 'REVOKED'
         AND sc.no_expiry = 0 AND sc.expiry_date IS NOT NULL
         AND sc.expiry_date <= CURRENT_DATE + (${EXPIRING_DAYS} * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1 FROM seafarer_certificate nx
           WHERE nx.seafarer_id = sc.seafarer_id AND nx.certificate_type_id = sc.certificate_type_id
             AND nx.id <> sc.id AND nx.deleted_at IS NULL AND nx.status <> 'REVOKED'
             AND (nx.no_expiry = 1 OR nx.expiry_date IS NULL OR nx.expiry_date > sc.expiry_date)
         )
         ${ownerId ? 'AND s.created_by = ?' : ''}
       ORDER BY sc.expiry_date ASC, s.full_name ASC
       LIMIT ${MAX_ROWS}`,
      ownerId ? [ownerId] : []
    )
    return rows.map(({ voyage_id: voyageId, vessel_name: vesselName, upcoming, ...row }) => ({
      ...row,
      days_left: Number(row.days_left),
      state: Number(row.days_left) < 0 ? 'EXPIRED' : 'EXPIRING',
      trip: voyageId ? { where: upcoming ? 'UPCOMING' : 'ONBOARD', voyage_id: voyageId, vessel_name: vesselName } : null,
    }))
  },

  // Cơ hội đang mở đã quá hạn chốt hoặc tới hạn trong DEADLINE_WARN_DAYS ngày.
  // createdBy: phạm vi "own"; ownerUserId: màn môi giới (cơ hội mình phụ trách).
  async deadlineOpportunities({ createdBy = null, ownerUserId = null } = {}, db = pool) {
    const params = []
    const where = `WHERE o.deleted_at IS NULL AND o.status = 'OPEN' AND o.deadline <= CURRENT_DATE + ${DEADLINE_WARN_DAYS}
      ${andEq('o.created_by', createdBy, params)}${andEq('o.owner_user_id', ownerUserId, params)}`
    const [rows] = await db.query(`${LIST_SELECT} ${where} ORDER BY o.deadline ASC, o.id ASC LIMIT ${MAX_ROWS}`, params)
    return rows.map(decorate).filter((o) => o.deadline_flag).map((o) => ({
      id: o.id, code: o.code, rank_name: o.rank_name, vessel_name: o.vessel_name, ship_owner_name: o.ship_owner_name,
      deadline: String(o.deadline).slice(0, 10), display_status: o.display_status,
      days: o.deadline_flag.days, late: o.deadline_flag.kind === 'LATE',
    }))
  },

  // Xuống tàu trong SCHEDULE_DAYS ngày tới, và rời tàu dự kiến trong LEAVE_WARN_DAYS ngày tới hoặc đã qua mà chưa ghi rời.
  async schedule({ createdBy = null } = {}, db = pool) {
    const params = [], now = await today(db)
    const [rows] = await db.query(
      `SELECT sv.id AS voyage_id, sv.code, s.full_name AS seafarer_name, r.name_vi AS rank_name, ves.vessel_name,
              TO_CHAR(sv.join_date, 'YYYY-MM-DD') AS join_date, jp.name AS join_port_name,
              TO_CHAR(sv.planned_leave_date, 'YYYY-MM-DD') AS planned_leave_date, lp.name AS planned_leave_port_name
       FROM seafarer_voyage sv
       JOIN seafarer s ON s.id = sv.seafarer_id
       JOIN "rank" r ON r.id = sv.rank_id
       JOIN vessel ves ON ves.id = sv.vessel_id
       LEFT JOIN port jp ON jp.id = sv.join_port_id
       LEFT JOIN port lp ON lp.id = sv.planned_leave_port_id
       WHERE sv.deleted_at IS NULL AND sv.leave_date IS NULL
         AND (sv.join_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${SCHEDULE_DAYS} OR sv.planned_leave_date <= CURRENT_DATE + ${SCHEDULE_DAYS})
         ${andEq('sv.created_by', createdBy, params)}
       LIMIT ${MAX_ROWS}`,
      params
    )
    const out = []
    for (const v of rows) {
      const base = { voyage_id: v.voyage_id, code: v.code, seafarer_name: v.seafarer_name, rank_name: v.rank_name, vessel_name: v.vessel_name }
      const joinIn = daysFrom(now, v.join_date)
      if (joinIn >= 0 && joinIn <= SCHEDULE_DAYS) out.push({ ...base, kind: 'JOIN', date: v.join_date, port_name: v.join_port_name, days: joinIn, late: false })
      const flag = leaveFlag({ leave_date: null, planned_leave_date: v.planned_leave_date, today: now })
      if (flag) out.push({ ...base, kind: 'LEAVE', date: v.planned_leave_date, port_name: v.planned_leave_port_name, days: flag.days, late: flag.kind === 'LATE' })
    }
    return out.sort(byUrgency)
  },

  // Việc chờ: mỗi dòng là một loại việc kèm số. own: màn môi giới (hợp đồng, bill của hợp đồng tính cho mình).
  async work({ contractScope = null, billScope = null, own = null, canContract, canBill }, db = pool) {
    const rows = []
    if (canContract) {
      const params = []
      const [[c]] = await db.query(
        `SELECT COUNT(*) FILTER (WHERE c.status = 'REJECTED')::int AS rejected, COUNT(*) FILTER (WHERE c.status = 'PENDING')::int AS pending,
                COUNT(*) FILTER (WHERE c.status = 'DRAFT')::int AS draft
         FROM seafarer_contract c ${CREDIT_JOIN}
         WHERE c.deleted_at IS NULL${andEq('c.created_by', contractScope, params)}${andEq(CREDITED_TO, own, params)}`,
        params
      )
      rows.push({ key: 'CONTRACT_REJECTED', n: c.rejected, late: true, link: '/contracts?tab=REJECTED' })
      rows.push({ key: 'CONTRACT_PENDING', n: c.pending, late: false, link: '/contracts?tab=PENDING' })
      if (own) rows.push({ key: 'CONTRACT_DRAFT', n: c.draft, late: false, link: '/contracts?tab=DRAFT' })
    }
    if (canBill) {
      const params = []
      const [[b]] = await db.query(
        `SELECT COUNT(*) FILTER (WHERE b.status = 'SENT' AND CURRENT_DATE > b.due_date)::int AS overdue,
                COALESCE(SUM((SELECT COALESCE(SUM(i.amount_usd), 0) FROM contract_bill_item i WHERE i.bill_id = b.id))
                  FILTER (WHERE b.status = 'SENT' AND CURRENT_DATE > b.due_date), 0) AS overdue_usd,
                COUNT(*) FILTER (WHERE b.status = 'OPEN' AND CURRENT_DATE >= b.period_end)::int AS to_approve,
                COUNT(*) FILTER (WHERE b.status = 'APPROVED')::int AS to_send
         FROM contract_bill b JOIN seafarer_contract c ON c.id = b.contract_id ${CREDIT_JOIN}
         WHERE b.deleted_at IS NULL AND b.side = 'RECEIVABLE'${andEq('b.created_by', billScope, params)}${andEq(CREDITED_TO, own, params)}`,
        params
      )
      rows.unshift({ key: 'BILL_OVERDUE', n: b.overdue, amount_usd: Number(b.overdue_usd), late: true, link: '/bills?tab=OVERDUE' })
      if (!own) rows.push({ key: 'BILL_TO_APPROVE', n: b.to_approve, late: false, link: '/bills?tab=TO_APPROVE' })
      rows.push({ key: 'BILL_TO_SEND', n: b.to_send, late: false, link: '/bills?tab=TO_SEND' })
    }
    const shown = rows.filter((r) => r.n > 0)
    return [...shown.filter((r) => r.late), ...shown.filter((r) => !r.late)]
  },

  // Khối Cần chú ý: chỉ các tab có quyền; tab lỗi trả { error: true }, tab khác vẫn có dữ liệu.
  // scopes: { opportunity, seafarer, voyage, contract, bill } → id người dùng khi phạm vi "own", không thì null.
  async attention({ userId, mine, perms, scopes }, db = pool) {
    const me = mine ? userId : null
    const jobs = {}
    if (perms.has('opportunity.view')) jobs.opportunities = () => this.deadlineOpportunities({ createdBy: scopes.opportunity, ownerUserId: me }, db).then(tab)
    if (perms.has('seafarer.view')) {
      jobs.certificates = () => this.certificateAlerts({ ownerId: me || scopes.seafarer }, db).then((rows) => tab(rows.map((r) => ({ ...r, days: Math.abs(r.days_left), late: r.days_left < 0 }))))
    }
    if (perms.has('voyage.view')) jobs.schedule = () => this.schedule({ createdBy: me || scopes.voyage }, db).then(tab)
    const canContract = perms.has('contract.view'), canBill = perms.has('bill.view')
    if (canContract || canBill) {
      jobs.work = () => this.work({ contractScope: scopes.contract, billScope: scopes.bill, own: me, canContract, canBill }, db)
        .then((rows) => ({ count: rows.reduce((s, r) => s + r.n, 0), late: rows.filter((r) => r.late).length, rows }))
    }
    const keys = Object.keys(jobs)
    const settled = await Promise.allSettled(keys.map((k) => jobs[k]()))
    return { tabs: Object.fromEntries(keys.map((k, i) => [k, settled[i].status === 'fulfilled' ? settled[i].value : { error: true }])) }
  },
}

module.exports = dashboardService
