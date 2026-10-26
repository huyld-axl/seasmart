const { pickAllowed, paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { nextCode } = require('../utils/code_counter')
const { monthsBetween, splitBudget, round2 } = require('../utils/voyage_math')
const { displayStatus, deadlineFlag, requirementFit, experienceFromHistory, compareSuggestions } = require('../utils/opportunity_rules')
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
// Đề xuất: lọc bằng SQL trước, đối chiếu hồ sơ yêu cầu tối đa ngần này người rồi mới xếp và chia trang.
const SUGGEST_POOL = 500
const SUGGEST_LIMIT = 50
const MAX_ADD = 50

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

  // ---------- Ứng viên ----------

  // Cơ hội còn mở, khoá dòng trong transaction. Dùng cho mọi thao tác trên ứng viên.
  async lockOpen(conn, id) {
    const [[row]] = await conn.query('SELECT * FROM opportunity WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    if (row.status !== 'OPEN') throw { statusCode: 409, message: 'Cơ hội đã đóng, không đổi được danh sách ứng viên' }
    return row
  },

  async addCandidates(pool, id, { seafarer_ids: seafarerIds, source = 'SEARCH' }, userId) {
    const ids = [...new Set(seafarerIds || [])]
    if (!ids.length || ids.length > MAX_ADD) throw { statusCode: 400, message: `Chọn từ 1 tới ${MAX_ADD} thuyền viên` }
    await withTransaction(pool, async (conn) => {
      await this.lockOpen(conn, id)
      const [people] = await conn.query('SELECT id, full_name, status FROM seafarer WHERE id IN (?) AND deleted_at IS NULL', [ids])
      if (people.length !== ids.length) throw { statusCode: 400, message: 'Không tìm thấy thuyền viên' }
      const inactive = people.filter((p) => p.status === 'INACTIVE').map((p) => p.full_name)
      if (inactive.length) throw { statusCode: 409, message: `${inactive.join(', ')} đang tạm ngưng, kích hoạt lại trước khi thêm` }
      for (const seafarerId of ids) {
        // Người đã bỏ thì về lại danh sách; người đang có thì giữ nguyên.
        await conn.query(
          `INSERT INTO opportunity_candidate (opportunity_id, seafarer_id, status, source, added_by) VALUES (?, ?, 'PICKED', ?, ?)
           ON CONFLICT (opportunity_id, seafarer_id) DO UPDATE SET status = 'PICKED', source = EXCLUDED.source, added_by = EXCLUDED.added_by
           WHERE opportunity_candidate.status = 'REMOVED'`,
          [id, seafarerId, source, userId ?? null])
      }
    })
    return this.get(pool, id)
  },

  async removeCandidate(pool, id, seafarerId) {
    await withTransaction(pool, async (conn) => {
      await this.lockOpen(conn, id)
      const [res] = await conn.query(
        `UPDATE opportunity_candidate SET status = 'REMOVED', owner_selected_at = NULL, owner_selected_by = NULL
         WHERE opportunity_id = ? AND seafarer_id = ? AND status = 'PICKED'`, [id, seafarerId])
      if (!res.affectedRows) throw { statusCode: 404, message: 'Người này không có trong danh sách ứng viên' }
    })
    return this.get(pool, id)
  },

  // Nhãn Chủ tàu đã chọn: tối đa một người mỗi cơ hội, gắn cho người khác thì nhãn chuyển sang.
  async setOwnerSelected(pool, id, seafarerId, selected, userId) {
    await withTransaction(pool, async (conn) => {
      await this.lockOpen(conn, id)
      if (selected) {
        await conn.query(
          `UPDATE opportunity_candidate SET owner_selected_at = NULL, owner_selected_by = NULL
           WHERE opportunity_id = ? AND seafarer_id <> ? AND owner_selected_at IS NOT NULL`, [id, seafarerId])
      }
      const [res] = await conn.query(
        `UPDATE opportunity_candidate SET owner_selected_at = ${selected ? 'NOW()' : 'NULL'}, owner_selected_by = ?
         WHERE opportunity_id = ? AND seafarer_id = ? AND status = 'PICKED'`,
        [selected ? userId ?? null : null, id, seafarerId])
      if (!res.affectedRows) throw { statusCode: 404, message: 'Người này không có trong danh sách ứng viên' }
    })
    return this.get(pool, id)
  },

  // Ghi nhận đã gửi chủ tàu (người làm gửi bằng app mail của máy rồi bấm "Đã gửi").
  async recordSend(pool, id, body, userId) {
    const ids = [...new Set(body.candidate_ids || [])]
    if (!ids.length) throw { statusCode: 400, message: 'Chọn ít nhất một ứng viên' }
    await withTransaction(pool, async (conn) => {
      await this.lockOpen(conn, id)
      const [rows] = await conn.query(
        `SELECT c.id, c.export_pack_id, s.full_name FROM opportunity_candidate c JOIN seafarer s ON s.id = c.seafarer_id
         WHERE c.opportunity_id = ? AND c.id IN (?) AND c.status = 'PICKED'`, [id, ids])
      if (rows.length !== ids.length) throw { statusCode: 400, message: 'Có ứng viên không thuộc danh sách của cơ hội này' }
      const missing = rows.filter((r) => !r.export_pack_id).map((r) => r.full_name)
      if (missing.length) throw { statusCode: 409, message: `Chưa có bản xuất: ${missing.join(', ')}` }
      if (body.ship_owner_contact_id) {
        const [[contact]] = await conn.query(
          'SELECT c.id FROM ship_owner_contact c JOIN opportunity o ON o.ship_owner_id = c.ship_owner_id WHERE c.id = ? AND o.id = ?',
          [body.ship_owner_contact_id, id])
        if (!contact) throw { statusCode: 400, message: 'Người liên hệ không thuộc chủ tàu của cơ hội' }
      }
      await conn.query('INSERT INTO opportunity_send SET ?', [{
        opportunity_id: id,
        ship_owner_contact_id: body.ship_owner_contact_id || null,
        to_email: body.to_email,
        subject: body.subject,
        candidate_ids: rows.map((r) => r.id),
        export_pack_ids: rows.map((r) => r.export_pack_id),
        sent_by: userId,
      }])
      await conn.query('UPDATE opportunity_candidate SET last_sent_at = NOW() WHERE id IN (?)', [rows.map((r) => r.id)])
    })
    return this.get(pool, id)
  },

  // ---------- Đề xuất ứng viên (mục 1.7) ----------
  async suggestions(pool, id, query) {
    const opportunity = await this.get(pool, id)
    const { page, limit, offset } = paging({ page: query.page, limit: query.limit || SUGGEST_LIMIT })
    const params = []
    let where = "WHERE s.deleted_at IS NULL AND s.status <> 'INACTIVE'"
    if (query.ownerId) { where += ' AND s.created_by = ?'; params.push(Number(query.ownerId)) }
    if (query.search) {
      where += ' AND (unaccent(s.full_name::text) ILIKE unaccent(?) OR s.seafarer_code ILIKE ? OR s.passport_number ILIKE ?)'
      params.push(...Array(3).fill(`%${query.search}%`))
    }
    if (query.rank_id) { where += ' AND s.current_rank_id = ?'; params.push(Number(query.rank_id)) }
    if (query.nationality_id) { where += ' AND s.nationality_id = ?'; params.push(Number(query.nationality_id)) }
    if (query.age_min) { where += " AND s.date_of_birth <= CURRENT_DATE - (? * INTERVAL '1 year')"; params.push(Number(query.age_min)) }
    if (query.age_max) { where += " AND s.date_of_birth > CURRENT_DATE - ((? + 1) * INTERVAL '1 year')"; params.push(Number(query.age_max)) }
    // Rảnh trước ngày: không có chuyến đang trên tàu, hoặc chuyến đó rời dự kiến trước ngày này.
    if (query.free_before) { where += ' AND (ob.id IS NULL OR ob.planned_leave_date <= ?)'; params.push(query.free_before) }
    if (query.worked_with_owner) {
      where += ' AND EXISTS (SELECT 1 FROM seafarer_voyage w WHERE w.seafarer_id = s.id AND w.ship_owner_id = ? AND w.deleted_at IS NULL)'
      params.push(opportunity.ship_owner_id)
    }
    if (query.vessel_type_id) {
      where += ` AND (EXISTS (SELECT 1 FROM seafarer_voyage w JOIN vessel v ON v.id = w.vessel_id WHERE w.seafarer_id = s.id AND w.deleted_at IS NULL AND v.vessel_type_id = ?)
        OR EXISTS (SELECT 1 FROM sea_service w JOIN vessel v ON v.id = w.vessel_id WHERE w.seafarer_id = s.id AND w.deleted_at IS NULL AND v.vessel_type_id = ?))`
      params.push(Number(query.vessel_type_id), Number(query.vessel_type_id))
    }
    const [people] = await pool.query(
      `SELECT s.id, s.full_name, s.seafarer_code, s.status, s.current_rank_id, r.name_vi AS rank_name, s.date_of_birth,
              ob.id AS onboard_voyage_id, ob.planned_leave_date AS onboard_until, obv.vessel_name AS onboard_vessel_name,
              to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today
       FROM seafarer s
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
       LEFT JOIN seafarer_voyage ob ON ob.seafarer_id = s.id AND ob.status = 'ONBOARD' AND ob.deleted_at IS NULL
       LEFT JOIN vessel obv ON obv.id = ob.vessel_id
       ${where}
       ORDER BY s.full_name LIMIT ${SUGGEST_POOL}`, params)
    const ids = people.map((p) => p.id)
    const today = people[0]?.today
    const fits = await loadFitInputs(pool, ids, today)
    const [owners] = ids.length
      ? await pool.query(
        `SELECT seafarer_id, COUNT(*) AS n FROM seafarer_voyage WHERE seafarer_id IN (?) AND ship_owner_id = ? AND deleted_at IS NULL GROUP BY seafarer_id`,
        [ids, opportunity.ship_owner_id])
      : [[]]
    const ownerTrips = new Map(owners.map((o) => [o.seafarer_id, Number(o.n)]))
    // Người đang được giữ chỗ ở cơ hội khác có khoảng dự kiến giao với cơ hội này.
    const [held] = ids.length
      ? await pool.query(
        `SELECT c.seafarer_id, o.code FROM opportunity_candidate c JOIN opportunity o ON o.id = c.opportunity_id
         WHERE c.seafarer_id IN (?) AND c.owner_selected_at IS NOT NULL AND c.status = 'PICKED' AND o.status = 'OPEN'
           AND o.deleted_at IS NULL AND o.id <> ? AND o.planned_join_date <= ? AND o.planned_leave_date >= ?`,
        [ids, id, iso(opportunity.planned_leave_date), iso(opportunity.planned_join_date)])
      : [[]]
    const heldBy = new Map(held.map((h) => [h.seafarer_id, h.code]))
    const inList = new Set(opportunity.candidates.map((c) => c.seafarer_id))
    const dates = { join: iso(opportunity.planned_join_date), leave: iso(opportunity.planned_leave_date) }
    const reqName = new Map(opportunity.requirements.map((r) => [r.id, r.certificate_name || r.rank_name || r.vessel_type_name]))
    const vesselType = opportunity.vessel_id
      ? (await pool.query('SELECT v.vessel_type_id, vt.name_vi FROM vessel v LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id WHERE v.id = ?', [opportunity.vessel_id]))[0][0]
      : null
    let rows = people.map((p) => {
      const input = fits.get(p.id)
      const fit = requirementFit({ ...input, requirements: opportunity.requirements, dates })
      const reasons = []
      if (ownerTrips.get(p.id)) reasons.push({ tone: 'good', text: `${ownerTrips.get(p.id)} chuyến với ${opportunity.ship_owner_name}` })
      const typeTrips = vesselType?.vessel_type_id ? input.experience.vesselTypeTrips[vesselType.vessel_type_id] : 0
      if (typeTrips) reasons.push({ tone: 'good', text: `Tàu ${vesselType.name_vi} ${typeTrips} chuyến` })
      for (const item of fit.items) {
        if (item.state === 'missing') reasons.push({ tone: 'miss', text: `Thiếu ${reqName.get(item.requirement_id)}` })
        if (item.state === 'expires_early') reasons.push({ tone: 'miss', text: `${reqName.get(item.requirement_id)} hết hạn ${item.expiry}` })
      }
      const freeFrom = p.onboard_voyage_id ? iso(p.onboard_until) : null
      const { today: _today, ...person } = p
      return { ...person, free_from: freeFrom, fit, reasons, held_by: heldBy.get(p.id) || null, in_list: inList.has(p.id), today, join: dates.join }
    })
    if (query.required_ok) rows = rows.filter((r) => r.fit.required.ok === r.fit.required.total)
    rows.sort(compareSuggestions)
    const data = rows.slice(offset, offset + limit).map(({ today: _t, join: _j, ...rest }) => rest)
    return { data, total: rows.length, page, limit, capped: people.length >= SUGGEST_POOL }
  },

  // Không cập nhật được: 404 nếu không có, 409 nếu sai trạng thái.
  async assertState(pool, id, message) {
    const [[row]] = await pool.query('SELECT id FROM opportunity WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    throw { statusCode: 409, message }
  },
}

module.exports = { opportunityService, OPPORTUNITY_COLUMNS, parseRequirements, loadFitInputs }
