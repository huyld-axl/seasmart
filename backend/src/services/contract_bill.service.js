const { assertVersion } = require('../utils/row_version')
const { paging } = require('./fleet.service')
const { withTransaction } = require('../utils/transaction')
const { uniqueCode } = require('../utils/code_counter')
const crypto = require('crypto')
const { splitPeriods, dueDate, round2, planBillChanges } = require('../utils/voyage_math')
const { DEFAULT_ITEMS, BILL_DISPLAY_STATUSES } = require('../constants/voyage_contract')

const DEFAULT_NAME = Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.name]))
const AMOUNT_FIELD = { RECEIVABLE: 'receivable_usd', PAYABLE: 'payable_usd' }
const MAX_ADJUSTMENTS = 20
const num = (v) => (v == null ? null : Number(v))

const STATUS_LABELS = { OPEN: 'Chưa duyệt', APPROVED: 'Đã duyệt', SENT: 'Đã gửi', PAID: 'Đã thu' }

// Trạng thái hiển thị tính trong SQL để lọc tab và đếm (cùng quy tắc với billDisplayStatus).
const DISPLAY_SQL = `CASE
    WHEN b.status = 'PAID' THEN 'PAID'
    WHEN b.status = 'SENT' THEN CASE WHEN CURRENT_DATE > b.due_date THEN 'OVERDUE' ELSE 'SENT' END
    WHEN b.status = 'APPROVED' THEN 'TO_SEND'
    WHEN CURRENT_DATE < b.period_end THEN 'UPCOMING'
    ELSE 'TO_APPROVE' END`
const TOTAL_SQL = '(SELECT COALESCE(SUM(i.amount_usd), 0) FROM contract_bill_item i WHERE i.bill_id = b.id)'

// Tàu, chủ tàu, chức danh lấy từ chuyến mới; hợp đồng cũ chưa nối chuyến rơi về vị trí / chuyến cũ.
const BILL_FROM = `FROM contract_bill b
  JOIN seafarer_contract c ON c.id = b.contract_id
  JOIN seafarer s ON s.id = c.seafarer_id
  LEFT JOIN seafarer_voyage sv ON sv.id = c.seafarer_voyage_id
  LEFT JOIN voyage_position p ON p.id = c.voyage_position_id
  LEFT JOIN voyage v ON v.id = p.voyage_id
  JOIN "rank" r ON r.id = COALESCE(sv.rank_id, p.rank_id)
  JOIN vessel ves ON ves.id = COALESCE(sv.vessel_id, v.vessel_id)
  JOIN ship_owner o ON o.id = COALESCE(sv.ship_owner_id, v.ship_owner_id)`

const BILL_SELECT = `SELECT b.id, b.version, b.code, b.contract_id, b.side, b.seq, b.period_start, b.period_end, b.due_date, b.status,
    b.sent_at, b.paid_date, b.note, b.created_at, ${DISPLAY_SQL} AS display_status, ${TOTAL_SQL} AS total_usd,
    (SELECT COUNT(*) FROM contract_bill b2 WHERE b2.contract_id = b.contract_id AND b2.side = b.side AND b2.deleted_at IS NULL) AS periods,
    c.contract_number, c.seafarer_id, s.full_name AS seafarer_name, r.name_vi AS rank_name,
    v.id AS voyage_id, v.code AS voyage_code, sv.id AS trip_id, sv.code AS trip_code,
    ves.id AS vessel_id, ves.vessel_name, o.id AS ship_owner_id, o.company_name AS ship_owner_name`

// Bên phải thu là hiện tại; giữ tham số side để làm bên phải chi sau.
const SIDE = 'RECEIVABLE'

function summary(row) {
  return {
    id: row.id,
    code: row.code,
    seq: row.seq,
    periods: Number(row.periods),
    period_start: row.period_start,
    period_end: row.period_end,
    due_date: row.due_date,
    paid_date: row.paid_date ?? null,
    status: row.status,
    display_status: row.display_status,
    total_usd: Number(row.total_usd),
    contract: { id: row.contract_id, contract_number: row.contract_number },
    seafarer: { id: row.seafarer_id, full_name: row.seafarer_name, rank_name: row.rank_name },
    vessel: { id: row.vessel_id, vessel_name: row.vessel_name },
    voyage: row.voyage_id ? { id: row.voyage_id, code: row.voyage_code } : null,
    trip: row.trip_id ? { id: row.trip_id, code: row.trip_code } : null,
    ship_owner: { id: row.ship_owner_id, company_name: row.ship_owner_name },
  }
}

