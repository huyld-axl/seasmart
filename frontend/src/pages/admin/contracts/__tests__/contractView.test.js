import { describe, it, expect } from 'vitest'
import { balance, balanceNotes, itemRows, payOptions, termLabel, toFormValues, newFormValues, toPayload } from '../contractView'

const item = (kind, receivable_usd, payable_usd) => ({ kind, receivable_usd, payable_usd })

describe('balance', () => {
  it('ví dụ wireframe: thu 1.900, chi 1.650, chênh 250, 9 tháng = 2.250', () => {
    const items = [item('MONTHLY', 1150, 1050), item('MONTHLY', 345, 315), item('MONTHLY', 230, 210), item('MONTHLY', 75, 75), item('MONTHLY', 100, null), item('ONE_TIME', 500, 300)]
    const b = balance({ items, budgetMonthly: 1900, contractMonths: 9 })
    expect(b).toMatchObject({ receivableMonthly: 1900, payableMonthly: 1650, diffMonthly: 250, diffContract: 2250, diffOnce: 200 })
    expect(b.receivableOk && b.payableOk && b.diffOk).toBe(true)
  })
  it('vượt budget, hoặc phải chi lớn hơn phải thu thì không đạt', () => {
    expect(balance({ items: [item('MONTHLY', 2020, 100)], budgetMonthly: 1900, contractMonths: 1 })).toMatchObject({ receivableOk: false, payableOk: true, diffOk: false })
    expect(balance({ items: [item('MONTHLY', 1000, 1200)], budgetMonthly: 1900, contractMonths: 2 })).toMatchObject({ diffMonthly: -200, diffOk: false })
  })
  it('ô trống tính là 0', () => {
    expect(balance({ items: [item('MONTHLY', '', null)], budgetMonthly: 100, contractMonths: 1 }).receivableMonthly).toBe(0)
  })
})

describe('payOptions', () => {
  it('3 nhóm, tổng 21 lựa chọn, nhãn đúng mục 1.7', () => {
    const groups = payOptions()
    expect(groups.map((g) => g.label)).toEqual(['Tháng sau', 'Sau 2 tháng', 'Sau 3 tháng'])
    expect(groups.flatMap((g) => g.options)).toHaveLength(21)
    const label = (value) => groups.flatMap((g) => g.options).find((o) => o.value === value).label
    expect(label('10:1')).toBe('Ngày 10 tháng sau')
    expect(label('31:1')).toBe('Cuối tháng sau')
    expect(label('5:2')).toBe('Ngày 5 sau 2 tháng')
    expect(label('31:3')).toBe('Cuối tháng, sau 3 tháng')
  })
})

describe('termLabel', () => {
  it('ra ba dòng chữ của kỳ thanh toán', () => {
    expect(termLabel({ closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' })).toEqual({ closing: 'Cuối tháng', pay: 'Ngày 10 tháng sau', holiday: 'Làm sau' })
    expect(termLabel(null).pay).toBe('—')
  })
})

describe('itemRows', () => {
  it('luôn đủ 12 khoản mặc định theo nhóm, thêm dòng tự đặt tên ở cuối nhóm', () => {
    const rows = itemRows([
      { kind: 'MONTHLY', item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 },
      { kind: 'ONE_TIME', custom_name: 'Bảo hiểm', receivable_usd: 20, payable_usd: null },
    ])
    expect(rows.MONTHLY).toHaveLength(6)
    expect(rows.ONE_TIME).toHaveLength(7)
    expect(rows.MONTHLY[0]).toMatchObject({ name: 'Lương cơ bản', receivable_usd: 1150 })
    expect(rows.MONTHLY[1].receivable_usd).toBeNull()
    expect(rows.ONE_TIME[6]).toMatchObject({ custom_name: 'Bảo hiểm', item_code: null })
    expect(itemRows().MONTHLY).toHaveLength(6)
  })
})

describe('form <-> payload', () => {
  it('khởi tạo từ chuyến: ngày mặc định theo chuyến, kỳ thanh toán mặc định', () => {
    const values = newFormValues({ planned_embark_date: '2026-11-05', planned_disembark_date: '2027-08-05' })
    expect(values.start_date.format('YYYY-MM-DD')).toBe('2026-11-05')
    expect(values.items).toHaveLength(12)
    expect(values.terms.RECEIVABLE.pay_day).toBe(10)
    expect(values.terms.PAYABLE.holiday_rule).toBe('BEFORE')
  })
  it('đi vòng qua form; bỏ dòng tự đặt tên trống; ô tiền trống thành null', () => {
    const detail = {
      contract: { seafarer_id: 2, start_date: '2026-11-05', end_date: '2027-08-05', notes: null },
      items: [{ kind: 'MONTHLY', item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 }],
      terms: {},
    }
    const values = toFormValues(detail)
    values.items.push({ kind: 'MONTHLY', item_code: null, custom_name: '  ', receivable_usd: 5, payable_usd: null })
    values.items.push({ kind: 'ONE_TIME', item_code: null, custom_name: ' Bảo hiểm ', receivable_usd: '', payable_usd: 7 })
    const payload = toPayload(values, { positionId: 4 })
    expect(payload).toMatchObject({ voyage_position_id: 4, seafarer_id: 2, start_date: '2026-11-05', end_date: '2027-08-05', notes: null })
    expect(payload.items).toHaveLength(13)
    expect(payload.items[0]).toEqual({ kind: 'MONTHLY', item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 })
    expect(payload.items[12]).toEqual({ kind: 'ONE_TIME', custom_name: 'Bảo hiểm', receivable_usd: null, payable_usd: 7 })
  })
})

describe('balanceNotes', () => {
  it('ghi chú cho ba số cân đối', () => {
    const ok = balance({ items: [item('MONTHLY', 1900, 1650)], budgetMonthly: 1900, contractMonths: 9 })
    expect(balanceNotes(ok)).toEqual({ receivable: 'Bằng budget', payable: '87% budget', diff: '13% budget' })
    const over = balance({ items: [item('MONTHLY', 2020, 100)], budgetMonthly: 1900, contractMonths: 1 })
    expect(balanceNotes(over)).toEqual({ receivable: 'Vượt budget 120', payable: '5% budget', diff: 'Vượt budget 20' })
    const loss = balance({ items: [item('MONTHLY', 1000, 1200)], budgetMonthly: 1900, contractMonths: 1 })
    expect(balanceNotes(loss).diff).toBe('Phải chi lớn hơn phải thu 200')
  })
})
