const { pickAllowed, paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { nextCode } = require('../utils/code_counter')
const { monthsBetween, contractBalance } = require('../utils/voyage_math')
const {
  CONTRACT_STATUSES, EDITABLE_CONTRACT_STATUSES, DEFAULT_ITEMS, DEFAULT_TERMS,
  CLOSING_DAYS, PAY_DAYS, PAY_MONTH_OFFSETS, HOLIDAY_RULES,
} = require('../constants/voyage_contract')
const { displayStatus } = require('../utils/voyage_math')
const { contractBillService } = require('./contract_bill.service')

const CONTRACT_COLUMNS = ['start_date', 'end_date', 'notes']
const MAX_ITEMS = 40
const SIDES = ['RECEIVABLE', 'PAYABLE']

const STATUS_LABELS = { DRAFT: 'Nháp', PENDING: 'Chờ duyệt', REJECTED: 'Bị từ chối', ACTIVE: 'Hiệu lực', ENDED: 'Hết hạn' }

// Bảng chuyển trạng thái dùng chung cho xin duyệt, thôi xin duyệt, từ chối, duyệt.
const TRANSITIONS = {
  submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING', log: 'SUBMIT' },
  withdraw: { from: ['PENDING'], to: 'DRAFT', log: 'WITHDRAW' },
  reject: { from: ['PENDING'], to: 'REJECTED', log: 'REJECT' },
  approve: { from: ['PENDING'], to: 'ACTIVE', log: 'APPROVE' },
}

const num = (v) => (v == null ? null : Number(v))
const DEFAULT_BY_CODE = Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item]))

const CONTRACT_SELECT = `SELECT c.id, c.contract_number, c.status, c.voyage_position_id, c.seafarer_id, c.start_date, c.end_date,
    c.notes, c.last_reject_reason, c.created_at, c.updated_at,
    s.full_name AS seafarer_name, s.seafarer_code, s.status AS seafarer_status,
    p.sort_order AS position_sort_order, p.budget_total_usd, p.budget_monthly_usd, r.name_vi AS rank_name,
    v.id AS voyage_id, v.code AS voyage_code, v.status AS voyage_status, v.actual_embark_date AS voyage_actual_embark_date,
    v.vessel_id, ves.vessel_name, o.company_name AS ship_owner_name, v.ship_owner_id,
    (SELECT COUNT(*) FROM voyage_position vp WHERE vp.voyage_id = v.id AND vp.deleted_at IS NULL) AS positions_total,
    (SELECT COUNT(*) FROM voyage_position vp WHERE vp.voyage_id = v.id AND vp.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM seafarer_contract c2 WHERE c2.voyage_position_id = vp.id AND c2.deleted_at IS NULL)) AS positions_filled,
    (SELECT COALESCE(SUM(i.receivable_usd), 0) FROM contract_item i WHERE i.contract_id = c.id AND i.kind = 'MONTHLY') AS receivable_monthly,
    (SELECT COALESCE(SUM(i.payable_usd), 0) FROM contract_item i WHERE i.contract_id = c.id AND i.kind = 'MONTHLY') AS payable_monthly
  FROM seafarer_contract c
  JOIN seafarer s ON s.id = c.seafarer_id
  JOIN voyage_position p ON p.id = c.voyage_position_id
  JOIN "rank" r ON r.id = p.rank_id
  JOIN voyage v ON v.id = p.voyage_id
  JOIN vessel ves ON ves.id = v.vessel_id
  JOIN ship_owner o ON o.id = v.ship_owner_id`