async function writeLog(conn, billId, action, actorId, payload = null) {
  await conn.query('INSERT INTO contract_bill_log SET ?', [{ bill_id: billId, action, actor_id: actorId ?? null, payload: payload && JSON.stringify(payload) }])
}

const iso = (v) => String(v).slice(0, 10)

// Dữ liệu sinh bill của một bên: kỳ thanh toán và các dòng tiền hiện tại của hợp đồng.
async function loadGeneration(conn, contractId, side) {
  const [[term]] = await conn.query('SELECT closing_day, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id = ? AND side = ?', [contractId, side])
  if (!term) throw { statusCode: 409, message: 'Hợp đồng chưa có kỳ thanh toán' }
  const [itemRows] = await conn.query('SELECT item_code, custom_name, kind, receivable_usd, payable_usd FROM contract_item WHERE contract_id = ? ORDER BY sort_order, id', [contractId])
  const field = AMOUNT_FIELD[side]
  const lines = itemRows
    .map((row) => ({ item_code: row.item_code, kind: row.kind, name: row.item_code ? DEFAULT_NAME[row.item_code] || row.item_code : row.custom_name, amount: num(row[field]) }))
    .filter((line) => line.amount > 0)
  return { term, lines }
}

// Ghi một bill mới (kỳ, hạn, dòng tiền đủ tháng) kèm log CREATE. withOneTime: kèm các khoản một lần.
async function insertBill(conn, { contractId, side, seq, start, end, due, lines, withOneTime, createdBy, actorId }) {
  const [[contract]] = await conn.query('SELECT contract_number FROM seafarer_contract WHERE id = ?', [contractId])
  const code = await uniqueCode(conn, 'contract_bill', 'code', `${contract.contract_number}/${side === 'PAYABLE' ? 'C' : 'T'}${seq}`)
  const [result] = await conn.query('INSERT INTO contract_bill SET ?', [{
    code, contract_id: contractId, side, seq, period_start: start, period_end: end, due_date: due, status: 'OPEN',
    created_by: createdBy ?? null, updated_by: actorId ?? null,
  }])
  const billLines = lines.filter((line) => line.kind === 'MONTHLY' || withOneTime)
  for (const [order, line] of billLines.entries()) {
    await conn.query('INSERT INTO contract_bill_item SET ?', [{
      bill_id: result.insertId, item_code: line.item_code, kind: line.kind, name: line.name, default_usd: line.amount, amount_usd: line.amount, sort_order: order,
    }])
  }
  await writeLog(conn, result.insertId, 'CREATE', actorId)
  return result.insertId
}

// Bảng chuyển trạng thái. `collect` cần ngày thu.
const TRANSITIONS = {
  approve: { from: 'OPEN', to: 'APPROVED', log: 'APPROVE' },
  unapprove: { from: 'APPROVED', to: 'OPEN', log: 'UNAPPROVE' },
  send: { from: 'APPROVED', to: 'SENT', log: 'SEND' },
  unsend: { from: 'SENT', to: 'OPEN', log: 'UNSEND' },
  collect: { from: 'SENT', to: 'PAID', log: 'COLLECT' },
  uncollect: { from: 'PAID', to: 'SENT', log: 'UNCOLLECT' },
}

