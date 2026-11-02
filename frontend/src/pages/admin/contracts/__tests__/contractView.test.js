import { describe, it, expect } from 'vitest'
import { balance, balanceNotes, itemRows, payOptions, termLabel, toFormValues, newFormValues, toPayload, periodText, planChangesBills, planRows, planHeadline, planSummary } from '../contractView'

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
    const values = newFormValues({ id: 4, join_date: '2026-11-05', planned_leave_date: '2027-08-05' })
    expect(values.seafarer_voyage_id).toBe(4)
    expect(values.start_date.format('YYYY-MM-DD')).toBe('2026-11-05')
    expect(values.end_date.format('YYYY-MM-DD')).toBe('2027-08-05')
    expect(values.items).toHaveLength(12)
    expect(values.terms.RECEIVABLE.pay_day).toBe(10)
    expect(values.terms.PAYABLE.holiday_rule).toBe('BEFORE')
  })
  it('đi vòng qua form; bỏ dòng tự đặt tên trống; ô tiền trống thành null', () => {
    const detail = {
      contract: { seafarer_voyage_id: 4, start_date: '2026-11-05', end_date: '2027-08-05', notes: null },
      items: [{ kind: 'MONTHLY', item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 }],
      terms: {},
    }
    const values = toFormValues(detail)
    values.items.push({ kind: 'MONTHLY', item_code: null, custom_name: '  ', receivable_usd: 5, payable_usd: null })
    values.items.push({ kind: 'ONE_TIME', item_code: null, custom_name: ' Bảo hiểm ', receivable_usd: '', payable_usd: 7 })
    const payload = toPayload(values, { voyageId: 4 })
    expect(payload).toMatchObject({ seafarer_voyage_id: 4, start_date: '2026-11-05', end_date: '2027-08-05', notes: null })
    expect(payload).not.toHaveProperty('seafarer_id')
    expect(toPayload(values)).not.toHaveProperty('seafarer_voyage_id')
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

describe('bản xem trước bill khi duyệt lại', () => {
  const range = { contract_range: { start: '2026-03-10', end: '2026-10-17' }, bills_range: { start: '2026-03-10', end: '2026-12-31', count: 10 } }
  const cutPlan = {
    mode: 'CUT', ...range, blocked: [], create: [],
    cut: [{ bill_id: 8, seq: 8, status: 'OPEN', from: { start: '2026-10-01', end: '2026-10-31' }, to: { start: '2026-10-01', end: '2026-10-17' } }],
    remove: [
      { bill_id: 9, seq: 9, status: 'OPEN', start: '2026-11-01', end: '2026-11-30', edited: false },
      { bill_id: 10, seq: 10, status: 'OPEN', start: '2026-12-01', end: '2026-12-31', edited: true },
    ],
  }

  it('periodText: cùng năm chỉ ghi năm một lần', () => {
    expect(periodText('2026-10-01', '2026-10-17')).toBe('01/10 – 17/10/2026')
    expect(periodText('2026-12-01', '2027-01-31')).toBe('01/12/2026 – 31/01/2027')
  })

  it('chỉ CUT / EXTEND / REGENERATE mới cần hộp xác nhận', () => {
    expect(planChangesBills({ mode: 'NONE' })).toBe(false)
    expect(planChangesBills({ mode: 'FIRST' })).toBe(false)
    expect(planChangesBills(null)).toBe(false)
    expect(planChangesBills(cutPlan)).toBe(true)
  })

  it('CUT: dòng cắt, dòng xoá mềm (đánh dấu bill sửa tay), tóm tắt và tiêu đề ngày', () => {
    const rows = planRows(cutPlan)
    expect(rows.map((r) => [r.label, r.after])).toEqual([
      ['8', '01/10 – 17/10/2026 · tiền giữ đủ tháng'], ['9', 'Xoá mềm'], ['10', 'Xoá mềm'],
    ])
    expect(rows.filter((r) => r.edited).map((r) => r.label)).toEqual(['10'])
    expect(planHeadline(cutPlan)).toBe('Ngày kết thúc 31/12/2026 → 17/10/2026')
    expect(planSummary(cutPlan)).toBe('Ngày kết thúc: bill đang tới 31/12/2026, hợp đồng đang lưu 17/10/2026. Khi duyệt: kỳ 8 cắt về 17/10, kỳ 9, 10 xoá mềm.')
  })

  it('EXTEND và REGENERATE', () => {
    const extend = { mode: 'EXTEND', cut: [], remove: [], blocked: [], contract_range: { start: '2026-03-10', end: '2027-02-20' }, bills_range: { start: '2026-03-10', end: '2026-12-31', count: 10 },
      create: [{ seq: 11, start: '2027-01-01', end: '2027-01-31' }, { seq: 12, start: '2027-02-01', end: '2027-02-20' }] }
    expect(planRows(extend).map((r) => [r.label, r.current, r.after])).toEqual([
      ['11 mới', '—', '01/01 – 31/01/2027 · đủ tháng'], ['12 mới', '—', '01/02 – 20/02/2027 · đủ tháng'],
    ])
    expect(planSummary(extend)).toContain('thêm 2 kỳ (11, 12)')
    const regen = { mode: 'REGENERATE', cut: [], blocked: [], contract_range: { start: '2026-03-01', end: '2026-12-31' }, bills_range: { start: '2026-03-10', end: '2026-12-31', count: 1 },
      remove: [{ bill_id: 1, seq: 1, status: 'OPEN', start: '2026-03-10', end: '2026-03-31', edited: false }],
      create: [{ seq: 1, start: '2026-03-01', end: '2026-03-31', with_one_time: true }] }
    expect(planRows(regen).map((r) => r.after)).toEqual(['Xoá mềm', '01/03 – 31/03/2026 · gồm khoản một lần'])
    expect(planHeadline(regen)).toBe('Ngày bắt đầu 10/03/2026 → 01/03/2026')
    expect(planSummary(regen)).toBe('Ngày bắt đầu: bill đang từ 10/03/2026, hợp đồng đang lưu 01/03/2026. Khi duyệt: xoá mềm 1 bill và sinh lại 1 kỳ từ 01/03/2026.')
  })

  it('chưa có bill hoặc ngày không đổi thì không có tóm tắt đổi bill', () => {
    expect(planSummary({ mode: 'FIRST', bills_range: null })).toBeNull()
    expect(planSummary({ mode: 'NONE', ...range })).toBe('Ngày không đổi so với bill đang có: duyệt không đổi bill.')
  })
})