function parseItems(input) {
  const rows = Array.isArray(input) ? input : []
  if (rows.length > MAX_ITEMS) throw { statusCode: 400, message: `Tối đa ${MAX_ITEMS} khoản` }
  const seen = new Set()
  const custom = []
  const byCode = {}
  for (const row of rows) {
    const code = row.item_code || null
    const name = typeof row.custom_name === 'string' ? row.custom_name.trim() : ''
    if ((code && name) || (!code && !name)) throw { statusCode: 400, message: 'Mỗi khoản cần mã mặc định hoặc tên tự đặt, không cả hai' }
    const amounts = { receivable_usd: num(row.receivable_usd), payable_usd: num(row.payable_usd) }
    if (code) {
      if (!DEFAULT_BY_CODE[code]) throw { statusCode: 400, message: `Khoản "${code}" không có trong danh sách mặc định` }
      if (seen.has(code)) throw { statusCode: 400, message: 'Khoản mặc định bị lặp' }
      seen.add(code)
      byCode[code] = amounts
    } else {
      if (!['MONTHLY', 'ONE_TIME'].includes(row.kind)) throw { statusCode: 400, message: 'Khoản tự đặt tên cần chọn nhóm hằng tháng hoặc một lần' }
      custom.push({ kind: row.kind, custom_name: name, ...amounts })
    }
  }
  // Thiếu khoản mặc định nào thì tự thêm dòng trống, đúng thứ tự.
  const defaults = DEFAULT_ITEMS.map((d) => ({
    kind: d.kind,
    item_code: d.code,
    receivable_usd: byCode[d.code]?.receivable_usd ?? null,
    payable_usd: byCode[d.code]?.payable_usd ?? null,
  }))
  return [...defaults, ...custom]
}

function parseTerms(input) {
  const terms = {}
  for (const side of SIDES) {
    const t = { ...DEFAULT_TERMS[side], ...(input?.[side] || {}) }
    if (!CLOSING_DAYS.includes(t.closing_day) || !PAY_DAYS.includes(t.pay_day) || !PAY_MONTH_OFFSETS.includes(t.pay_month_offset) || !HOLIDAY_RULES.includes(t.holiday_rule)) {
      throw { statusCode: 400, message: 'Kỳ thanh toán không hợp lệ' }
    }
    terms[side] = { closing_day: t.closing_day, pay_day: t.pay_day, pay_month_offset: t.pay_month_offset, holiday_rule: t.holiday_rule }
  }
  return terms
}

async function writeItemsAndTerms(conn, contractId, items, terms) {
  for (const [index, item] of items.entries()) {
    await conn.query('INSERT INTO contract_item SET ?', [{ ...item, contract_id: contractId, sort_order: index }])
  }
  for (const side of SIDES) {
    await conn.query('INSERT INTO contract_payment_term SET ?', [{ ...terms[side], contract_id: contractId, side }])
  }
}

async function writeLog(conn, contractId, action, actorId, reason = null) {
  await conn.query('INSERT INTO contract_approval_log SET ?', [{ contract_id: contractId, action, actor_id: actorId ?? null, reason }])
}

// Cùng thuyền viên không có hai hợp đồng chưa xoá, chưa hết hạn, trùng khoảng ngày.
async function assertNoOverlap(conn, { seafarerId, startDate, endDate, excludeId = 0 }) {
  const [rows] = await conn.query(
    `SELECT c.contract_number, s.full_name FROM seafarer_contract c JOIN seafarer s ON s.id = c.seafarer_id
     WHERE c.seafarer_id = ? AND c.deleted_at IS NULL AND c.status <> 'ENDED' AND c.id <> ?
       AND c.start_date <= ? AND c.end_date >= ? LIMIT 1`,
    [seafarerId, excludeId, endDate, startDate]
  )
  if (rows.length) throw { statusCode: 409, message: `${rows[0].full_name} đã có hợp đồng ${rows[0].contract_number} trùng thời gian` }
}

