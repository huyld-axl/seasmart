const { pickAllowed, paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { nextCode } = require('../utils/code_counter')
const { monthsBetween, dueFlag, displayStatus, round2 } = require('../utils/voyage_math')
const { VOYAGE_DISPLAY_STATUSES } = require('../constants/voyage_contract')

const VOYAGE_COLUMNS = [
  'vessel_id', 'ship_owner_id', 'embark_port_id', 'disembark_port_id',
  'planned_embark_date', 'planned_disembark_date', 'actual_embark_date', 'actual_disembark_date', 'notes',
]
const POSITION_COLUMNS = ['rank_id', 'budget_total_usd', 'budget_monthly_usd']

// Hợp đồng chưa hiệu lực: giữ nguyên trạng thái thuyền viên khi bắt đầu / kết thúc chuyến.
const NOT_EFFECTIVE = ['DRAFT', 'PENDING', 'REJECTED']

const num = (v) => (v == null ? null : Number(v))

const VOYAGE_SELECT = `SELECT v.id, v.code, v.vessel_id, ves.vessel_name, v.ship_owner_id, o.company_name AS ship_owner_name,
    v.embark_port_id, ep.name AS embark_port_name, v.disembark_port_id, dp.name AS disembark_port_name,
    v.planned_embark_date, v.planned_disembark_date, v.actual_embark_date, v.actual_disembark_date,
    v.status, v.notes, v.updated_at, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today,
    (SELECT COUNT(*) FROM voyage_position p WHERE p.voyage_id = v.id AND p.deleted_at IS NULL) AS positions_total,
    (SELECT COUNT(*) FROM voyage_position p WHERE p.voyage_id = v.id AND p.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM seafarer_contract c WHERE c.voyage_position_id = p.id AND c.deleted_at IS NULL)) AS positions_filled,
    (SELECT COALESCE(SUM(p.budget_monthly_usd), 0) FROM voyage_position p WHERE p.voyage_id = v.id AND p.deleted_at IS NULL) AS budget_monthly_sum,
    (SELECT SUM(COALESCE(i.receivable_usd, 0) - COALESCE(i.payable_usd, 0))
       FROM contract_item i
       JOIN seafarer_contract c ON c.id = i.contract_id AND c.deleted_at IS NULL
       JOIN voyage_position p ON p.id = c.voyage_position_id AND p.deleted_at IS NULL
       WHERE p.voyage_id = v.id AND i.kind = 'MONTHLY') AS diff_monthly_sum
  FROM voyage v
  JOIN vessel ves ON ves.id = v.vessel_id
  JOIN ship_owner o ON o.id = v.ship_owner_id
  LEFT JOIN port ep ON ep.id = v.embark_port_id
  LEFT JOIN port dp ON dp.id = v.disembark_port_id`

const POSITION_SELECT = `SELECT p.id, p.rank_id, r.name_vi AS rank_name, p.budget_total_usd, p.budget_monthly_usd, p.sort_order,
    c.id AS contract_id, c.contract_number, c.status AS contract_status,
    c.seafarer_id, s.full_name AS seafarer_name, s.status AS seafarer_status,
    (SELECT SUM(i.receivable_usd) FROM contract_item i WHERE i.contract_id = c.id AND i.kind = 'MONTHLY') AS receivable_monthly,
    (SELECT SUM(i.payable_usd) FROM contract_item i WHERE i.contract_id = c.id AND i.kind = 'MONTHLY') AS payable_monthly
  FROM voyage_position p
  JOIN "rank" r ON r.id = p.rank_id
  LEFT JOIN seafarer_contract c ON c.voyage_position_id = p.id AND c.deleted_at IS NULL
  LEFT JOIN seafarer s ON s.id = c.seafarer_id
  WHERE p.voyage_id = ? AND p.deleted_at IS NULL
  ORDER BY p.sort_order, p.id`

// Thêm display_status và due vào một dòng chuyến; đổi chuỗi decimal thành số.
function decorate(row) {
  const { today, ...rest } = row
  const positionsTotal = Number(row.positions_total)
  const positionsFilled = Number(row.positions_filled)
  return {
    ...rest,
    positions_total: positionsTotal,
    positions_filled: positionsFilled,
    budget_monthly_sum: num(row.budget_monthly_sum),
    diff_monthly_sum: num(row.diff_monthly_sum),
    display_status: displayStatus({ status: row.status, positionsTotal, positionsFilled }),
    due: dueFlag({ status: row.status, plannedEmbark: row.planned_embark_date, today }),
  }
}

function toPosition(row) {
  return {
    id: row.id,
    rank_id: row.rank_id,
    rank_name: row.rank_name,
    budget_total_usd: num(row.budget_total_usd),
    budget_monthly_usd: num(row.budget_monthly_usd),
    sort_order: row.sort_order,
    contract: row.contract_id
      ? {
          id: row.contract_id,
          contract_number: row.contract_number,
          status: row.contract_status,
          seafarer_id: row.seafarer_id,
          seafarer_name: row.seafarer_name,
          seafarer_status: row.seafarer_status,
          receivable_monthly: num(row.receivable_monthly) ?? 0,
          payable_monthly: num(row.payable_monthly) ?? 0,
        }
      : null,
  }
}

function summarize(positions) {
  const byStatus = {}
  let budgetTotal = 0
  let budgetMonthly = 0
  let receivable = 0
  let payable = 0
  let contracts = 0
  for (const p of positions) {
    budgetTotal += p.budget_total_usd
    budgetMonthly += p.budget_monthly_usd
    if (!p.contract) continue
    contracts += 1
    byStatus[p.contract.status] = (byStatus[p.contract.status] || 0) + 1
    receivable += p.contract.receivable_monthly
    payable += p.contract.payable_monthly
  }
  return {
    positions_total: positions.length,
    contracts_total: contracts,
    empty_positions: positions.length - contracts,
    contracts_by_status: byStatus,
    budget_total_usd: round2(budgetTotal),
    budget_monthly_usd: round2(budgetMonthly),
    receivable_monthly: round2(receivable),
    payable_monthly: round2(payable),
    diff_monthly: round2(receivable - payable),
  }
}

function validateDates(data) {
  if (data.planned_embark_date && data.planned_disembark_date && data.planned_disembark_date < data.planned_embark_date) {
    throw { statusCode: 400, message: 'Ngày rời tàu dự kiến phải sau hoặc bằng ngày xuống tàu dự kiến' }
  }
  if (data.actual_embark_date && data.actual_disembark_date && data.actual_disembark_date < data.actual_embark_date) {
    throw { statusCode: 400, message: 'Ngày rời tàu thực tế phải sau hoặc bằng ngày xuống tàu thực tế' }
  }
}

function validatePositions(positions) {
  if (!Array.isArray(positions) || !positions.length) throw { statusCode: 400, message: 'Chuyến cần ít nhất một vị trí' }
}

// Khoá ngoại sai (tàu, chủ tàu, cảng, chức danh không tồn tại) thành lỗi 400 tiếng Việt.
async function refGuard(promise) {
  try {
    return await promise
  } catch (error) {
    if (error.code === '23503') throw { statusCode: 400, message: 'Tàu, chủ tàu, cảng hoặc chức danh không tồn tại' }
    throw error
  }
}

const voyageService = {
  async list(pool, query) {
    const { page, limit, offset } = paging(query)
    const params = []
    let where = 'WHERE v.deleted_at IS NULL'
    if (query.search) {
      where += ' AND (unaccent(v.code::text) ILIKE unaccent(?) OR unaccent(ves.vessel_name::text) ILIKE unaccent(?) OR unaccent(o.company_name::text) ILIKE unaccent(?))'
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`)
    }
    if (query.ship_owner_id) {
      where += ' AND v.ship_owner_id = ?'
      params.push(Number(query.ship_owner_id))
    }
    const [rows] = await pool.query(
      `${VOYAGE_SELECT} ${where}
       ORDER BY (v.status = 'PLANNING') DESC, v.planned_embark_date ASC, v.id ASC`,
      params
    )
    const all = rows.map(decorate)
    const counts = { all: all.length, ...Object.fromEntries(VOYAGE_DISPLAY_STATUSES.map((key) => [key, 0])) }
    for (const row of all) counts[row.display_status] += 1
    const tab = VOYAGE_DISPLAY_STATUSES.includes(query.tab) ? query.tab : 'all'
    const filtered = tab === 'all' ? all : all.filter((row) => row.display_status === tab)
    return { data: filtered.slice(offset, offset + limit), total: filtered.length, counts, page, limit }
  },

  async get(pool, id) {
    const [[row]] = await pool.query(`${VOYAGE_SELECT} WHERE v.id = ? AND v.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy chuyến tàu' }
    const [positionRows] = await pool.query(POSITION_SELECT, [id])
    const positions = positionRows.map(toPosition)
    const voyage = decorate(row)
    const months = monthsBetween(voyage.planned_embark_date, voyage.planned_disembark_date)
    return { ...voyage, months, positions, summary: summarize(positions) }
  },

  async create(pool, body, userId) {
    const data = pickAllowed(body, VOYAGE_COLUMNS)
    delete data.actual_embark_date
    delete data.actual_disembark_date
    validateDates(data)
    validatePositions(body.positions)
    const id = await refGuard(
      withTransaction(pool, async (conn) => {
        const code = await nextCode(conn, 'VOYAGE', new Date().getUTCFullYear(), 'CT', 3)
        const [result] = await conn.query('INSERT INTO voyage SET ?', [{ ...data, code, created_by: userId ?? null, updated_by: userId ?? null }])
        for (const [index, position] of body.positions.entries()) {
          await conn.query('INSERT INTO voyage_position SET ?', [{
            ...pickAllowed(position, POSITION_COLUMNS),
            voyage_id: result.insertId,
            sort_order: index,
          }])
        }
        return result.insertId
      })
    )
    return this.get(pool, id)
  },

  async update(pool, id, body, userId) {
    const data = pickAllowed(body, VOYAGE_COLUMNS)
    validatePositions(body.positions)
    await refGuard(
      withTransaction(pool, async (conn) => {
        const [[current]] = await conn.query('SELECT * FROM voyage WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
        if (!current) throw { statusCode: 404, message: 'Không tìm thấy chuyến tàu' }
        if (current.status === 'PLANNING' && (data.actual_embark_date || data.actual_disembark_date)) {
          throw { statusCode: 400, message: 'Chuyến chưa bắt đầu, chưa có ngày thực tế' }
        }
        const merged = { ...current, ...data }
        validateDates(merged)
        if (current.status !== 'PLANNING' && (!merged.actual_embark_date || !merged.embark_port_id)) {
          throw { statusCode: 400, message: 'Chuyến đã bắt đầu cần có ngày và nơi xuống tàu thực tế' }
        }
        if (current.status === 'ENDED' && (!merged.actual_disembark_date || !merged.disembark_port_id)) {
          throw { statusCode: 400, message: 'Chuyến đã kết thúc cần có ngày và nơi rời tàu thực tế' }
        }
        await conn.query('UPDATE voyage SET ? WHERE id = ?', [{ ...data, updated_by: userId ?? null }, id])

        const [existing] = await conn.query(
          `SELECT p.id, r.name_vi AS rank_name,
                  EXISTS (SELECT 1 FROM seafarer_contract c WHERE c.voyage_position_id = p.id AND c.deleted_at IS NULL) AS has_contract
           FROM voyage_position p JOIN "rank" r ON r.id = p.rank_id
           WHERE p.voyage_id = ? AND p.deleted_at IS NULL`,
          [id]
        )
        const kept = new Set(body.positions.filter((p) => p.id).map((p) => p.id))
        for (const position of body.positions) {
          if (position.id && !existing.some((e) => e.id === position.id)) {
            throw { statusCode: 400, message: 'Vị trí không thuộc chuyến này' }
          }
        }
        for (const old of existing) {
          if (kept.has(old.id)) continue
          if (old.has_contract) throw { statusCode: 409, message: `Vị trí ${old.rank_name} đã có hợp đồng, không xoá được` }
          await conn.query('UPDATE voyage_position SET deleted_at = NOW() WHERE id = ?', [old.id])
        }
        for (const [index, position] of body.positions.entries()) {
          const fields = { ...pickAllowed(position, POSITION_COLUMNS), sort_order: index }
          if (position.id) await conn.query('UPDATE voyage_position SET ? WHERE id = ?', [fields, position.id])
          else await conn.query('INSERT INTO voyage_position SET ?', [{ ...fields, voyage_id: id }])
        }
      })
    )
    return this.get(pool, id)
  },

  async softDelete(pool, id) {
    await withTransaction(pool, async (conn) => {
      const [[current]] = await conn.query('SELECT status FROM voyage WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
      if (!current) throw { statusCode: 404, message: 'Không tìm thấy chuyến tàu' }
      if (current.status !== 'PLANNING') throw { statusCode: 409, message: 'Chỉ xoá được chuyến chưa bắt đầu' }
      const [[used]] = await conn.query(
        `SELECT COUNT(*) AS n FROM seafarer_contract c JOIN voyage_position p ON p.id = c.voyage_position_id
         WHERE p.voyage_id = ? AND c.deleted_at IS NULL`,
        [id]
      )
      if (Number(used.n)) throw { statusCode: 409, message: 'Chuyến còn hợp đồng, không xoá được' }
      await conn.query('UPDATE voyage_position SET deleted_at = NOW() WHERE voyage_id = ? AND deleted_at IS NULL', [id])
      await conn.query('UPDATE voyage SET deleted_at = NOW() WHERE id = ?', [id])
    })
    return { success: true }
  },

  // Bắt đầu hoặc kết thúc chuyến. kind = 'start' | 'end'.
  async transition(pool, id, kind, body, userId) {
    const isStart = kind === 'start'
    const result = await refGuard(
      withTransaction(pool, async (conn) => {
        const [[current]] = await conn.query('SELECT * FROM voyage WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
        if (!current) throw { statusCode: 404, message: 'Không tìm thấy chuyến tàu' }
        const expected = isStart ? 'PLANNING' : 'ONBOARD'
        if (current.status !== expected) {
          throw { statusCode: 409, message: isStart ? 'Chỉ bắt đầu được chuyến đang chuẩn bị' : 'Chỉ kết thúc được chuyến đang trên tàu' }
        }
        const fields = isStart
          ? { status: 'ONBOARD', actual_embark_date: body.actual_embark_date, embark_port_id: body.embark_port_id }
          : { status: 'ENDED', actual_disembark_date: body.actual_disembark_date, disembark_port_id: body.disembark_port_id }
        if (!isStart && body.actual_disembark_date < current.actual_embark_date) {
          throw { statusCode: 400, message: 'Ngày rời tàu phải sau hoặc bằng ngày xuống tàu thực tế' }
        }
        await conn.query('UPDATE voyage SET ? WHERE id = ?', [{ ...fields, updated_by: userId ?? null }, id])

        const [crew] = await conn.query(
          `SELECT s.id AS seafarer_id, s.full_name AS seafarer_name, s.status AS seafarer_status,
                  r.name_vi AS rank_name, c.status AS contract_status
           FROM seafarer_contract c
           JOIN voyage_position p ON p.id = c.voyage_position_id
           JOIN "rank" r ON r.id = p.rank_id
           JOIN seafarer s ON s.id = c.seafarer_id AND s.deleted_at IS NULL
           WHERE p.voyage_id = ? AND c.deleted_at IS NULL AND c.status IN ('ACTIVE', 'DRAFT', 'PENDING', 'REJECTED')
           ORDER BY p.sort_order, p.id`,
          [id]
        )
        const pick = (r) => ({ seafarer_id: r.seafarer_id, seafarer_name: r.seafarer_name, rank_name: r.rank_name })
        const skipped = crew.filter((r) => NOT_EFFECTIVE.includes(r.contract_status)).map((r) => ({ ...pick(r), contract_status: r.contract_status }))
        const moved = crew
          .filter((r) => r.contract_status === 'ACTIVE' && (isStart || r.seafarer_status === 'ON_VESSEL'))
          .map(pick)
        if (moved.length) {
          await conn.query('UPDATE seafarer SET status = ? WHERE id IN (?)', [isStart ? 'ON_VESSEL' : 'AVAILABLE', moved.map((m) => m.seafarer_id)])
        }
        return { moved, skipped }
      })
    )
    return { voyage: await this.get(pool, id), ...result }
  },
}

module.exports = { voyageService, VOYAGE_COLUMNS, POSITION_COLUMNS }
