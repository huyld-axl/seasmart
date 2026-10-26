const { pickAllowed, paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { nextCode } = require('../utils/code_counter')
const { monthsBetween, splitBudget, round2 } = require('../utils/voyage_math')
const { displayStatus, deadlineFlag, requirementFit, experienceFromHistory } = require('../utils/opportunity_rules')
const { REQUIREMENT_KINDS, REQUIREMENT_LEVELS, VALID_UNTIL } = require('../constants/opportunity_voyage')
const { TEMPLATE_KEYS } = require('../constants/pack_templates')

const OPPORTUNITY_COLUMNS = [
  'ship_owner_id', 'vessel_id', 'rank_id', 'budget_monthly_usd', 'budget_total_usd',
  'planned_join_date', 'planned_join_port_id', 'planned_leave_date', 'planned_leave_port_id',
  'deadline', 'owner_user_id', 'notes',
]
const REQUIREMENT_COLUMNS = ['kind', 'certificate_type_id', 'rank_id', 'vessel_type_id', 'min_months', 'min_trips', 'template_key', 'level', 'valid_until', 'plus_months']
const MAX_REQUIREMENTS = 60
const NOT_FOUND = 'Không tìm thấy cơ hội'
// Cơ hội đã chốt vẫn ở tab Đang mở trong 7 ngày để thấy tiến độ cả tàu.
const RECENT_WON_DAYS = 7

const num = (v) => (v == null ? null : Number(v))
const iso = (v) => (v == null ? null : String(v instanceof Date ? v.toISOString() : v).slice(0, 10))

const LIST_SELECT = `SELECT o.id, o.code, o.status, o.close_reason, o.rank_id, r.name_vi AS rank_name, r.name_en AS rank_name_en,
    o.vessel_id, ves.vessel_name, o.ship_owner_id, so.company_name AS ship_owner_name,
    o.planned_join_date, o.planned_join_port_id, jp.name AS planned_join_port_name,
    o.planned_leave_date, o.planned_leave_port_id, lp.name AS planned_leave_port_name,
    o.deadline, o.budget_monthly_usd, o.budget_total_usd, o.owner_user_id, u.email AS owner_user_email,
    o.notes, o.created_by, o.created_at, o.updated_at, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today,
    (SELECT COUNT(*) FROM opportunity_candidate c WHERE c.opportunity_id = o.id AND c.status <> 'REMOVED') AS candidates_count,
    (SELECT COUNT(*) FROM opportunity_candidate c WHERE c.opportunity_id = o.id AND c.status <> 'REMOVED' AND c.last_sent_at IS NOT NULL) AS sent_count,
    (SELECT MAX(c.last_sent_at) FROM opportunity_candidate c WHERE c.opportunity_id = o.id AND c.status <> 'REMOVED') AS last_sent_at,
    (SELECT s.full_name FROM opportunity_candidate c JOIN seafarer s ON s.id = c.seafarer_id
       WHERE c.opportunity_id = o.id AND c.owner_selected_at IS NOT NULL AND c.status <> 'REMOVED' LIMIT 1) AS selected_name,
    (SELECT c.owner_selected_at FROM opportunity_candidate c
       WHERE c.opportunity_id = o.id AND c.owner_selected_at IS NOT NULL AND c.status <> 'REMOVED' LIMIT 1) AS selected_at,
    (SELECT s.full_name FROM opportunity_candidate c JOIN seafarer s ON s.id = c.seafarer_id
       WHERE c.opportunity_id = o.id AND c.status = 'PLACED' LIMIT 1) AS placed_name,
    (SELECT sv.id FROM seafarer_voyage sv WHERE sv.opportunity_id = o.id AND sv.deleted_at IS NULL LIMIT 1) AS voyage_id,
    (SELECT sv.code FROM seafarer_voyage sv WHERE sv.opportunity_id = o.id AND sv.deleted_at IS NULL LIMIT 1) AS voyage_code
  FROM opportunity o
  JOIN "rank" r ON r.id = o.rank_id
  JOIN ship_owner so ON so.id = o.ship_owner_id
  LEFT JOIN vessel ves ON ves.id = o.vessel_id
  LEFT JOIN port jp ON jp.id = o.planned_join_port_id
  LEFT JOIN port lp ON lp.id = o.planned_leave_port_id
  LEFT JOIN "user" u ON u.id = o.owner_user_id`

const REQUIREMENT_SELECT = (table, key) => `SELECT q.id, q.kind, q.certificate_type_id, ct.code AS certificate_code, ct.name_vi AS certificate_name,
    ct.category AS certificate_category, q.rank_id, r.name_vi AS rank_name, q.vessel_type_id, vt.name_vi AS vessel_type_name,
    q.min_months, q.min_trips, q.template_key, q.level, q.valid_until, q.plus_months, q.sort_order
  FROM ${table} q
  LEFT JOIN certificate_type ct ON ct.id = q.certificate_type_id
  LEFT JOIN "rank" r ON r.id = q.rank_id
  LEFT JOIN vessel_type vt ON vt.id = q.vessel_type_id
  WHERE q.${key} = ?
  ORDER BY q.sort_order, q.id`

// Một dòng danh sách: thêm display_status, deadline_flag; đổi decimal thành số.
function decorate(row) {
  const { today, ...rest } = row
  const live = Number(row.candidates_count)
  const candidates = live
    ? [{ status: 'PICKED', owner_selected_at: row.selected_at, last_sent_at: Number(row.sent_count) ? row.last_sent_at : null }]
    : []
  return {
    ...rest,
    budget_monthly_usd: num(row.budget_monthly_usd),
    budget_total_usd: num(row.budget_total_usd),
    candidates_count: live,
    sent_count: Number(row.sent_count),
    display_status: displayStatus({ status: row.status, candidates }),
    deadline_flag: deadlineFlag({ status: row.status, deadline: iso(row.deadline), today }),
  }
}

// Kiểm từng yêu cầu như CHECK của bảng, để báo lỗi tiếng Việt thay vì lỗi DB.
function parseRequirements(input) {
  if (input == null) return []
  if (!Array.isArray(input) || input.length > MAX_REQUIREMENTS) throw { statusCode: 400, message: `Hồ sơ yêu cầu tối đa ${MAX_REQUIREMENTS} dòng` }
  return input.map((raw, index) => {
    const row = pickAllowed(raw, REQUIREMENT_COLUMNS)
    const bad = (message) => { throw { statusCode: 400, message: `Hồ sơ yêu cầu dòng ${index + 1}: ${message}` } }
    if (!REQUIREMENT_KINDS.includes(row.kind)) bad('loại không hợp lệ')
    row.level = row.level || 'REQUIRED'
    row.valid_until = row.valid_until || (row.kind === 'CERTIFICATE' ? 'LEAVE' : 'ANY')
    if (!REQUIREMENT_LEVELS.includes(row.level)) bad('mức không hợp lệ')
    if (!VALID_UNTIL.includes(row.valid_until)) bad('mốc còn hạn không hợp lệ')
    if (row.valid_until === 'LEAVE_PLUS' ? !(Number(row.plus_months) > 0) : row.plus_months != null) bad('số tháng cộng thêm chỉ dùng với mốc "ngày rời + N tháng"')
    const has = (key) => row[key] != null
    if (row.kind === 'CERTIFICATE' && !(has('certificate_type_id') && !has('rank_id') && !has('vessel_type_id') && !has('template_key'))) bad('chọn loại giấy')
    if (row.kind === 'EXPERIENCE') {
      const byRank = has('rank_id') && Number(row.min_months) > 0 && !has('vessel_type_id')
      const byType = has('vessel_type_id') && Number(row.min_trips) > 0 && !has('rank_id')
      if (has('certificate_type_id') || has('template_key') || byRank === byType) bad('kinh nghiệm cần chức danh + số tháng, hoặc loại tàu + số chuyến')
    }
    if (row.kind === 'TEMPLATE' && !(TEMPLATE_KEYS.includes(row.template_key) && !has('certificate_type_id') && !has('rank_id') && !has('vessel_type_id'))) bad('mẫu giấy không hợp lệ')
    return { ...row, sort_order: index }
  })
}

// Ngày dự kiến và budget: tự tính ô budget còn thiếu theo số tháng giữa ngày xuống và ngày rời.
function normalizeCore(data) {
  if (data.planned_join_date && data.planned_leave_date && data.planned_leave_date < data.planned_join_date) {
    throw { statusCode: 400, message: 'Ngày rời tàu dự kiến phải sau hoặc bằng ngày xuống tàu' }
  }
  if (data.budget_monthly_usd != null || data.budget_total_usd != null) {
    const months = monthsBetween(data.planned_join_date, data.planned_leave_date)
    const split = data.budget_total_usd != null && data.budget_monthly_usd != null
      ? { total: round2(data.budget_total_usd), monthly: round2(data.budget_monthly_usd) }
      : splitBudget({ total: data.budget_total_usd, monthly: data.budget_monthly_usd, months })
    data.budget_total_usd = split.total
    data.budget_monthly_usd = split.monthly
  }
  return data
}

async function writeRequirements(conn, table, key, id, rows) {
  await conn.query(`DELETE FROM ${table} WHERE ${key} = ?`, [id])
  for (const row of rows) await conn.query(`INSERT INTO ${table} SET ?`, [{ ...row, [key]: id }])
}

// Khoá ngoại sai và CHECK sai thành lỗi 400 tiếng Việt.
async function refGuard(promise) {
  try {
    return await promise
  } catch (error) {
    if (error.code === '23503') throw { statusCode: 400, message: 'Chủ tàu, tàu, chức danh, cảng, người phụ trách hoặc loại giấy không tồn tại' }
    if (error.code === '23514') throw { statusCode: 400, message: 'Dữ liệu cơ hội không hợp lệ' }
    throw error
  }
}

// Giấy tờ, chứng chỉ, kinh nghiệm của nhiều thuyền viên một lần, để đối chiếu hồ sơ yêu cầu.
async function loadFitInputs(pool, seafarerIds, today) {
  const ids = [...new Set(seafarerIds)].filter(Boolean)
  const out = new Map(ids.map((id) => [id, { seafarer: {}, certificates: [], experience: { rankMonths: {}, vesselTypeTrips: {} } }]))
  if (!ids.length) return out
  const [people] = await pool.query(
    `SELECT id, passport_number, passport_expiry, seaman_book_number, seaman_book_expiry, medical_cert_number, medical_cert_expiry
     FROM seafarer WHERE id IN (?)`, [ids])
  for (const p of people) out.get(p.id).seafarer = p
  const [certs] = await pool.query(
    `SELECT seafarer_id, certificate_type_id, expiry_date, no_expiry, status FROM seafarer_certificate
     WHERE seafarer_id IN (?) AND deleted_at IS NULL`, [ids])
  for (const c of certs) out.get(c.seafarer_id).certificates.push(c)
  const [history] = await pool.query(
    `SELECT ss.seafarer_id, ss.rank_id, v.vessel_type_id, ss.sign_on_date AS start, ss.sign_off_date AS "end"
     FROM sea_service ss LEFT JOIN vessel v ON v.id = ss.vessel_id
     WHERE ss.seafarer_id IN (?) AND ss.deleted_at IS NULL
     UNION ALL
     SELECT sv.seafarer_id, sv.rank_id, v.vessel_type_id, sv.join_date, sv.leave_date
     FROM seafarer_voyage sv JOIN vessel v ON v.id = sv.vessel_id
     WHERE sv.seafarer_id IN (?) AND sv.deleted_at IS NULL`, [ids, ids])
  const bySeafarer = new Map()
  for (const h of history) bySeafarer.set(h.seafarer_id, [...(bySeafarer.get(h.seafarer_id) || []), h])
  for (const [id, rows] of bySeafarer) out.get(id).experience = experienceFromHistory(rows, today)
  return out
}

const opportunityService = {
  async list(pool, query) {
    const { page, limit, offset } = paging(query)
    const params = []
    let where = 'WHERE o.deleted_at IS NULL'
    if (query.ownerId) { where += ' AND o.created_by = ?'; params.push(Number(query.ownerId)) }
    if (query.search) {
      where += ` AND (unaccent(o.code::text) ILIKE unaccent(?) OR unaccent(r.name_vi::text) ILIKE unaccent(?)
        OR unaccent(COALESCE(ves.vessel_name, '')::text) ILIKE unaccent(?) OR unaccent(so.company_name::text) ILIKE unaccent(?))`
      params.push(...Array(4).fill(`%${query.search}%`))
    }
    for (const key of ['vessel_id', 'ship_owner_id', 'rank_id', 'owner_user_id']) {
      if (query[key]) { where += ` AND o.${key} = ?`; params.push(Number(query[key])) }
    }
    if (query.deadline_before) { where += ' AND o.deadline <= ?'; params.push(query.deadline_before) }
    const [rows] = await pool.query(`${LIST_SELECT} ${where} ORDER BY (o.status = 'OPEN') DESC, o.deadline ASC, o.id ASC`, params)
    const all = rows.map(decorate)
    const recentWon = (row) => row.status === 'WON' && (Date.now() - new Date(row.updated_at).getTime()) <= RECENT_WON_DAYS * 86400000
    const tabs = {
      open: (row) => row.status === 'OPEN' || recentWon(row),
      won: (row) => row.status === 'WON',
      lost: (row) => row.status === 'LOST',
      cancelled: (row) => row.status === 'CANCELLED',
      all: () => true,
    }
    const counts = Object.fromEntries(Object.entries(tabs).map(([key, test]) => [key, all.filter(test).length]))
    const filtered = all.filter(tabs[query.tab] || tabs.open)
    return { data: filtered.slice(offset, offset + limit), total: filtered.length, counts, page, limit }
  },

  async get(pool, id) {
    const [[row]] = await pool.query(`${LIST_SELECT} WHERE o.id = ? AND o.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    const today = row.today
    const [requirements] = await pool.query(REQUIREMENT_SELECT('opportunity_requirement', 'opportunity_id'), [id])
    const [candidateRows] = await pool.query(
      `SELECT c.id, c.seafarer_id, s.full_name, s.seafarer_code, s.status AS seafarer_status, s.current_rank_id,
              cr.name_vi AS current_rank_name, c.status, c.source, c.owner_selected_at, c.owner_selected_by,
              c.export_pack_id, ep.created_at AS export_pack_created_at, c.last_sent_at, c.created_at,
              (SELECT sv.planned_leave_date FROM seafarer_voyage sv
                 WHERE sv.seafarer_id = c.seafarer_id AND sv.status = 'ONBOARD' AND sv.deleted_at IS NULL LIMIT 1) AS onboard_until
       FROM opportunity_candidate c
       JOIN seafarer s ON s.id = c.seafarer_id
       LEFT JOIN "rank" cr ON cr.id = s.current_rank_id
       LEFT JOIN export_pack ep ON ep.id = c.export_pack_id AND ep.deleted_at IS NULL
       WHERE c.opportunity_id = ? AND c.status <> 'REMOVED'
       ORDER BY (c.owner_selected_at IS NULL), c.created_at, c.id`, [id])
    const fits = await loadFitInputs(pool, candidateRows.map((c) => c.seafarer_id), today)
    const dates = { join: iso(row.planned_join_date), leave: iso(row.planned_leave_date) }
    const candidates = candidateRows.map((c) => ({
      ...c,
      export_pack: c.export_pack_id && c.export_pack_created_at ? { id: c.export_pack_id, created_at: c.export_pack_created_at } : null,
      fit: requirementFit({ ...fits.get(c.seafarer_id), requirements, dates }),
    }))
    const [sends] = await pool.query(
      `SELECT os.id, os.to_email, os.subject, os.candidate_ids, os.export_pack_ids, os.sent_at, os.sent_by, u.email AS sent_by_email
       FROM opportunity_send os LEFT JOIN "user" u ON u.id = os.sent_by
       WHERE os.opportunity_id = ? ORDER BY os.sent_at DESC, os.id DESC`, [id])
    const opportunity = decorate(row)
    opportunity.display_status = displayStatus({ status: row.status, candidates })
    return {
      ...opportunity,
      months: monthsBetween(dates.join, dates.leave),
      requirements,
      candidates,
      sends,
      voyage: row.voyage_id ? { id: row.voyage_id, code: row.voyage_code } : null,
    }
  },

  // Hồ sơ yêu cầu điền sẵn: yêu cầu chứng chỉ của tàu theo chức danh, không có thì mẫu của chức danh.
  async presets(pool, { vessel_id: vesselId, rank_id: rankId }) {
    if (!rankId) return { source: 'NONE', requirements: [] }
    if (vesselId) {
      const [rows] = await pool.query(
        `SELECT 'CERTIFICATE' AS kind, q.certificate_type_id, ct.code AS certificate_code, ct.name_vi AS certificate_name,
                ct.category AS certificate_category, CASE WHEN q.is_mandatory = 1 THEN 'REQUIRED' ELSE 'PREFERRED' END AS level,
                'LEAVE' AS valid_until
         FROM vessel_certificate_requirement q JOIN certificate_type ct ON ct.id = q.certificate_type_id
         WHERE q.vessel_id = ? AND q.rank_id = ? ORDER BY q.id`, [vesselId, rankId])
      if (rows.length) return { source: 'VESSEL', requirements: rows }
    }
    const [rows] = await pool.query(REQUIREMENT_SELECT('rank_requirement_preset', 'preset_rank_id'), [rankId])
    return { source: rows.length ? 'RANK' : 'NONE', requirements: rows }
  },

  async savePreset(pool, rankId, body) {
    const rows = parseRequirements(body.requirements)
    await refGuard(withTransaction(pool, (conn) => writeRequirements(conn, 'rank_requirement_preset', 'preset_rank_id', rankId, rows)))
    return this.presets(pool, { rank_id: rankId })
  },

  async create(pool, body, userId) {
    const data = normalizeCore(pickAllowed(body, OPPORTUNITY_COLUMNS))
    const requirements = parseRequirements(body.requirements)
    if (!data.owner_user_id) data.owner_user_id = userId
    const id = await refGuard(withTransaction(pool, async (conn) => {
      const code = await nextCode(conn, 'OPPORTUNITY', new Date().getUTCFullYear(), 'CH', 3)
      const [result] = await conn.query('INSERT INTO opportunity SET ?', [{ ...data, code, status: 'OPEN', created_by: userId ?? null, updated_by: userId ?? null }])
      await writeRequirements(conn, 'opportunity_requirement', 'opportunity_id', result.insertId, requirements)
      return result.insertId
    }))
    return this.get(pool, id)
  },

  async update(pool, id, body, userId) {
    const patch = pickAllowed(body, OPPORTUNITY_COLUMNS)
    const requirements = body.requirements === undefined ? null : parseRequirements(body.requirements)
    await refGuard(withTransaction(pool, async (conn) => {
      const [[current]] = await conn.query('SELECT * FROM opportunity WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
      if (!current) throw { statusCode: 404, message: NOT_FOUND }
      if (current.status !== 'OPEN') throw { statusCode: 409, message: 'Cơ hội đã đóng, không sửa được' }
      const merged = { ...current, planned_join_date: iso(current.planned_join_date), planned_leave_date: iso(current.planned_leave_date), ...patch }
      // Đổi ngày mà không gửi budget: giữ budget/tháng, tính lại cả chuyến.
      if (patch.budget_monthly_usd == null && patch.budget_total_usd == null) merged.budget_total_usd = null
      if (patch.budget_monthly_usd == null && patch.budget_total_usd != null) merged.budget_monthly_usd = null
      if (patch.budget_total_usd == null && patch.budget_monthly_usd != null) merged.budget_total_usd = null
      const data = normalizeCore(merged)
      const fields = Object.fromEntries(OPPORTUNITY_COLUMNS.map((key) => [key, data[key]]))
      await conn.query('UPDATE opportunity SET ? WHERE id = ?', [{ ...fields, updated_by: userId ?? null }, id])
      if (requirements) await writeRequirements(conn, 'opportunity_requirement', 'opportunity_id', id, requirements)
    }))
    return this.get(pool, id)
  },

  // Nhân bản cho vị trí khác: chép mọi thứ trừ ứng viên và lịch sử gửi.
  async duplicate(pool, id, body, userId) {
    const newId = await refGuard(withTransaction(pool, async (conn) => {
      const [[current]] = await conn.query('SELECT * FROM opportunity WHERE id = ? AND deleted_at IS NULL', [id])
      if (!current) throw { statusCode: 404, message: NOT_FOUND }
      const data = Object.fromEntries(OPPORTUNITY_COLUMNS.map((key) => [key, current[key]]))
      if (body?.rank_id) data.rank_id = body.rank_id
      const code = await nextCode(conn, 'OPPORTUNITY', new Date().getUTCFullYear(), 'CH', 3)
      const [result] = await conn.query('INSERT INTO opportunity SET ?', [{ ...data, code, status: 'OPEN', created_by: userId ?? null, updated_by: userId ?? null }])
      await conn.query(
        `INSERT INTO opportunity_requirement (opportunity_id, ${REQUIREMENT_COLUMNS.join(', ')}, sort_order)
         SELECT ?, ${REQUIREMENT_COLUMNS.join(', ')}, sort_order FROM opportunity_requirement WHERE opportunity_id = ?`,
        [result.insertId, id])
      return result.insertId
    }))
    return this.get(pool, newId)
  },

  async close(pool, id, { outcome, reason }, userId) {
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (outcome === 'LOST' && !text) throw { statusCode: 400, message: 'Nhập lý do không thành' }
    const [res] = await pool.query(
      `UPDATE opportunity SET status = ?, close_reason = ?, updated_by = ?
       WHERE id = ? AND deleted_at IS NULL AND status = 'OPEN'`,
      [outcome, text || null, userId ?? null, id])
    if (!res.affectedRows) await this.assertState(pool, id, 'Chỉ đóng được cơ hội đang mở')
    return this.get(pool, id)
  },

  async reopen(pool, id, userId) {
    const [res] = await pool.query(
      `UPDATE opportunity SET status = 'OPEN', close_reason = NULL, updated_by = ?
       WHERE id = ? AND deleted_at IS NULL AND status IN ('LOST', 'CANCELLED')`,
      [userId ?? null, id])
    if (!res.affectedRows) await this.assertState(pool, id, 'Chỉ mở lại được cơ hội không thành hoặc đã huỷ')
    return this.get(pool, id)
  },

  async remove(pool, id) {
    const [[current]] = await pool.query('SELECT status FROM opportunity WHERE id = ? AND deleted_at IS NULL', [id])
    if (!current) throw { statusCode: 404, message: NOT_FOUND }
    if (current.status !== 'OPEN') throw { statusCode: 409, message: 'Chỉ xoá được cơ hội đang mở' }
    const [sent] = await pool.query('SELECT 1 FROM opportunity_send WHERE opportunity_id = ? LIMIT 1', [id])
    if (sent.length) throw { statusCode: 409, message: 'Cơ hội đã gửi chủ tàu, đóng cơ hội thay vì xoá' }
    await pool.query('UPDATE opportunity SET deleted_at = NOW() WHERE id = ?', [id])
    return { success: true }
  },

  // Không cập nhật được: 404 nếu không có, 409 nếu sai trạng thái.
  async assertState(pool, id, message) {
    const [[row]] = await pool.query('SELECT id FROM opportunity WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    throw { statusCode: 409, message }
  },
}

module.exports = { opportunityService, OPPORTUNITY_COLUMNS, parseRequirements, loadFitInputs }
