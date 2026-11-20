const { withTransaction } = require('../utils/transaction')
const { assertVersion } = require('../utils/row_version')
const { dueDate } = require('../utils/voyage_math')
const { payoutDefaults, fullAmounts, sumAmounts, monthRange } = require('../utils/payout_math')
const { DEFAULT_ITEMS } = require('../constants/voyage_contract')
const { BILL_FROM, DISPLAY_SQL, TOTAL_SQL } = require('./contract_bill.service')

// Trả lương thuyền viên (docs/mcah-ke-hoach-tra-luong.md phần B): mỗi dòng là một bill phải thu. Dòng Thu lấy từ bill;
// dòng Trả lấy bản ghi đã chốt, chưa có thì mặc định từ cột Phải chi của hợp đồng. Chuyển tiền làm ngoài hệ thống.

const CODES = DEFAULT_ITEMS.map((item) => item.code)
// Cột TIMESTAMP không múi giờ lưu giờ UTC; pg đọc ra theo giờ máy nên lệch. Trả chuỗi ISO UTC rõ ràng cho giao diện.
const UTC_ISO = 'YYYY-MM-DD"T"HH24:MI:SS"Z"'
const iso = (v) => (v == null ? null : String(v).slice(0, 10))
const group = (rows, key) => rows.reduce((map, row) => map.set(row[key], [...(map.get(row[key]) || []), row]), new Map())

async function writeLog(conn, payoutId, action, actorId, payload = null) {
  await conn.query('INSERT INTO seafarer_payout_log SET ?', [{ payout_id: payoutId, action, actor_id: actorId ?? null, payload: payload && JSON.stringify(payload) }])
}

// Số gửi lên phải đủ 14 mã, mỗi số ≥ 0.
function validAmounts(amounts) {
  if (!amounts || typeof amounts !== 'object') return false
  const keys = Object.keys(amounts)
  if (keys.length !== CODES.length || !CODES.every((code) => keys.includes(code))) return false
  return CODES.every((code) => Number.isFinite(Number(amounts[code])) && Number(amounts[code]) >= 0)
}

