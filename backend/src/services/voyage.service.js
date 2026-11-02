// Chuyến mới: một thuyền viên đi một tàu (bảng seafarer_voyage). Bảng voyage / voyage_position cũ chỉ còn hợp đồng đọc.
const { paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { nextCode } = require('../utils/code_counter')
const { leaveFlag, daysFrom } = require('../utils/opportunity_rules')
const { MANUAL_REASONS } = require('../constants/opportunity_voyage')

const NOT_FOUND = 'Không tìm thấy chuyến tàu'
const MAX_BULK = 50
// "Sắp rời, chưa có người thay": rời dự kiến trong ngần này tháng tới.
const COVER_MONTHS = 6

const num = (v) => (v == null ? null : Number(v))
const iso = (v) => (v == null ? null : String(v instanceof Date ? v.toISOString() : v).slice(0, 10))
const actor = (userId) => userId ?? null

const VOYAGE_SELECT = `SELECT sv.id, sv.code, sv.status, sv.source, sv.manual_reason, sv.seafarer_id, s.full_name AS seafarer_name, s.seafarer_code,
    s.status AS seafarer_status, sv.rank_id, r.name_vi AS rank_name, sv.vessel_id, ves.vessel_name, ves.vessel_type_id,
    sv.ship_owner_id, so.company_name AS ship_owner_name, sv.opportunity_id, o.code AS opportunity_code,
    o.planned_join_date AS opportunity_join_date, sv.budget_monthly_usd,
    sv.join_date, sv.join_port_id, jp.name AS join_port_name, sv.planned_leave_date, sv.planned_leave_port_id, plp.name AS planned_leave_port_name,
    sv.original_leave_date, sv.leave_date, sv.leave_port_id, lp.name AS leave_port_name, sv.leave_note, sv.notes,
    sv.legacy_voyage_id, sv.legacy_contract_id, lc.contract_number AS legacy_contract_number, lc.status AS legacy_contract_status,
    sv.created_by, sv.created_at, sv.updated_at, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today
  FROM seafarer_voyage sv
  JOIN seafarer s ON s.id = sv.seafarer_id
  JOIN "rank" r ON r.id = sv.rank_id
  JOIN vessel ves ON ves.id = sv.vessel_id
  JOIN ship_owner so ON so.id = sv.ship_owner_id
  LEFT JOIN opportunity o ON o.id = sv.opportunity_id
  LEFT JOIN port jp ON jp.id = sv.join_port_id
  LEFT JOIN port plp ON plp.id = sv.planned_leave_port_id
  LEFT JOIN port lp ON lp.id = sv.leave_port_id
  LEFT JOIN seafarer_contract lc ON lc.id = sv.legacy_contract_id AND lc.deleted_at IS NULL`

// Chuyến đã rời mà hợp đồng chưa kết thúc còn tới sau ngày rời: chỉ là nhãn cảnh báo.
function dateMismatch(voyage, contract) {
  if (!contract || voyage.status !== 'LEFT' || contract.status === 'ENDED') return null
  const leave = iso(voyage.leave_date)
  const end = iso(contract.end_date)
  return end > leave ? { leave_date: leave, end_date: end } : null
}

// Lệch so với dự kiến: lên tàu so với ngày xuống dự kiến của cơ hội, rời so với ngày rời gốc.
function decorate(row) {
  const { today, ...rest } = row
  const join = iso(row.join_date)
  const opportunityJoin = iso(row.opportunity_join_date)
  const baseLeave = iso(row.original_leave_date) || iso(row.planned_leave_date)
  return {
    ...rest,
    budget_monthly_usd: num(row.budget_monthly_usd),
    join_delta_days: opportunityJoin ? daysFrom(opportunityJoin, join) : null,
    leave_delta_days: row.leave_date ? daysFrom(baseLeave, iso(row.leave_date)) : null,
    leave_flag: leaveFlag({ status: row.status, planned_leave_date: iso(row.planned_leave_date), today }),
  }
}

// Điều kiện "chuyến giao với [from, to]" (mục 4.6), dùng chung danh sách và thẻ Đội ngũ.
function rangeClause(from, to, params) {
  let sql = ''
  if (to) { sql += ' AND sv.join_date <= ?'; params.push(to) }
  if (from) { sql += ' AND COALESCE(sv.leave_date, sv.planned_leave_date) >= ?'; params.push(from) }
  return sql
}

async function refGuard(promise) {
  try {
    return await promise
  } catch (error) {
    if (error.code === '23503') throw { statusCode: 400, message: 'Thuyền viên, tàu, chủ tàu, cảng hoặc chức danh không tồn tại' }
    if (error.code === '23505') throw { statusCode: 409, message: 'Thuyền viên này đã có chuyến đang trên tàu' }
    if (error.code === '23514') throw { statusCode: 400, message: 'Ngày của chuyến không hợp lệ' }
    throw error
  }
}

const writeLog = (conn, voyageId, action, userId, payload = null) =>
  conn.query('INSERT INTO seafarer_voyage_log SET ?', [{ voyage_id: voyageId, action, actor_id: actor(userId), payload: payload && JSON.stringify(payload) }])

async function todayOf(conn) {
  const [[{ today }]] = await conn.query('SELECT to_char(CURRENT_DATE, \'YYYY-MM-DD\') AS today')
  return today
}

// Không còn chuyến ONBOARD nào thì thuyền viên về Ở bờ (không đụng người tạm ngưng).
async function settleSeafarer(conn, seafarerId) {
  await conn.query(
    `UPDATE seafarer SET status = 'AVAILABLE' WHERE id = ? AND status = 'ON_VESSEL'
     AND NOT EXISTS (SELECT 1 FROM seafarer_voyage WHERE seafarer_id = ? AND status = 'ONBOARD' AND deleted_at IS NULL)`,
    [seafarerId, seafarerId])
}

// Hợp đồng chưa xoá của chuyến, kèm số bill chưa xoá. lock: khoá dòng khi sắp xoá.
async function contractsOfVoyage(conn, voyageId, lock = false) {
  const [rows] = await conn.query(
    `SELECT c.id, c.contract_number, c.status,
        (SELECT COUNT(*) FROM contract_bill b WHERE b.contract_id = c.id AND b.deleted_at IS NULL) AS bills
     FROM seafarer_contract c WHERE c.seafarer_voyage_id = ? AND c.deleted_at IS NULL${lock ? ' FOR UPDATE OF c' : ''}`, [voyageId])
  return rows.map((c) => ({ ...c, bills: Number(c.bills) }))
}

// Hợp đồng đã hiệu lực (hoặc đã có bill) thì chuyến không huỷ được; còn lại bị xoá mềm theo chuyến.
function splitContractsForRemoval(contracts) {
  const blocking = contracts.find((c) => ['ACTIVE', 'ENDED'].includes(c.status) || c.bills > 0)
  return { blocking, toDelete: blocking ? [] : contracts }
}

async function lockVoyage(conn, id) {
  const [[row]] = await conn.query('SELECT * FROM seafarer_voyage WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
  if (!row) throw { statusCode: 404, message: NOT_FOUND }
  return row
}

// Ghi rời tàu một chuyến đang ONBOARD trong transaction có sẵn.
async function leaveOne(conn, current, { leave_date: leaveDate, leave_port_id: leavePortId, leave_note: note }, userId, action = 'LEAVE') {
  if (current.status !== 'ONBOARD') throw { statusCode: 409, message: `Chuyến ${current.code} đã rời tàu` }
  if (leaveDate < iso(current.join_date)) throw { statusCode: 400, message: 'Ngày rời tàu phải sau hoặc bằng ngày lên tàu' }
  await conn.query(
    'UPDATE seafarer_voyage SET status = \'LEFT\', leave_date = ?, leave_port_id = ?, leave_note = ?, updated_by = ? WHERE id = ?',
    [leaveDate, leavePortId, note || null, actor(userId), current.id])
  await writeLog(conn, current.id, action, userId, { leave_date: leaveDate, leave_port_id: leavePortId, note: note || null })
  await settleSeafarer(conn, current.seafarer_id)
}

const voyageService = {
  async list(pool, query) {
    const { page, limit, offset } = paging(query)
    const params = []
    let where = 'WHERE sv.deleted_at IS NULL'
    if (query.ownerId) { where += ' AND sv.created_by = ?'; params.push(Number(query.ownerId)) }
    if (query.search) {
      where += ' AND (unaccent(s.full_name::text) ILIKE unaccent(?) OR sv.code ILIKE ? OR s.seafarer_code ILIKE ?)'
      params.push(...Array(3).fill(`%${query.search}%`))
    }
    for (const key of ['vessel_id', 'ship_owner_id', 'rank_id', 'seafarer_id']) {
      if (query[key]) { where += ` AND sv.${key} = ?`; params.push(Number(query[key])) }
    }
    if (query.source) { where += ' AND sv.source = ?'; params.push(query.source) }
    // Ô Chuyến của form hợp đồng: chỉ chuyến chưa có hợp đồng chưa xoá.
    if (query.no_contract) where += ' AND NOT EXISTS (SELECT 1 FROM seafarer_contract c WHERE c.seafarer_voyage_id = sv.id AND c.deleted_at IS NULL)'
    if (query.leaving_within) {
      where += ' AND sv.status = \'ONBOARD\' AND sv.planned_leave_date <= CURRENT_DATE + (? * INTERVAL \'1 day\')'
      params.push(Number(query.leaving_within))
    }
    where += rangeClause(query.from, query.to, params)
    const [rows] = await pool.query(`${VOYAGE_SELECT} ${where} ORDER BY (sv.status = 'ONBOARD') DESC, sv.planned_leave_date ASC, sv.id ASC`, params)
    const all = rows.map(decorate)
    const counts = { onboard: 0, left: 0, all: all.length }
    for (const row of all) counts[row.status === 'ONBOARD' ? 'onboard' : 'left'] += 1
    const tab = query.tab || 'all'
    const filtered = tab === 'all' ? all : all.filter((row) => (tab === 'onboard' ? row.status === 'ONBOARD' : row.status === 'LEFT'))
    return { data: filtered.slice(offset, offset + limit), total: filtered.length, counts, page, limit }
  },

  async get(pool, id) {
    const [[row]] = await pool.query(`${VOYAGE_SELECT} WHERE sv.id = ? AND sv.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    const voyage = decorate(row)
    const [history] = await pool.query(
      `SELECT l.id, l.action, l.payload, l.created_at, l.actor_id, u.email AS actor_email
       FROM seafarer_voyage_log l LEFT JOIN "user" u ON u.id = l.actor_id
       WHERE l.voyage_id = ? ORDER BY l.created_at DESC, l.id DESC`, [id])
    const [[contract]] = await pool.query(
      `SELECT c.id, c.contract_number, c.status, c.start_date, c.end_date,
          (SELECT COALESCE(SUM(i.receivable_usd), 0) - COALESCE(SUM(i.payable_usd), 0) FROM contract_item i WHERE i.contract_id = c.id AND i.kind = 'MONTHLY') AS diff_monthly
       FROM seafarer_contract c WHERE c.seafarer_voyage_id = ? AND c.deleted_at IS NULL`, [id])
    return {
      ...voyage,
      opportunity: row.opportunity_id ? { id: row.opportunity_id, code: row.opportunity_code, planned_join_date: row.opportunity_join_date } : null,
      contract: contract ? { ...contract, diff_monthly: Number(contract.diff_monthly) } : null,
      date_mismatch: dateMismatch(voyage, contract),
      legacy_contract: row.legacy_contract_id
        ? { id: row.legacy_contract_id, contract_number: row.legacy_contract_number, status: row.legacy_contract_status }
        : null,
      history,
    }
  },

  // Tạo chuyến không qua cơ hội (mục 1.4): chủ tàu tự tuyển, nhập chuyến cũ, khác.
  async create(pool, body, userId) {
    if (!MANUAL_REASONS.includes(body.manual_reason)) throw { statusCode: 400, message: 'Chọn lý do tạo chuyến' }
    if (body.manual_reason === 'OTHER' && !String(body.notes || '').trim()) throw { statusCode: 400, message: 'Lý do Khác cần ghi chú' }
    if (body.planned_leave_date < body.join_date) throw { statusCode: 400, message: 'Ngày rời dự kiến phải sau hoặc bằng ngày lên tàu' }
    const ended = body.ended === true
    if (ended && (!body.leave_date || !body.leave_port_id)) throw { statusCode: 400, message: 'Chuyến đã kết thúc cần ngày và nơi rời tàu' }
    if (ended && body.leave_date < body.join_date) throw { statusCode: 400, message: 'Ngày rời tàu phải sau hoặc bằng ngày lên tàu' }
    const result = await refGuard(withTransaction(pool, async (conn) => {
      const today = await todayOf(conn)
      if (body.join_date > today) throw { statusCode: 400, message: 'Ngày lên tàu không được sau hôm nay' }
      if (ended && body.leave_date > today) throw { statusCode: 400, message: 'Ngày rời tàu không được sau hôm nay' }
      const [[person]] = await conn.query('SELECT id, full_name, status FROM seafarer WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [body.seafarer_id])
      if (!person) throw { statusCode: 400, message: 'Không tìm thấy thuyền viên' }
      if (person.status === 'INACTIVE') throw { statusCode: 409, message: 'Thuyền viên đang tạm ngưng' }
      const endDate = ended ? body.leave_date : body.planned_leave_date
      const [[overlap]] = await conn.query(
        `SELECT sv.code FROM seafarer_voyage sv WHERE sv.seafarer_id = ? AND sv.deleted_at IS NULL AND sv.status = 'LEFT'
           AND sv.join_date <= ? AND sv.leave_date >= ? LIMIT 1`, [body.seafarer_id, endDate, body.join_date])
      if (overlap) throw { statusCode: 409, message: `${person.full_name} đã có chuyến ${overlap.code} trùng thời gian` }
      const [[onboard]] = await conn.query(
        `SELECT sv.*, v.vessel_name FROM seafarer_voyage sv JOIN vessel v ON v.id = sv.vessel_id
         WHERE sv.seafarer_id = ? AND sv.status = 'ONBOARD' AND sv.deleted_at IS NULL FOR UPDATE OF sv`,
        [body.seafarer_id])
      if (onboard && !ended) {
        throw { statusCode: 409, message: `${person.full_name} đang trên ${onboard.vessel_name}, ghi rời tàu chuyến đó trước` }
      }
      if (onboard && ended && iso(onboard.join_date) <= endDate) {
        throw { statusCode: 409, message: `${person.full_name} đã có chuyến ${onboard.code} trùng thời gian` }
      }
      const [[vessel]] = await conn.query('SELECT ship_owner_id FROM vessel WHERE id = ? AND deleted_at IS NULL', [body.vessel_id])
      if (!vessel) throw { statusCode: 400, message: 'Không tìm thấy tàu' }
      if (vessel.ship_owner_id == null) throw { statusCode: 400, message: 'Tàu này chưa có chủ tàu. Gán chủ tàu cho tàu trước khi dùng' }
      if (Number(vessel.ship_owner_id) !== Number(body.ship_owner_id)) throw { statusCode: 400, message: 'Chủ tàu không khớp với chủ tàu của tàu này' }
      const code = await nextCode(conn, 'VOYAGE1', Number(body.join_date.slice(0, 4)), 'CT', 4)
      const [inserted] = await conn.query('INSERT INTO seafarer_voyage SET ?', [{
        code,
        seafarer_id: body.seafarer_id,
        rank_id: body.rank_id,
        vessel_id: body.vessel_id,
        ship_owner_id: body.ship_owner_id,
        source: 'MANUAL',
        manual_reason: body.manual_reason,
        budget_monthly_usd: body.budget_monthly_usd ?? null,
        join_date: body.join_date,
        join_port_id: body.join_port_id,
        planned_leave_date: body.planned_leave_date,
        planned_leave_port_id: body.planned_leave_port_id || null,
        leave_date: ended ? body.leave_date : null,
        leave_port_id: ended ? body.leave_port_id : null,
        leave_note: ended ? body.leave_note || null : null,
        status: ended ? 'LEFT' : 'ONBOARD',
        notes: body.notes || null,
        created_by: actor(userId),
        updated_by: actor(userId),
      }])
      await writeLog(conn, inserted.insertId, 'CREATE', userId, { manual_reason: body.manual_reason })
      if (!ended) await conn.query('UPDATE seafarer SET status = \'ON_VESSEL\' WHERE id = ?', [body.seafarer_id])
      return inserted.insertId
    }))
    return this.get(pool, result)
  },

  // Sửa ngày đã ghi (nhập sai).
  async editDates(pool, id, body, userId) {
    await refGuard(withTransaction(pool, async (conn) => {
      const current = await lockVoyage(conn, id)
      const today = await todayOf(conn)
      const next = {
        join_date: body.join_date ?? iso(current.join_date),
        join_port_id: body.join_port_id ?? current.join_port_id,
        leave_date: current.status === 'LEFT' ? body.leave_date ?? iso(current.leave_date) : null,
        leave_port_id: current.status === 'LEFT' ? body.leave_port_id ?? current.leave_port_id : null,
      }
      if (next.join_date > today) throw { statusCode: 400, message: 'Ngày lên tàu không được sau hôm nay' }
      if (next.leave_date && next.leave_date < next.join_date) throw { statusCode: 400, message: 'Ngày rời tàu phải sau hoặc bằng ngày lên tàu' }
      if (iso(current.planned_leave_date) < next.join_date) throw { statusCode: 400, message: 'Ngày lên tàu không được sau ngày rời dự kiến' }
      await conn.query('UPDATE seafarer_voyage SET ? WHERE id = ?', [{ ...next, updated_by: actor(userId) }, id])
      const before = { join_date: iso(current.join_date), join_port_id: current.join_port_id, leave_date: iso(current.leave_date), leave_port_id: current.leave_port_id }
      await writeLog(conn, id, 'EDIT_DATES', userId, { before, after: next })
    }))
    return this.get(pool, id)
  },

  // Đổi ngày rời dự kiến; lần đầu đổi thì giữ ngày gốc để so chênh lệch.
  async leavePlan(pool, id, body, userId) {
    await withTransaction(pool, async (conn) => {
      const current = await lockVoyage(conn, id)
      if (current.status !== 'ONBOARD') throw { statusCode: 409, message: 'Chỉ đổi được ngày rời của chuyến đang trên tàu' }
      if (body.planned_leave_date < iso(current.join_date)) throw { statusCode: 400, message: 'Ngày rời dự kiến phải sau hoặc bằng ngày lên tàu' }
      await conn.query(
        'UPDATE seafarer_voyage SET planned_leave_date = ?, original_leave_date = COALESCE(original_leave_date, planned_leave_date), updated_by = ? WHERE id = ?',
        [body.planned_leave_date, actor(userId), id])
      await writeLog(conn, id, 'LEAVE_PLAN', userId, { from: iso(current.planned_leave_date), to: body.planned_leave_date, note: body.note || null })
    })
    return this.get(pool, id)
  },

  async leave(pool, id, body, userId) {
    await withTransaction(pool, async (conn) => leaveOne(conn, await lockVoyage(conn, id), body, userId))
    return this.get(pool, id)
  },

  // Ghi rời cho nhiều chuyến: sai một chuyến thì không lưu chuyến nào.
  async leaveMany(pool, body, userId) {
    const ids = [...new Set(body.voyage_ids || [])]
    if (!ids.length || ids.length > MAX_BULK) throw { statusCode: 400, message: `Chọn từ 1 tới ${MAX_BULK} chuyến` }
    await withTransaction(pool, async (conn) => {
      const [rows] = await conn.query(
        `SELECT sv.*, s.full_name FROM seafarer_voyage sv JOIN seafarer s ON s.id = sv.seafarer_id
         WHERE sv.id IN (?) AND sv.deleted_at IS NULL FOR UPDATE OF sv`, [ids])
      if (rows.length !== ids.length) throw { statusCode: 404, message: NOT_FOUND }
      const left = rows.filter((r) => r.status !== 'ONBOARD').map((r) => r.full_name)
      if (left.length) throw { statusCode: 409, message: `Đã rời tàu: ${left.join(', ')}` }
      for (const row of rows) await leaveOne(conn, row, body, userId)
    })
    return { success: true, count: ids.length }
  },

  // Xem trước huỷ chốt / xoá chuyến: hợp đồng nào bị xoá mềm, hoặc vì sao bị chặn.
  async removePreview(pool, id) {
    const [[row]] = await pool.query('SELECT id FROM seafarer_voyage WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: NOT_FOUND }
    const { blocking, toDelete } = splitContractsForRemoval(await contractsOfVoyage(pool, id))
    return {
      blocked: Boolean(blocking),
      message: blocking ? `Chuyến có hợp đồng ${blocking.contract_number} đã hiệu lực, không huỷ được` : null,
      blocking_contract: blocking ? { id: blocking.id, contract_number: blocking.contract_number, status: blocking.status } : null,
      contracts: toDelete.map((c) => ({ id: c.id, contract_number: c.contract_number, status: c.status })),
    }
  },

  // Huỷ chốt (chuyến từ cơ hội) hoặc xoá chuyến tạo tay. Hợp đồng Nháp / Chờ duyệt / Bị từ chối của chuyến bị xoá mềm theo.
  async remove(pool, id, body, userId) {
    const deleted = await withTransaction(pool, async (conn) => {
      const current = await lockVoyage(conn, id)
      const { blocking, toDelete } = splitContractsForRemoval(await contractsOfVoyage(conn, id, true))
      if (blocking) throw { statusCode: 409, message: `Chuyến có hợp đồng ${blocking.contract_number} đã hiệu lực, không huỷ được` }
      for (const contract of toDelete) {
        await conn.query('UPDATE seafarer_contract SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [actor(userId), contract.id])
        await conn.query('INSERT INTO contract_approval_log SET ?', [{
          contract_id: contract.id, action: 'DELETE', actor_id: actor(userId),
          payload: JSON.stringify({ voyage_id: id, voyage_code: current.code, status: contract.status }),
        }])
      }
      await conn.query('UPDATE seafarer_voyage SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [actor(userId), id])
      await writeLog(conn, id, 'DELETE', userId, { note: body?.note || null, deleted_contracts: toDelete.map((c) => c.contract_number) })
      if (current.status === 'ONBOARD') await settleSeafarer(conn, current.seafarer_id)
      if (current.opportunity_id) {
        await conn.query('UPDATE opportunity SET status = \'OPEN\', updated_by = ? WHERE id = ? AND status = \'WON\'', [actor(userId), current.opportunity_id])
        await conn.query(
          'UPDATE opportunity_candidate SET status = \'PICKED\' WHERE opportunity_id = ? AND status IN (\'PLACED\', \'NOT_SELECTED\')',
          [current.opportunity_id])
      }
      return toDelete
    })
    return { success: true, deleted_contracts: deleted.map((c) => ({ id: c.id, contract_number: c.contract_number, status: c.status })) }
  },

  // Thẻ Đội ngũ trên trang tàu (mục 4.8).
  async crewTimeline(pool, query) {
    const vesselId = Number(query.vessel_id)
    const list = await this.list(pool, { ...query, vessel_id: vesselId, tab: 'all', page: 1, limit: 100000 })
    const voyages = list.data
    const params = [vesselId]
    let where = 'WHERE o.vessel_id = ? AND o.status = \'OPEN\' AND o.deleted_at IS NULL'
    if (query.to) { where += ' AND o.planned_join_date <= ?'; params.push(query.to) }
    if (query.from) { where += ' AND o.planned_leave_date >= ?'; params.push(query.from) }
    if (query.rank_id) { where += ' AND o.rank_id = ?'; params.push(Number(query.rank_id)) }
    const [openings] = await pool.query(
      `SELECT o.id, o.code, o.rank_id, r.name_vi AS rank_name, o.planned_join_date, o.planned_leave_date,
              (SELECT s.full_name FROM opportunity_candidate c JOIN seafarer s ON s.id = c.seafarer_id
                 WHERE c.opportunity_id = o.id AND c.owner_selected_at IS NOT NULL AND c.status = 'PICKED' LIMIT 1) AS selected_name
       FROM opportunity o JOIN "rank" r ON r.id = o.rank_id ${where} ORDER BY o.planned_join_date, o.id`, params)
    const [[{ today, horizon }]] = await pool.query(
      'SELECT to_char(CURRENT_DATE, \'YYYY-MM-DD\') AS today, to_char(CURRENT_DATE + (? * INTERVAL \'1 month\'), \'YYYY-MM-DD\') AS horizon', [COVER_MONTHS])
    const [allOpen] = await pool.query('SELECT rank_id FROM opportunity WHERE vessel_id = ? AND status = \'OPEN\' AND deleted_at IS NULL', [vesselId])
    const coveredRanks = new Set(allOpen.map((o) => o.rank_id))
    const [onboard] = await pool.query(
      'SELECT id, rank_id, planned_leave_date FROM seafarer_voyage WHERE vessel_id = ? AND status = \'ONBOARD\' AND deleted_at IS NULL', [vesselId])
    const leaving = onboard.filter((v) => iso(v.planned_leave_date) <= horizon && !coveredRanks.has(v.rank_id))
    return {
      voyages,
      open_opportunities: openings,
      summary: {
        onboard_today: onboard.length,
        voyages_in_range: voyages.length,
        left_in_range: voyages.filter((v) => v.status === 'LEFT').length,
        leaving_without_cover: leaving.length,
        leaving_without_cover_ids: leaving.map((v) => v.id),
        by_source: { OPPORTUNITY: voyages.filter((v) => v.source === 'OPPORTUNITY').length, MANUAL: voyages.filter((v) => v.source === 'MANUAL').length },
      },
      today,
    }
  },
}

module.exports = { voyageService }
