import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { payoutService: service } = require('../payout.service')
const { DEFAULT_ITEMS } = require('../../constants/voyage_contract')

// Pool giả như contract_bill.test.js: khớp đoạn SQL thô đầu tiên, ghi lại mọi câu đã chạy.
function fakePool(routes) {
  const calls = []
  const run = async (sql, params = []) => {
    calls.push({ sql, params })
    const hit = routes.find(([needle]) => sql.includes(needle))
    return hit ? hit[1](sql, params) : [[]]
  }
  return {
    calls,
    query: run,
    async getConnection() {
      return { query: run, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }
    },
  }
}
const inserts = (pool, table) => pool.calls.filter((c) => c.sql.startsWith(`INSERT INTO ${table} `)).map((c) => c.params[0])
const zero = () => Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.code, 0]))
const amounts = (over = {}) => ({ ...zero(), ...over })

const billRow = (over = {}) => ({
  id: 41, code: 'CH-01/HĐ/T1', seq: 1, contract_id: 12, period_start: '2026-10-15', period_end: '2026-10-31', due_date: '2026-11-10',
  display_status: 'SENT', total_usd: '2250', periods: '6', contract_number: 'CH-01/HĐ', seafarer_id: 7, seafarer_name: 'Nguyễn Hữu Phước',
  rank_name: 'Thợ máy', status: 'APPROVED', vessel_id: 5, vessel_name: 'MV Ocean Glory', ship_owner_id: 3, ship_owner_name: 'Hải Âu', payout_id: null, ...over,
})
const listRoutes = (rows) => [
  ['LEFT JOIN seafarer_payout sp', () => [rows]],
  ['FROM contract_bill_item WHERE bill_id IN', () => [[
    { bill_id: 41, item_code: 'BASIC_WAGE', amount_usd: '1500' }, { bill_id: 41, item_code: 'FLIGHT_OUT', amount_usd: '500' },
    { bill_id: 41, item_code: 'SERVICE_FEE', amount_usd: '150' }, { bill_id: 41, item_code: 'OTHER_MONTHLY', amount_usd: '100' },
    { bill_id: 42, item_code: 'BASIC_WAGE', amount_usd: '6000' },
  ]]],
  ['FROM contract_item WHERE contract_id IN', () => [[
    { contract_id: 12, item_code: 'BASIC_WAGE', payable_usd: '1300' }, { contract_id: 12, item_code: 'OTHER_MONTHLY', payable_usd: '80' },
    { contract_id: 12, item_code: 'FLIGHT_OUT', payable_usd: '500' },
  ]]],
  ['FROM contract_payment_term', () => [[{ contract_id: 12, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' }]]],
  ['FROM seafarer_payout_item WHERE payout_id IN', () => [[{ payout_id: 9, item_code: 'BASIC_WAGE', amount_usd: '5800' }]]],
]

describe('payout.service list', () => {
  it('lọc theo tháng của ngày kết thúc kỳ; dòng chưa chốt lấy mặc định hợp đồng, dòng đã chốt lấy số đã lưu; đếm tab, cộng tổng', async () => {
    const pool = fakePool(listRoutes([
      billRow(),
      billRow({ id: 42, code: 'CH-02/HĐ/T6', seq: 6, total_usd: '6000', payout_id: 9, payout_version: 2, payout_status: 'PAID', paid_date: '2026-11-16', bill_total_usd: '6000', paid_by_name: 'kt@x' }),
    ]))
    const r = await service.list(pool, { month: '2026-10', ownerId: 3 })
    const main = pool.calls[0]
    expect(main.params.slice(2, 5)).toEqual(['2026-10-01', '2026-10-31', 3])
    expect(r.counts).toEqual({ all: 2, UNPAID: 1, PAID: 1 })
    const [a, b] = r.rows
    expect(Object.keys(a.bill.amounts)).toHaveLength(14)
    expect(a.bill.amounts).toMatchObject({ BASIC_WAGE: 1500, FLIGHT_OUT: 500, VISA_FEE: 0 })
    expect(a.payout).toMatchObject({ id: null, status: 'UNPAID', total_usd: 1880 })
    expect(a.payout.amounts).toMatchObject({ BASIC_WAGE: 1300, OTHER_MONTHLY: 80, FLIGHT_OUT: 500 })
    expect(a.payable_due_date).toBe('2026-11-13')
    expect(b.payout).toMatchObject({ id: 9, version: 2, status: 'PAID', paid_date: '2026-11-16', total_usd: 5800, bill_total_usd: 6000 })
    expect(r.totals).toEqual({ receivable_usd: 8250, payable_usd: 5800 })
  })

  it('tab Đã trả chỉ còn dòng đã chốt; tổng thu chỉ bill đã duyệt, tổng trả chỉ dòng đã chốt', async () => {
    const pool = fakePool(listRoutes([billRow(), billRow({ id: 42, seq: 6, status: 'OPEN', total_usd: '6000', payout_id: 9, payout_status: 'PAID', paid_date: '2026-11-16', bill_total_usd: '6000' })]))
    const r = await service.list(pool, { month: '2026-10', tab: 'PAID' })
    expect(r.rows.map((x) => x.bill.id)).toEqual([42])
    expect(r.totals).toEqual({ receivable_usd: 0, payable_usd: 5800 })
    expect(r.counts.all).toBe(2)
  })

  it('tháng trống', async () => {
    const r = await service.list(fakePool([]), { month: '2026-10' })
    expect(r.rows).toEqual([])
    expect(r.counts).toEqual({ all: 0, UNPAID: 0, PAID: 0 })
  })
})

describe('payout.service pay', () => {
  const payRoutes = ({ bills = {}, payouts = {} } = {}) => [
    ['CURRENT_DATE::text AS today', () => [[{ today: '2026-11-20' }]]],
    ['FROM contract_bill WHERE id = ? AND deleted_at IS NULL FOR UPDATE', (_, [id]) => [bills[id] ? [bills[id]] : []]],
    ['FROM seafarer_payout WHERE bill_id = ? FOR UPDATE', (_, [id]) => [payouts[id] ? [payouts[id]] : []]],
    ['SUM(amount_usd), 0) AS total FROM contract_bill_item', () => [[{ total: '2250' }]]],
    ['SELECT item_code, payable_usd FROM contract_item', () => [[{ item_code: 'BASIC_WAGE', payable_usd: '1300' }, { item_code: 'FLIGHT_OUT', payable_usd: '500' }]]],
    ['INSERT INTO seafarer_payout SET', () => [{ insertId: 77 }]],
    ['SELECT id, version FROM seafarer_payout WHERE id', (_, [id]) => [[{ id, version: 1 }]]],
  ]
  const bill = (id, over = {}) => ({ id, code: `B${id}`, seq: 1, side: 'RECEIVABLE', contract_id: 12, created_by: 3, ...over })

  it('chốt lần đầu: tạo bản ghi PAID ngày hôm nay, đủ 14 dòng với số mặc định hợp đồng và số đã sửa, lưu tổng bill, ghi log', async () => {
    const pool = fakePool(payRoutes({ bills: { 41: bill(41) } }))
    const r = await service.pay(pool, [{ bill_id: 41, version: null, amounts: amounts({ BASIC_WAGE: 1100, FLIGHT_OUT: 500 }) }], 4)
    expect(r).toEqual({ count: 1, paid_date: '2026-11-20', total_usd: 1600, payouts: [{ bill_id: 41, id: 77, version: 1 }] })
    expect(inserts(pool, 'seafarer_payout')[0]).toMatchObject({ bill_id: 41, status: 'PAID', paid_date: '2026-11-20', paid_by: 4, bill_total_usd: 2250 })
    const items = inserts(pool, 'seafarer_payout_item')
    expect(items).toHaveLength(14)
    expect(items[0]).toMatchObject({ payout_id: 77, item_code: 'BASIC_WAGE', default_usd: 1300, amount_usd: 1100 })
    expect(inserts(pool, 'seafarer_payout_log')[0]).toMatchObject({ payout_id: 77, action: 'PAY' })
  })

  it('chốt lại sau huỷ chốt: cập nhật bản ghi cũ, không tạo mới', async () => {
    const pool = fakePool(payRoutes({ bills: { 41: bill(41) }, payouts: { 41: { id: 9, status: 'UNPAID', version: 3 } } }))
    await service.pay(pool, [{ bill_id: 41, version: 3, amounts: amounts({ BASIC_WAGE: 1000 }) }], 4)
    expect(inserts(pool, 'seafarer_payout')).toHaveLength(0)
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer_payout SET')).params[0]).toMatchObject({ status: 'PAID', paid_date: '2026-11-20' })
    expect(pool.calls.filter((c) => c.sql.startsWith('UPDATE seafarer_payout_item'))).toHaveLength(14)
  })

  it('tất cả hoặc không: một dòng đã chốt thì báo 409, không ghi dòng nào', async () => {
    const pool = fakePool(payRoutes({ bills: { 41: bill(41), 42: bill(42) }, payouts: { 42: { id: 9, status: 'PAID', version: 1 } } }))
    const error = await service.pay(pool, [{ bill_id: 41, version: null, amounts: amounts() }, { bill_id: 42, version: 1, amounts: amounts() }], 4).catch((e) => e)
    expect(error).toMatchObject({ statusCode: 409 })
    expect(error.failed_rows).toEqual([expect.objectContaining({ bill_id: 42, code: 'B42', message: 'Đã chốt trả lương' })])
    expect(inserts(pool, 'seafarer_payout')).toHaveLength(0)
  })

  it('phiên bản lệch (người khác vừa tạo / huỷ chốt) thì 409', async () => {
    const pool = fakePool(payRoutes({ bills: { 41: bill(41) }, payouts: { 41: { id: 9, status: 'UNPAID', version: 4 } } }))
    await expect(service.pay(pool, [{ bill_id: 41, version: null, amounts: amounts() }], 4)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('ngoài phạm vi, không tồn tại thì 404; thiếu mã hoặc số âm thì 400; gửi trùng kỳ thì 400', async () => {
    const pool = () => fakePool(payRoutes({ bills: { 41: bill(41, { created_by: 8 }) } }))
    await expect(service.pay(pool(), [{ bill_id: 41, version: null, amounts: amounts() }], 4, 3)).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.pay(pool(), [{ bill_id: 99, version: null, amounts: amounts() }], 4)).rejects.toMatchObject({ statusCode: 404 })
    const missing = amounts()
    delete missing.BONUS
    await expect(service.pay(pool(), [{ bill_id: 41, version: null, amounts: missing }], 4)).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.pay(pool(), [{ bill_id: 41, version: null, amounts: amounts({ BONUS: -1 }) }], 4)).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.pay(pool(), [{ bill_id: 41, amounts: amounts() }, { bill_id: 41, amounts: amounts() }], 4)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('hai người cùng chốt lần đầu (UNIQUE bill_id) thì 409', async () => {
    const pool = fakePool([...payRoutes({ bills: { 41: bill(41) } }).filter(([k]) => k !== 'INSERT INTO seafarer_payout SET'),
      ['INSERT INTO seafarer_payout SET', () => { throw Object.assign(new Error('dup'), { code: '23505' }) }]])
    await expect(service.pay(pool, [{ bill_id: 41, version: null, amounts: amounts() }], 4)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('payout.service unpay', () => {
  const routes = (row) => [['FOR UPDATE OF p', () => [row ? [row] : []]]]
  it('huỷ chốt: về UNPAID, xoá ngày trả, giữ số, ghi log', async () => {
    const pool = fakePool(routes({ id: 9, status: 'PAID', version: 2, bill_created_by: 3 }))
    await service.unpay(pool, 9, 2, 4)
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer_payout SET')).params[0]).toEqual({ status: 'UNPAID', paid_date: null, paid_by: null, bill_total_usd: null, updated_by: 4 })
    expect(pool.calls.some((c) => c.sql.includes('seafarer_payout_item'))).toBe(false)
    expect(inserts(pool, 'seafarer_payout_log')[0]).toMatchObject({ action: 'UNPAY' })
  })
  it('chưa chốt thì 409; lệch phiên bản thì 409; ngoài phạm vi thì 404', async () => {
    await expect(service.unpay(fakePool(routes({ id: 9, status: 'UNPAID', version: 2, bill_created_by: 3 })), 9, 2, 4)).rejects.toMatchObject({ statusCode: 409 })
    await expect(service.unpay(fakePool(routes({ id: 9, status: 'PAID', version: 3, bill_created_by: 3 })), 9, 2, 4)).rejects.toMatchObject({ statusCode: 409 })
    await expect(service.unpay(fakePool(routes({ id: 9, status: 'PAID', version: 2, bill_created_by: 8 })), 9, 2, 4, 3)).rejects.toMatchObject({ statusCode: 404 })
  })
})