const payoutService = {
  // query: { month: 'YYYY-MM', tab: all | UNPAID | PAID, search, ship_owner_id, ownerId }.
  async list(pool, query) {
    const { from, to } = monthRange(query.month)
    const params = [from, to]
    let where = 'WHERE b.side = \'RECEIVABLE\' AND b.deleted_at IS NULL AND b.period_end BETWEEN ? AND ?'
    if (query.ownerId) {
      where += ' AND b.created_by = ?'
      params.push(Number(query.ownerId))
    }
    if (query.search) {
      where += ' AND (unaccent(b.code::text) ILIKE unaccent(?) OR unaccent(c.contract_number::text) ILIKE unaccent(?) OR unaccent(s.full_name::text) ILIKE unaccent(?))'
      params.push(...Array(3).fill(`%${query.search}%`))
    }
    if (query.ship_owner_id) {
      where += ' AND o.id = ?'
      params.push(Number(query.ship_owner_id))
    }
    // Một tháng chỉ vài chục, vài trăm bill: đọc hết để đếm tab và cộng tổng, rồi mới cắt trang.
    const [billRows] = await pool.query(
      `SELECT b.id, b.code, b.seq, b.status, to_char(b.approved_at, ?) AS approved_at, COALESCE(ua.full_name, ua.email) AS approved_by_name, b.contract_id, b.period_start, b.period_end, b.due_date, ${DISPLAY_SQL} AS display_status, ${TOTAL_SQL} AS total_usd,
          (SELECT COUNT(*) FROM contract_bill b2 WHERE b2.contract_id = b.contract_id AND b2.side = b.side AND b2.deleted_at IS NULL) AS periods,
          c.contract_number, c.seafarer_id, s.full_name AS seafarer_name, r.name_vi AS rank_name,
          ves.id AS vessel_id, ves.vessel_name, o.id AS ship_owner_id, o.company_name AS ship_owner_name,
          sp.id AS payout_id, sp.version AS payout_version, sp.status AS payout_status, sp.paid_date, to_char(sp.updated_at, ?) AS paid_at, sp.bill_total_usd, COALESCE(u.full_name, u.email) AS paid_by_name
       ${BILL_FROM}
       LEFT JOIN seafarer_payout sp ON sp.bill_id = b.id
       LEFT JOIN "user" u ON u.id = sp.paid_by
       LEFT JOIN "user" ua ON ua.id = b.approved_by
       ${where} ORDER BY b.period_end, s.full_name, b.id`,
      [UTC_ISO, UTC_ISO, ...params]
    )
    const empty = { rows: [], counts: { all: 0, UNPAID: 0, PAID: 0 }, totals: { receivable_usd: 0, payable_usd: 0 }, total: 0 }
    if (!billRows.length) return { ...empty, month: query.month }
    const billIds = billRows.map((row) => row.id)
    const contractIds = [...new Set(billRows.map((row) => row.contract_id))]
    const payoutIds = billRows.map((row) => row.payout_id).filter(Boolean)
    const [billItems] = await pool.query('SELECT bill_id, item_code, amount_usd FROM contract_bill_item WHERE bill_id IN (?)', [billIds])
    const [contractItems] = await pool.query('SELECT contract_id, item_code, payable_usd FROM contract_item WHERE contract_id IN (?)', [contractIds])
    const [terms] = await pool.query('SELECT contract_id, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id IN (?) AND side = \'PAYABLE\'', [contractIds])
    const [payoutItems] = payoutIds.length
      ? await pool.query('SELECT payout_id, item_code, amount_usd FROM seafarer_payout_item WHERE payout_id IN (?)', [payoutIds])
      : [[]]
    const billItemsBy = group(billItems, 'bill_id')
    const contractItemsBy = group(contractItems, 'contract_id')
    const payoutItemsBy = group(payoutItems, 'payout_id')
    const termBy = new Map(terms.map((term) => [term.contract_id, term]))

    const all = billRows.map((row) => {
      const defaults = payoutDefaults({ contractItems: contractItemsBy.get(row.contract_id), seq: row.seq })
      const amounts = row.payout_id ? fullAmounts(payoutItemsBy.get(row.payout_id)) : defaults
      const term = termBy.get(row.contract_id)
      return {
        bill: {
          id: row.id, code: row.code, seq: row.seq, periods: Number(row.periods), period_start: iso(row.period_start), period_end: iso(row.period_end),
          due_date: iso(row.due_date), status: row.status, display_status: row.display_status,
          approved_at: row.approved_at ?? null, approved_by_name: row.approved_by_name ?? null, total_usd: Number(row.total_usd), amounts: fullAmounts(billItemsBy.get(row.id)),
        },
        payout: {
          id: row.payout_id || null,
          version: row.payout_version ?? null,
          status: row.payout_status || 'UNPAID',
          paid_date: iso(row.paid_date),
          paid_by_name: row.payout_status === 'PAID' ? row.paid_by_name : null,
          paid_at: row.payout_status === 'PAID' ? row.paid_at : null,
          bill_total_usd: row.bill_total_usd == null ? null : Number(row.bill_total_usd),
          amounts,
          defaults,
          total_usd: sumAmounts(amounts),
        },
        payable_due_date: term ? dueDate({ periodEnd: iso(row.period_end), payDay: term.pay_day, payMonthOffset: term.pay_month_offset, holidayRule: term.holiday_rule }) : null,
        seafarer: { id: row.seafarer_id, full_name: row.seafarer_name, rank_name: row.rank_name },
        contract: { id: row.contract_id, contract_number: row.contract_number },
        ship_owner: { id: row.ship_owner_id, company_name: row.ship_owner_name },
        vessel: { id: row.vessel_id, vessel_name: row.vessel_name },
      }
    })
    const counts = { all: all.length, UNPAID: all.filter((r) => r.payout.status !== 'PAID').length, PAID: all.filter((r) => r.payout.status === 'PAID').length }
    const shown = query.tab === 'PAID' || query.tab === 'UNPAID' ? all.filter((r) => (r.payout.status === 'PAID') === (query.tab === 'PAID')) : all
    // Trang Trả lương đổ hết dòng của tháng (không phân trang). Tổng chân bảng: thu của bill đã duyệt trở đi, trả của dòng đã chốt.
    return {
      month: query.month,
      rows: shown,
      counts,
      totals: {
        receivable_usd: sumAmounts(shown.filter((r) => r.bill.status !== 'OPEN').map((r) => r.bill.total_usd)),
        payable_usd: sumAmounts(shown.filter((r) => r.payout.status === 'PAID').map((r) => r.payout.total_usd)),
      },
      total: shown.length,
    }
  },

  // rows: [{ bill_id, version, amounts: { [mã]: số } }]. Tất cả hoặc không; ngày trả = hôm nay (ngày máy chủ).
  async pay(pool, rows, userId, ownerId = null) {
    if (new Set(rows.map((row) => row.bill_id)).size !== rows.length) throw { statusCode: 400, message: 'Một kỳ bị gửi hai lần' }
    try {
      return await withTransaction(pool, async (conn) => {
        const [[{ today }]] = await conn.query('SELECT CURRENT_DATE::text AS today')
        const failed = []
        const ready = []
        for (const row of rows) {
          const [[bill]] = await conn.query('SELECT id, code, seq, side, contract_id, created_by FROM contract_bill WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [row.bill_id])
          const fail = (statusCode, message) => failed.push({ bill_id: row.bill_id, code: bill?.code ?? null, statusCode, message })
          if (!bill || (ownerId && bill.created_by !== Number(ownerId))) { fail(404, 'Không tìm thấy yêu cầu thanh toán'); continue }
          if (bill.side !== 'RECEIVABLE') { fail(400, 'Không phải yêu cầu thanh toán phải thu'); continue }
          const [[payout]] = await conn.query('SELECT id, status, version FROM seafarer_payout WHERE bill_id = ? FOR UPDATE', [bill.id])
          if (payout?.status === 'PAID') { fail(409, 'Đã chốt trả lương'); continue }
          if ((row.version ?? null) !== (payout?.version ?? null)) { fail(409, 'Người khác vừa sửa dòng này, tải lại trang'); continue }
          if (!validAmounts(row.amounts)) { fail(400, 'Số trả không hợp lệ: cần đủ các khoản, không được âm'); continue }
          ready.push({ bill, payout, amounts: fullAmounts(CODES.map((code) => ({ item_code: code, amount_usd: row.amounts[code] }))) })
        }
        if (failed.length) {
          const statusCode = failed.some((f) => f.statusCode === 409) ? 409 : failed[0].statusCode
          throw { statusCode, message: `Chưa chốt dòng nào. ${failed.map((f) => `${f.code || `#${f.bill_id}`}: ${f.message}`).join('; ')}`, failed_rows: failed }
        }
        const payouts = []
        for (const { bill, payout, amounts } of ready) {
          const [[{ total }]] = await conn.query('SELECT COALESCE(SUM(amount_usd), 0) AS total FROM contract_bill_item WHERE bill_id = ?', [bill.id])
          const fields = { status: 'PAID', paid_date: today, paid_by: userId ?? null, bill_total_usd: Number(total), updated_by: userId ?? null }
          let payoutId = payout?.id
          if (payoutId) {
            await conn.query('UPDATE seafarer_payout SET ? WHERE id = ?', [fields, payoutId])
            for (const code of CODES) await conn.query('UPDATE seafarer_payout_item SET amount_usd = ? WHERE payout_id = ? AND item_code = ?', [amounts[code], payoutId, code])
          } else {
            const [inserted] = await conn.query('INSERT INTO seafarer_payout SET ?', [{ ...fields, bill_id: bill.id, created_by: userId ?? null }])
            payoutId = inserted.insertId
            const [contractItems] = await conn.query('SELECT item_code, payable_usd FROM contract_item WHERE contract_id = ?', [bill.contract_id])
            const defaults = payoutDefaults({ contractItems, seq: bill.seq })
            for (const [order, item] of DEFAULT_ITEMS.entries()) {
              await conn.query('INSERT INTO seafarer_payout_item SET ?', [{
                payout_id: payoutId, item_code: item.code, kind: item.kind, default_usd: defaults[item.code], amount_usd: amounts[item.code], sort_order: order,
              }])
            }
          }
          await writeLog(conn, payoutId, 'PAY', userId, { paid_date: today, amounts })
          const [[saved]] = await conn.query('SELECT id, version FROM seafarer_payout WHERE id = ?', [payoutId])
          payouts.push({ bill_id: bill.id, id: saved.id, version: saved.version })
        }
        // payouts: id và phiên bản mới của từng dòng, để Hoàn tác (huỷ chốt) ngay trên toast.
        return { count: ready.length, paid_date: today, total_usd: sumAmounts(ready.map((r) => sumAmounts(r.amounts))), payouts }
      })
    } catch (error) {
      // Hai người cùng chốt lần đầu một kỳ: UNIQUE bill_id chặn người sau.
      if (error.code === '23505') throw { statusCode: 409, message: 'Người khác vừa chốt trả lương kỳ này, tải lại trang' }
      throw error
    }
  },

  async unpay(pool, id, version, userId, ownerId = null) {
    await withTransaction(pool, async (conn) => {
      const [[payout]] = await conn.query(
        `SELECT p.id, p.status, p.version, p.updated_at, p.updated_by, b.created_by AS bill_created_by
         FROM seafarer_payout p JOIN contract_bill b ON b.id = p.bill_id WHERE p.id = ? AND b.deleted_at IS NULL FOR UPDATE OF p`, [id])
      if (!payout || (ownerId && payout.bill_created_by !== Number(ownerId))) throw { statusCode: 404, message: 'Không tìm thấy bản ghi trả lương' }
      await assertVersion(conn, payout, version)
      if (payout.status !== 'PAID') throw { statusCode: 409, message: 'Dòng này chưa chốt trả lương' }
      await conn.query('UPDATE seafarer_payout SET ? WHERE id = ?', [{ status: 'UNPAID', paid_date: null, paid_by: null, bill_total_usd: null, updated_by: userId ?? null }, id])
      await writeLog(conn, id, 'UNPAY', userId)
    })
    return { success: true }
  },
}

module.exports = { payoutService }