function validateDates(data) {
  if (data.end_date < data.start_date) throw { statusCode: 400, message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' }
}

function summaryRow(row) {
  const receivable = Number(row.receivable_monthly)
  const payable = Number(row.payable_monthly)
  return {
    id: row.id,
    contract_number: row.contract_number,
    status: row.status,
    seafarer_id: row.seafarer_id,
    seafarer_name: row.seafarer_name,
    rank_name: row.rank_name,
    voyage_id: row.voyage_id,
    voyage_code: row.voyage_code,
    voyage_status: row.voyage_status,
    vessel_id: row.vessel_id,
    vessel_name: row.vessel_name,
    ship_owner_name: row.ship_owner_name,
    start_date: row.start_date,
    end_date: row.end_date,
    receivable_monthly: receivable,
    payable_monthly: payable,
    diff_monthly: Math.round((receivable - payable) * 100) / 100,
  }
}

const seafarerContractService = {
  async list(pool, query) {
    const { page, limit, offset } = paging(query)
    const params = []
    let where = 'WHERE c.deleted_at IS NULL'
    if (query.ownerId) {
      where += ' AND c.created_by = ?'
      params.push(Number(query.ownerId))
    }
    if (query.search) {
      where += ' AND (unaccent(c.contract_number::text) ILIKE unaccent(?) OR unaccent(s.full_name::text) ILIKE unaccent(?))'
      params.push(`%${query.search}%`, `%${query.search}%`)
    }
    for (const [key, column] of [['ship_owner_id', 'v.ship_owner_id'], ['voyage_id', 'v.id'], ['seafarer_id', 'c.seafarer_id']]) {
      if (query[key]) {
        where += ` AND ${column} = ?`
        params.push(Number(query[key]))
      }
    }
    const tab = CONTRACT_STATUSES.includes(query.tab) ? query.tab : null
    const [countRows] = await pool.query(
      `SELECT c.status, COUNT(*) AS n FROM seafarer_contract c
       JOIN seafarer s ON s.id = c.seafarer_id
       JOIN voyage_position p ON p.id = c.voyage_position_id
       JOIN voyage v ON v.id = p.voyage_id
       ${where} GROUP BY c.status`,
      params
    )
    const counts = { all: 0, ...Object.fromEntries(CONTRACT_STATUSES.map((key) => [key, 0])) }
    for (const row of countRows) {
      counts[row.status] = Number(row.n)
      counts.all += Number(row.n)
    }
    const [rows] = await pool.query(
      `${CONTRACT_SELECT} ${where}${tab ? ' AND c.status = ?' : ''} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
      [...params, ...(tab ? [tab] : []), limit, offset]
    )
    return { data: rows.map(summaryRow), total: tab ? counts[tab] : counts.all, counts, page, limit }
  },

  async get(pool, id) {
    const [[row]] = await pool.query(`${CONTRACT_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
    const [itemRows] = await pool.query(
      'SELECT id, kind, item_code, custom_name, receivable_usd, payable_usd, sort_order FROM contract_item WHERE contract_id = ? ORDER BY sort_order, id',
      [id]
    )
    const [termRows] = await pool.query(
      'SELECT side, closing_day, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id = ?',
      [id]
    )
    const [logRows] = await pool.query(
      `SELECT l.id, l.action, l.actor_id, u.email AS actor_name, l.reason, l.created_at
       FROM contract_approval_log l LEFT JOIN "user" u ON u.id = l.actor_id
       WHERE l.contract_id = ? ORDER BY l.created_at DESC, l.id DESC`,
      [id]
    )
    const items = itemRows.map((i) => ({
      id: i.id,
      kind: i.kind,
      item_code: i.item_code,
      custom_name: i.custom_name,
      name: i.item_code ? DEFAULT_BY_CODE[i.item_code]?.name ?? i.item_code : i.custom_name,
      receivable_usd: num(i.receivable_usd),
      payable_usd: num(i.payable_usd),
    }))
    const months = monthsBetween(row.start_date, row.end_date)
    const positionsTotal = Number(row.positions_total)
    const positionsFilled = Number(row.positions_filled)
    return {
      contract: {
        id: row.id,
        contract_number: row.contract_number,
        status: row.status,
        voyage_position_id: row.voyage_position_id,
        seafarer_id: row.seafarer_id,
        start_date: row.start_date,
        end_date: row.end_date,
        months,
        notes: row.notes,
        last_reject_reason: row.last_reject_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      position: {
        id: row.voyage_position_id,
        rank_name: row.rank_name,
        budget_total_usd: num(row.budget_total_usd),
        budget_monthly_usd: num(row.budget_monthly_usd),
        sort_order: row.position_sort_order,
      },
      voyage: {
        id: row.voyage_id,
        code: row.voyage_code,
        status: row.voyage_status,
        display_status: displayStatus({ status: row.voyage_status, positionsTotal, positionsFilled }),
        vessel_id: row.vessel_id,
        vessel_name: row.vessel_name,
        ship_owner_id: row.ship_owner_id,
        ship_owner_name: row.ship_owner_name,
        actual_embark_date: row.voyage_actual_embark_date,
      },
      seafarer: { id: row.seafarer_id, full_name: row.seafarer_name, seafarer_code: row.seafarer_code, status: row.seafarer_status },
      items,
      terms: Object.fromEntries(termRows.map(({ side, ...t }) => [side, t])),
      log: logRows,
      balance: contractBalance({ items, budgetMonthly: row.budget_monthly_usd, contractMonths: months }),
    }
  },

  async create(pool, body, userId) {
    const data = pickAllowed(body, CONTRACT_COLUMNS)
    validateDates(data)
    const items = parseItems(body.items)
    const terms = parseTerms(body.terms)
    const id = await withTransaction(pool, async (conn) => {
      const [[position]] = await conn.query(
        `SELECT p.id, v.status AS voyage_status
         FROM voyage_position p JOIN voyage v ON v.id = p.voyage_id
         WHERE p.id = ? AND p.deleted_at IS NULL AND v.deleted_at IS NULL FOR UPDATE OF p`,
        [body.voyage_position_id]
      )
      if (!position) throw { statusCode: 404, message: 'Không tìm thấy vị trí' }
      if (position.voyage_status === 'ENDED') throw { statusCode: 409, message: 'Chuyến đã kết thúc, không tạo thêm hợp đồng' }
      const [taken] = await conn.query('SELECT 1 FROM seafarer_contract WHERE voyage_position_id = ? AND deleted_at IS NULL', [body.voyage_position_id])
      if (taken.length) throw { statusCode: 409, message: 'Vị trí này đã có hợp đồng' }
      const [[seafarer]] = await conn.query('SELECT id, status FROM seafarer WHERE id = ? AND deleted_at IS NULL', [body.seafarer_id])
      if (!seafarer) throw { statusCode: 400, message: 'Không tìm thấy thuyền viên' }
      if (seafarer.status === 'INACTIVE') throw { statusCode: 409, message: 'Thuyền viên đang tạm ngưng, kích hoạt lại trước khi tạo hợp đồng' }
      await assertNoOverlap(conn, { seafarerId: body.seafarer_id, startDate: data.start_date, endDate: data.end_date })
      const contractNumber = await nextCode(conn, 'CONTRACT', new Date().getUTCFullYear(), 'HĐ', 4)
      const [result] = await conn.query('INSERT INTO seafarer_contract SET ?', [{
        ...data,
        contract_number: contractNumber,
        voyage_position_id: body.voyage_position_id,
        seafarer_id: body.seafarer_id,
        status: 'DRAFT',
        created_by: userId ?? null,
        updated_by: userId ?? null,
      }])
      await writeItemsAndTerms(conn, result.insertId, items, terms)
      await writeLog(conn, result.insertId, 'CREATE', userId)
      return result.insertId
    }).catch((error) => {
      if (error.code === '23505') throw { statusCode: 409, message: 'Vị trí này đã có hợp đồng' }
      throw error
    })
    return this.get(pool, id)
  },

  async update(pool, id, body, userId) {
    const data = pickAllowed(body, CONTRACT_COLUMNS)
    validateDates(data)
    const items = parseItems(body.items)
    const terms = parseTerms(body.terms)
    await withTransaction(pool, async (conn) => {
      const [[current]] = await conn.query('SELECT id, status FROM seafarer_contract WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
      if (!current) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
      if (!EDITABLE_CONTRACT_STATUSES.includes(current.status)) throw { statusCode: 409, message: 'Hợp đồng đang khoá, không sửa được' }
      const [[seafarer]] = await conn.query('SELECT id, status FROM seafarer WHERE id = ? AND deleted_at IS NULL', [body.seafarer_id])
      if (!seafarer) throw { statusCode: 400, message: 'Không tìm thấy thuyền viên' }
      if (seafarer.status === 'INACTIVE') throw { statusCode: 409, message: 'Thuyền viên đang tạm ngưng, kích hoạt lại trước khi xếp vào hợp đồng' }
      await assertNoOverlap(conn, { seafarerId: body.seafarer_id, startDate: data.start_date, endDate: data.end_date, excludeId: id })
      await conn.query('UPDATE seafarer_contract SET ? WHERE id = ?', [{ ...data, seafarer_id: body.seafarer_id, updated_by: userId ?? null }, id])
      await conn.query('DELETE FROM contract_item WHERE contract_id = ?', [id])
      await conn.query('DELETE FROM contract_payment_term WHERE contract_id = ?', [id])
      await writeItemsAndTerms(conn, id, items, terms)
    })
    return this.get(pool, id)
  },

  async softDelete(pool, id) {
    const [result] = await pool.query(
      'UPDATE seafarer_contract SET deleted_at = NOW() WHERE id = ? AND status = ? AND deleted_at IS NULL',
      [id, 'DRAFT']
    )
    if (!result.affectedRows) {
      const [[row]] = await pool.query('SELECT status FROM seafarer_contract WHERE id = ? AND deleted_at IS NULL', [id])
      if (!row) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
      throw { statusCode: 409, message: 'Chỉ xoá được hợp đồng nháp' }
    }
    return { success: true }
  },

  // action: submit | withdraw | reject | approve. extra: { reason } hoặc { move_onboard }.
  async transition(pool, id, action, extra = {}, userId) {
    const rule = TRANSITIONS[action]
    const reason = typeof extra.reason === 'string' ? extra.reason.trim() : ''
    if (action === 'reject' && (!reason || reason.length > 1000)) throw { statusCode: 400, message: 'Cần ghi lý do từ chối (tối đa 1000 ký tự)' }
    let moved = false
    await withTransaction(pool, async (conn) => {
      const [[current]] = await conn.query(
        `SELECT c.status, c.seafarer_id, v.status AS voyage_status
         FROM seafarer_contract c
         JOIN voyage_position p ON p.id = c.voyage_position_id
         JOIN voyage v ON v.id = p.voyage_id
         WHERE c.id = ? AND c.deleted_at IS NULL FOR UPDATE OF c`,
        [id]
      )
      if (!current) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
      if (!rule.from.includes(current.status)) {
        throw { statusCode: 409, message: `Không thực hiện được: hợp đồng đang ở trạng thái ${STATUS_LABELS[current.status]}` }
      }
      const fields = { status: rule.to, updated_by: userId ?? null }
      if (action === 'reject') fields.last_reject_reason = reason
      await conn.query('UPDATE seafarer_contract SET ? WHERE id = ?', [fields, id])
      await writeLog(conn, id, rule.log, userId, action === 'reject' ? reason : null)
      // Duyệt là sinh đủ yêu cầu thanh toán bên phải thu, cùng transaction: lỗi thì không duyệt.
      if (action === 'approve') await contractBillService.generateForContract(conn, id, 'RECEIVABLE', userId)
      if (action === 'approve' && extra.move_onboard === true && current.voyage_status === 'ONBOARD') {
        await conn.query('UPDATE seafarer SET status = ? WHERE id = ?', ['ON_VESSEL', current.seafarer_id])
        moved = true
      }
    })
    const detail = await this.get(pool, id)
    return action === 'approve' ? { ...detail, moved } : detail
  },
}

module.exports = { seafarerContractService, TRANSITIONS, STATUS_LABELS }