const contractBillService = {
  // Sinh đủ bill của một bên khi hợp đồng được duyệt. Chạy trong transaction của việc duyệt.
  // Đã có bill của bên này thì không làm gì (chạy lại script bù không sinh trùng). Trả số bill đã tạo.
  async generateForContract(conn, contractId, side = SIDE, actorId = null) {
    const [existing] = await conn.query('SELECT 1 FROM contract_bill WHERE contract_id = ? AND side = ? AND deleted_at IS NULL LIMIT 1', [contractId, side])
    if (existing.length) return 0
    const [[contract]] = await conn.query('SELECT id, start_date, end_date, created_by FROM seafarer_contract WHERE id = ?', [contractId])
    if (!contract) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
    const { term, lines } = await loadGeneration(conn, contractId, side)
    const periods = splitPeriods({ start: contract.start_date, end: contract.end_date, closingDay: term.closing_day })
    for (const [index, period] of periods.entries()) {
      await insertBill(conn, {
        contractId, side, seq: index + 1, start: period.start, end: period.end, lines, withOneTime: index === 0,
        due: dueDate({ periodEnd: period.end, payDay: term.pay_day, payMonthOffset: term.pay_month_offset, holidayRule: term.holiday_rule }),
        createdBy: contract.created_by, actorId,
      })
    }
    return periods.length
  },

  // Bill sẽ đổi thế nào nếu hợp đồng có ngày bắt đầu / kết thúc `start`, `end` (mặc định: ngày đang lưu). Chỉ đọc;
  // lock = true khoá các dòng bill trong transaction duyệt. fingerprint đổi khi bill (kỳ, trạng thái, số tiền) hoặc ngày đổi.
  async planFor(conn, contractId, { start, end, side = SIDE, lock = false } = {}) {
    const [[contract]] = await conn.query('SELECT id, start_date, end_date FROM seafarer_contract WHERE id = ? AND deleted_at IS NULL', [contractId])
    if (!contract) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
    const [billRows] = await conn.query(
      `SELECT b.id, b.code, b.seq, b.period_start, b.period_end, b.due_date, b.status, b.updated_at, ${TOTAL_SQL} AS total_usd,
          EXISTS (SELECT 1 FROM contract_bill_log l WHERE l.bill_id = b.id AND l.action = 'UPDATE') AS edited
       FROM contract_bill b WHERE b.contract_id = ? AND b.side = ? AND b.deleted_at IS NULL ORDER BY b.seq${lock ? ' FOR UPDATE OF b' : ''}`,
      [contractId, side])
    const [[term]] = await conn.query('SELECT closing_day, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id = ? AND side = ?', [contractId, side])
    const target = { start: iso(start || contract.start_date), end: iso(end || contract.end_date) }
    const bills = billRows.map((b) => ({ ...b, edited: Boolean(b.edited) }))
    if (!term) throw { statusCode: 409, message: 'Hợp đồng chưa có kỳ thanh toán' }
    const plan = planBillChanges({ ...target, bills, term })
    const fingerprint = crypto.createHash('sha1').update(JSON.stringify([
      target, bills.map((b) => [b.id, b.seq, iso(b.period_start), iso(b.period_end), b.status, Number(b.total_usd), String(b.updated_at)]),
    ])).digest('hex')
    return {
      ...plan,
      fingerprint,
      contract_range: { start: iso(contract.start_date), end: iso(contract.end_date) },
      bills_range: bills.length ? { start: iso(bills[0].period_start), end: iso(bills[bills.length - 1].period_end), count: bills.length } : null,
    }
  },

  // Áp plan lên bill của một bên, trong transaction của việc duyệt. FIRST do generateForContract làm.
  async applyPlan(conn, contractId, plan, side = SIDE, actorId = null) {
    for (const item of plan.remove) {
      await conn.query('UPDATE contract_bill SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [actorId ?? null, item.bill_id])
      await writeLog(conn, item.bill_id, 'DELETE', actorId, { seq: item.seq, start: item.start, end: item.end, edited: item.edited })
    }
    for (const item of plan.cut) {
      await conn.query('UPDATE contract_bill SET period_end = ?, due_date = ?, updated_by = ? WHERE id = ?', [item.to.end, item.due_date, actorId ?? null, item.bill_id])
      await writeLog(conn, item.bill_id, 'CUT', actorId, { from: item.from, to: item.to })
    }
    if (plan.create.length) {
      const [[contract]] = await conn.query('SELECT created_by FROM seafarer_contract WHERE id = ?', [contractId])
      const { lines } = await loadGeneration(conn, contractId, side)
      for (const item of plan.create) {
        await insertBill(conn, {
          contractId, side, seq: item.seq, start: item.start, end: item.end, due: item.due_date, lines, withOneTime: item.with_one_time,
          createdBy: contract.created_by, actorId,
        })
      }
    }
  },

  async list(pool, query) {
    const { page, limit, offset } = paging(query)
    const params = [SIDE]
    let where = 'WHERE b.side = ? AND b.deleted_at IS NULL'
    if (query.ownerId) {
      where += ' AND b.created_by = ?'
      params.push(Number(query.ownerId))
    }
    if (query.search) {
      where += ' AND (b.code ILIKE ? OR unaccent(c.contract_number::text) ILIKE unaccent(?) OR unaccent(s.full_name::text) ILIKE unaccent(?))'
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`)
    }
    for (const [key, column] of [['ship_owner_id', 'o.id'], ['seafarer_voyage_id', 'c.seafarer_voyage_id'], ['contract_id', 'b.contract_id']]) {
      if (query[key]) {
        where += ` AND ${column} = ?`
        params.push(Number(query[key]))
      }
    }
    const [countRows] = await pool.query(`SELECT ${DISPLAY_SQL} AS display_status, COUNT(*) AS n ${BILL_FROM} ${where} GROUP BY 1`, params)
    const counts = { all: 0, ...Object.fromEntries(BILL_DISPLAY_STATUSES.map((key) => [key, 0])) }
    for (const row of countRows) {
      counts[row.display_status] = Number(row.n)
      counts.all += Number(row.n)
    }
    const tab = BILL_DISPLAY_STATUSES.includes(query.tab) ? query.tab : null
    const tabWhere = tab ? ` AND ${DISPLAY_SQL} = ?` : ''
    const order = !tab || tab === 'PAID' ? 'DESC' : 'ASC'
    const [rows] = await pool.query(
      `${BILL_SELECT} ${BILL_FROM} ${where}${tabWhere} ORDER BY b.due_date ${order}, b.id ${order} LIMIT ? OFFSET ?`,
      [...params, ...(tab ? [tab] : []), limit, offset]
    )
    const [[sumRow]] = await pool.query(`SELECT COALESCE(SUM(${TOTAL_SQL}), 0) AS total ${BILL_FROM} ${where}${tabWhere}`, [...params, ...(tab ? [tab] : [])])
    return { data: rows.map(summary), total: tab ? counts[tab] : counts.all, counts, total_usd: Number(sumRow.total), page, limit }
  },

  async get(pool, id) {
    const [[row]] = await pool.query(`${BILL_SELECT}, c.created_by AS contract_created_by ${BILL_FROM} WHERE b.id = ? AND b.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy yêu cầu thanh toán' }
    const [itemRows] = await pool.query('SELECT id, item_code, kind, name, default_usd, amount_usd FROM contract_bill_item WHERE bill_id = ? ORDER BY sort_order, id', [id])
    const [[term]] = await pool.query('SELECT closing_day, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id = ? AND side = ?', [row.contract_id, row.side])
    const [siblingRows] = await pool.query(
      `SELECT b.id, b.code, b.seq, b.period_start, b.period_end, b.due_date, b.status, ${DISPLAY_SQL} AS display_status, ${TOTAL_SQL} AS total_usd
       FROM contract_bill b WHERE b.contract_id = ? AND b.side = ? AND b.deleted_at IS NULL ORDER BY b.seq`,
      [row.contract_id, row.side]
    )
    const [logRows] = await pool.query(
      `SELECT l.id, l.action, u.email AS actor_name, l.created_at
       FROM contract_bill_log l LEFT JOIN "user" u ON u.id = l.actor_id WHERE l.bill_id = ? ORDER BY l.created_at DESC, l.id DESC`,
      [id]
    )
    return {
      bill: { ...summary(row), note: row.note, sent_at: row.sent_at, paid_date: row.paid_date, version: row.version },
      items: itemRows.map((item) => ({ id: item.id, item_code: item.item_code, kind: item.kind, name: item.name, default_usd: num(item.default_usd), amount_usd: num(item.amount_usd) })),
      term: term || null,
      periods: siblingRows.map((b) => ({ id: b.id, code: b.code, seq: b.seq, period_start: b.period_start, period_end: b.period_end, due_date: b.due_date, status: b.status, display_status: b.display_status, total_usd: Number(b.total_usd) })),
      log: logRows,
    }
  },

  // body: { items: [{ id?, kind, name?, amount_usd }], note, due_date? }. Khoản chép từ hợp đồng chỉ đổi số; dòng điều chỉnh thêm, sửa, xoá được.
  async update(pool, id, body, userId) {
    const input = Array.isArray(body.items) ? body.items : []
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
    await withTransaction(pool, async (conn) => {
      const [[bill]] = await conn.query('SELECT id, status, period_start, version, updated_at, updated_by FROM contract_bill WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
      if (!bill) throw { statusCode: 404, message: 'Không tìm thấy yêu cầu thanh toán' }
      await assertVersion(conn, bill, body.version)
      if (bill.status !== 'OPEN') throw { statusCode: 409, message: `Yêu cầu thanh toán đang ở trạng thái ${STATUS_LABELS[bill.status]}, không sửa được` }
      const [current] = await conn.query('SELECT id, kind, amount_usd FROM contract_bill_item WHERE bill_id = ?', [id])
      const byId = new Map(current.map((item) => [item.id, item]))
      const seen = new Set()
      const adjustments = input.filter((item) => !item.id || byId.get(item.id)?.kind === 'ADJUSTMENT')
      if (adjustments.length > MAX_ADJUSTMENTS) throw { statusCode: 400, message: `Tối đa ${MAX_ADJUSTMENTS} dòng điều chỉnh` }
      let total = 0
      for (const item of input) {
        const amount = Number(item.amount_usd)
        if (!Number.isFinite(amount)) throw { statusCode: 400, message: 'Số tiền không hợp lệ' }
        if (item.id) {
          const existing = byId.get(item.id)
          if (!existing || seen.has(item.id)) throw { statusCode: 400, message: 'Dòng tiền không thuộc yêu cầu thanh toán này' }
          seen.add(item.id)
        }
        const isAdjustment = !item.id || byId.get(item.id).kind === 'ADJUSTMENT'
        if (!isAdjustment && amount < 0) throw { statusCode: 400, message: 'Khoản chép từ hợp đồng không được âm' }
        if (isAdjustment && !(typeof item.name === 'string' && item.name.trim())) throw { statusCode: 400, message: 'Dòng điều chỉnh cần tên' }
        total += amount
      }
      for (const item of current) {
        if (item.kind !== 'ADJUSTMENT' && !seen.has(item.id)) total += Number(item.amount_usd)
      }
      if (round2(total) < 0) throw { statusCode: 400, message: 'Tổng yêu cầu thanh toán không được âm' }
      for (const item of input) {
        const amount = round2(Number(item.amount_usd))
        if (item.id && byId.get(item.id).kind !== 'ADJUSTMENT') {
          await conn.query('UPDATE contract_bill_item SET amount_usd = ? WHERE id = ?', [amount, item.id])
        } else if (item.id) {
          await conn.query('UPDATE contract_bill_item SET name = ?, amount_usd = ? WHERE id = ?', [item.name.trim().slice(0, 100), amount, item.id])
        }
      }
      for (const item of current) {
        if (item.kind === 'ADJUSTMENT' && !seen.has(item.id)) await conn.query('DELETE FROM contract_bill_item WHERE id = ?', [item.id])
      }
      for (const [index, item] of input.filter((i) => !i.id).entries()) {
        await conn.query('INSERT INTO contract_bill_item SET ?', [{ bill_id: id, kind: 'ADJUSTMENT', name: item.name.trim().slice(0, 100), default_usd: null, amount_usd: round2(Number(item.amount_usd)), sort_order: 1000 + index }])
      }
      const fields = { note, updated_by: userId ?? null }
      if (body.due_date) {
        if (body.due_date < String(bill.period_start).slice(0, 10)) throw { statusCode: 400, message: 'Hạn thanh toán không được trước ngày bắt đầu kỳ' }
        fields.due_date = body.due_date
      }
      await conn.query('UPDATE contract_bill SET ? WHERE id = ?', [fields, id])
      await writeLog(conn, id, 'UPDATE', userId)
    })
    return this.get(pool, id)
  },

  // Bỏ duyệt nhiều bill một lần (hộp duyệt lại hợp đồng). Mọi bill phải đang Đã duyệt, không thì không bỏ bill nào.
  async unapproveMany(pool, ids, userId) {
    await withTransaction(pool, async (conn) => {
      const [rows] = await conn.query('SELECT id, code, status FROM contract_bill WHERE id IN (?) AND deleted_at IS NULL FOR UPDATE', [ids])
      if (rows.length !== new Set(ids).size) throw { statusCode: 404, message: 'Không tìm thấy yêu cầu thanh toán' }
      const wrong = rows.filter((row) => row.status !== 'APPROVED')
      if (wrong.length) throw { statusCode: 409, message: `Không bỏ duyệt được: ${wrong.map((b) => `${b.code} (${STATUS_LABELS[b.status]})`).join(', ')}` }
      await conn.query('UPDATE contract_bill SET status = \'OPEN\', approved_at = NULL, approved_by = NULL, updated_by = ? WHERE id IN (?)', [userId ?? null, ids])
      for (const row of rows) await writeLog(conn, row.id, 'UNAPPROVE', userId)
    })
    return { success: true, count: ids.length }
  },

  // action: approve | unapprove | send | unsend | collect | uncollect. extra: { paid_date } cho collect.
  async transition(pool, id, action, extra = {}, userId) {
    const rule = TRANSITIONS[action]
    await withTransaction(pool, async (conn) => {
      const [[bill]] = await conn.query(
        'SELECT id, status, period_end, CURRENT_DATE::text AS today FROM contract_bill WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      )
      if (!bill) throw { statusCode: 404, message: 'Không tìm thấy yêu cầu thanh toán' }
      if (bill.status !== rule.from) {
        const hint = action === 'send' && bill.status === 'OPEN' ? '. Cần duyệt trước khi gửi' : ''
        throw { statusCode: 409, message: `Không thực hiện được: yêu cầu thanh toán đang ở trạng thái ${STATUS_LABELS[bill.status]}${hint}` }
      }
      const fields = { status: rule.to, updated_by: userId ?? null }
      if (action === 'approve') {
        if (bill.today < String(bill.period_end).slice(0, 10)) throw { statusCode: 409, message: 'Chưa đến ngày chốt sổ của kỳ này, chưa duyệt được' }
        const [[editor]] = await conn.query('SELECT actor_id FROM contract_bill_log WHERE bill_id = ? AND action = \'UPDATE\' ORDER BY id DESC LIMIT 1', [id])
        if (editor && userId != null && editor.actor_id === userId) throw { statusCode: 409, message: 'Người đã sửa yêu cầu thanh toán không được tự duyệt, nhờ người khác duyệt' }
        Object.assign(fields, { approved_at: new Date(), approved_by: userId ?? null })
      }
      if (action === 'unapprove') Object.assign(fields, { approved_at: null, approved_by: null })
      if (action === 'send') {
        if (bill.today < String(bill.period_end).slice(0, 10)) throw { statusCode: 409, message: 'Chưa đến ngày chốt sổ của kỳ này' }
        Object.assign(fields, { sent_at: new Date(), sent_by: userId ?? null })
      }
      if (action === 'unsend') Object.assign(fields, { sent_at: null, sent_by: null, approved_at: null, approved_by: null })
      if (action === 'collect') {
        const paidDate = extra.paid_date || bill.today
        if (paidDate > bill.today) throw { statusCode: 400, message: 'Ngày thu không được sau hôm nay' }
        Object.assign(fields, { paid_date: paidDate, paid_by: userId ?? null })
      }
      if (action === 'uncollect') Object.assign(fields, { paid_date: null, paid_by: null })
      await conn.query('UPDATE contract_bill SET ? WHERE id = ?', [fields, id])
      await writeLog(conn, id, rule.log, userId)
    })
    return this.get(pool, id)
  },
}

module.exports = { contractBillService, TRANSITIONS, STATUS_LABELS }
