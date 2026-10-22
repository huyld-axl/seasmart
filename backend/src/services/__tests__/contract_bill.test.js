import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { contractBillService: service } = require('../contract_bill.service')

// Pool giả như seafarer_contract.test.js: khớp đoạn SQL thô đầu tiên, ghi lại mọi câu đã chạy.
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

const generateRoutes = (over = {}) => {
  let counter = 0
  let billId = 100
  return [
    ['SELECT 1 FROM contract_bill WHERE contract_id', () => [over.existing ? [{ '?column?': 1 }] : []]],
    ['FROM seafarer_contract WHERE id', () => [[{ id: 9, start_date: '2026-03-12', end_date: '2026-06-11', created_by: 5 }]]],
    ['FROM contract_payment_term', () => [[{ closing_day: 25, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' }]]],
    ['FROM contract_item WHERE', () => [[
      { item_code: 'BASIC_WAGE', kind: 'MONTHLY', receivable_usd: '1150', payable_usd: '1050' },
      { item_code: 'BONUS', kind: 'MONTHLY', receivable_usd: null, payable_usd: null },
      { item_code: 'FLIGHT_OUT', kind: 'ONE_TIME', receivable_usd: '650', payable_usd: null },
      { item_code: null, custom_name: 'Phụ cấp tàu', kind: 'MONTHLY', receivable_usd: '50', payable_usd: '50' },
    ]]],
    ['INSERT INTO "code_counter"', () => { counter += 1; return [{ rows: [{ last_value: counter }] }] }],
    ['INSERT INTO contract_bill SET', () => { billId += 1; return [{ insertId: billId }] }],
  ]
}

describe('contract_bill.service', () => {
  it('sinh bill theo ngày chốt sổ: kỳ lẻ đầu, cuối; khoản một lần chỉ ở kỳ đầu; bỏ khoản trống', async () => {
    const pool = fakePool(generateRoutes())
    const made = await service.generateForContract(pool, 9, 'RECEIVABLE', 3)
    expect(made).toBe(4)
    const bills = inserts(pool, 'contract_bill')
    const year = new Date().getUTCFullYear()
    expect(bills.map((b) => [b.seq, b.period_start, b.period_end, b.due_date])).toEqual([
      [1, '2026-03-12', '2026-03-25', '2026-04-10'],
      [2, '2026-03-26', '2026-04-25', '2026-05-11'],
      [3, '2026-04-26', '2026-05-25', '2026-06-10'],
      [4, '2026-05-26', '2026-06-11', '2026-07-10'],
    ])
    expect(bills[0]).toMatchObject({ code: `TT-${year}-00001`, status: 'OPEN', side: 'RECEIVABLE', created_by: 5 })
    const items = inserts(pool, 'contract_bill_item')
    expect(items.filter((i) => i.bill_id === 101).map((i) => [i.name, i.amount_usd])).toEqual([['Lương cơ bản', 1150], ['Vé máy bay đi', 650], ['Phụ cấp tàu', 50]])
    expect(items.filter((i) => i.bill_id === 102).map((i) => i.name)).toEqual(['Lương cơ bản', 'Phụ cấp tàu'])
    expect(items.every((i) => i.default_usd === i.amount_usd)).toBe(true)
    expect(inserts(pool, 'contract_bill_log').map((l) => l.action)).toEqual(['CREATE', 'CREATE', 'CREATE', 'CREATE'])
  })

  it('đã có bill bên này thì không sinh thêm', async () => {
    const pool = fakePool(generateRoutes({ existing: true }))
    expect(await service.generateForContract(pool, 9)).toBe(0)
    expect(inserts(pool, 'contract_bill')).toHaveLength(0)
  })

  const editRoutes = (status = 'OPEN') => [
    ['FROM contract_bill WHERE id = ? AND deleted_at IS NULL FOR UPDATE', () => [[{ id: 7, status }]]],
    ['SELECT id, kind, amount_usd FROM contract_bill_item', () => [[{ id: 1, kind: 'MONTHLY', amount_usd: '1000' }, { id: 2, kind: 'ONE_TIME', amount_usd: '650' }, { id: 3, kind: 'ADJUSTMENT', amount_usd: '-50' }]]],
  ]

  it('sửa: đổi số khoản hợp đồng, thêm và xoá dòng điều chỉnh, ghi log UPDATE', async () => {
    const pool = fakePool(editRoutes())
    await service.update(pool, 7, { items: [{ id: 1, amount_usd: 900 }, { name: ' Trừ ngày nghỉ ', amount_usd: -200 }], note: ' ghi chú ' }, 4).catch(() => {})
    const sql = pool.calls.map((c) => c.sql)
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill_item SET amount_usd')).params).toEqual([900, 1])
    expect(pool.calls.find((c) => c.sql.startsWith('DELETE FROM contract_bill_item')).params).toEqual([3])
    expect(inserts(pool, 'contract_bill_item')[0]).toMatchObject({ kind: 'ADJUSTMENT', name: 'Trừ ngày nghỉ', amount_usd: -200, default_usd: null })
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill SET')).params[0]).toMatchObject({ note: 'ghi chú', updated_by: 4 })
    expect(sql.some((s) => s.startsWith('INSERT INTO contract_bill_log'))).toBe(true)
  })

  it('sửa hạn thanh toán: ghi vào bill; trước ngày bắt đầu kỳ thì 400', async () => {
    const pool = fakePool([['FOR UPDATE', () => [[{ id: 7, status: 'OPEN', period_start: '2026-10-01' }]]], ...editRoutes().slice(1)])
    await service.update(pool, 7, { items: [], due_date: '2026-11-12' }, 4).catch(() => {})
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill SET')).params[0]).toMatchObject({ due_date: '2026-11-12' })
    await expect(service.update(fakePool([['FOR UPDATE', () => [[{ id: 7, status: 'OPEN', period_start: '2026-10-01' }]]], ...editRoutes().slice(1)]), 7, { items: [], due_date: '2026-09-30' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sửa: đã gửi thì 409; tổng âm, khoản hợp đồng âm, dòng lạ thì 400', async () => {
    await expect(service.update(fakePool(editRoutes('SENT')), 7, { items: [] })).rejects.toMatchObject({ statusCode: 409 })
    await expect(service.update(fakePool(editRoutes()), 7, { items: [{ name: 'Trừ', amount_usd: -5000 }] })).rejects.toMatchObject({ statusCode: 400, message: 'Tổng yêu cầu thanh toán không được âm' })
    await expect(service.update(fakePool(editRoutes()), 7, { items: [{ id: 1, amount_usd: -1 }] })).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.update(fakePool(editRoutes()), 7, { items: [{ id: 99, amount_usd: 1 }] })).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.update(fakePool(editRoutes()), 7, { items: [{ amount_usd: 1 }] })).rejects.toMatchObject({ statusCode: 400, message: 'Dòng điều chỉnh cần tên' })
  })

  const moveRoutes = (bill) => [['CURRENT_DATE::text AS today', () => [[{ id: 7, period_end: '2026-10-31', today: '2026-10-21', ...bill }]]]]
  const updated = (pool) => pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill SET'))?.params[0]

  it('chuyển trạng thái: gửi khi đã tới ngày chốt, thu với ngày thu, thu hồi, huỷ ghi nhận', async () => {
    let pool = fakePool(moveRoutes({ status: 'OPEN', period_end: '2026-10-21' }))
    await service.transition(pool, 7, 'send', {}, 4).catch(() => {})
    expect(updated(pool)).toMatchObject({ status: 'SENT', sent_by: 4 })
    pool = fakePool(moveRoutes({ status: 'SENT' }))
    await service.transition(pool, 7, 'collect', { paid_date: '2026-10-20' }, 4).catch(() => {})
    expect(updated(pool)).toMatchObject({ status: 'PAID', paid_date: '2026-10-20', paid_by: 4 })
    pool = fakePool(moveRoutes({ status: 'SENT' }))
    await service.transition(pool, 7, 'unsend', {}, 4).catch(() => {})
    expect(updated(pool)).toMatchObject({ status: 'OPEN', sent_at: null })
    pool = fakePool(moveRoutes({ status: 'PAID' }))
    await service.transition(pool, 7, 'uncollect', {}, 4).catch(() => {})
    expect(updated(pool)).toMatchObject({ status: 'SENT', paid_date: null })
  })

  it('chuyển trạng thái sai: chưa tới ngày chốt, ngày thu tương lai, sai trạng thái', async () => {
    await expect(service.transition(fakePool(moveRoutes({ status: 'OPEN' })), 7, 'send')).rejects.toMatchObject({ statusCode: 409, message: 'Chưa đến ngày chốt sổ của kỳ này' })
    await expect(service.transition(fakePool(moveRoutes({ status: 'SENT' })), 7, 'collect', { paid_date: '2026-10-22' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.transition(fakePool(moveRoutes({ status: 'PAID' })), 7, 'send')).rejects.toMatchObject({ statusCode: 409, message: 'Không thực hiện được: yêu cầu thanh toán đang ở trạng thái Đã thu' })
  })
})
