import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { monthsBetween, splitBudget, contractBalance, dueFlag, displayStatus, splitPeriods, dueDate, billDisplayStatus, planBillChanges } = require('../voyage_math')

describe('monthsBetween', () => {
  it('đúng các ví dụ của kế hoạch', () => {
    expect(monthsBetween('2026-11-05', '2027-08-05')).toBe(9)
    expect(monthsBetween('2027-01-01', '2027-01-16')).toBe(0.5)
    expect(monthsBetween('2027-01-31', '2027-02-28')).toBe(1)
  })
  it('cùng ngày là 0; tháng lẻ tính theo 30 ngày', () => {
    expect(monthsBetween('2027-01-01', '2027-01-01')).toBe(0)
    expect(monthsBetween('2026-11-05', '2027-01-20')).toBe(2.5)
  })
  it('ngày kết thúc trước ngày bắt đầu thì lỗi', () => {
    expect(() => monthsBetween('2027-02-01', '2027-01-01')).toThrow()
  })
})

describe('splitBudget', () => {
  it('có tổng chuyến thì tính mỗi tháng và ngược lại', () => {
    expect(splitBudget({ total: 17100, months: 9 })).toEqual({ total: 17100, monthly: 1900 })
    expect(splitBudget({ monthly: 1900, months: 9 })).toEqual({ total: 17100, monthly: 1900 })
    expect(splitBudget({ total: 1000, months: 3 }).monthly).toBe(333.33)
  })
})

describe('dueFlag', () => {
  const f = (plannedEmbark, status = 'PLANNING') => dueFlag({ status, plannedEmbark, today: '2026-10-19' })
  it('các mốc cảnh báo', () => {
    expect(f('2026-10-23')).toBeNull()
    expect(f('2026-10-22')).toEqual({ kind: 'SOON', days: 3 })
    expect(f('2026-10-19')).toEqual({ kind: 'SOON', days: 0 })
    expect(f('2026-10-18')).toEqual({ kind: 'LATE', days: 1 })
    expect(f('2026-10-18', 'ONBOARD')).toBeNull()
  })
})

describe('displayStatus', () => {
  it('tính từ trạng thái lưu và số vị trí có hợp đồng', () => {
    expect(displayStatus({ status: 'PLANNING', positionsTotal: 0, positionsFilled: 0 })).toBe('RECRUITING')
    expect(displayStatus({ status: 'PLANNING', positionsTotal: 3, positionsFilled: 2 })).toBe('RECRUITING')
    expect(displayStatus({ status: 'PLANNING', positionsTotal: 3, positionsFilled: 3 })).toBe('FULL')
    expect(displayStatus({ status: 'ONBOARD', positionsTotal: 3, positionsFilled: 1 })).toBe('ONBOARD')
    expect(displayStatus({ status: 'ENDED', positionsTotal: 3, positionsFilled: 3 })).toBe('ENDED')
  })
})

describe('contractBalance', () => {
  const item = (kind, receivable_usd, payable_usd) => ({ kind, receivable_usd, payable_usd })
  it('ví dụ wireframe: thu 1.900, chi 1.650, chênh 250, 9 tháng = 2.250', () => {
    const items = [
      item('MONTHLY', 1150, 1050), item('MONTHLY', 345, 315), item('MONTHLY', 230, 210),
      item('MONTHLY', 75, 75), item('MONTHLY', 100, null), item('ONE_TIME', 500, 300),
    ]
    const b = contractBalance({ items, budgetMonthly: 1900, contractMonths: 9 })
    expect(b).toMatchObject({ receivableMonthly: 1900, payableMonthly: 1650, diffMonthly: 250, diffContract: 2250, receivableOnce: 500, payableOnce: 300, diffOnce: 200 })
    expect(b.receivableOk && b.payableOk && b.diffOk).toBe(true)
  })
  it('vượt budget thì không đạt', () => {
    const b = contractBalance({ items: [item('MONTHLY', 2020, 100)], budgetMonthly: 1900, contractMonths: 1 })
    expect(b.receivableOk).toBe(false)
    expect(b.payableOk).toBe(true)
    expect(b.diffOk).toBe(false)
  })
  it('phải chi lớn hơn phải thu thì chênh lệch âm, không đạt', () => {
    const b = contractBalance({ items: [item('MONTHLY', 1000, 1200)], budgetMonthly: 1900, contractMonths: 2 })
    expect(b.diffMonthly).toBe(-200)
    expect(b.diffOk).toBe(false)
  })
})

describe('splitPeriods', () => {
  const ranges = (start, end, closingDay) => splitPeriods({ start, end, closingDay }).map((p) => `${p.start}..${p.end}`)
  it('chia theo ngày chốt sổ, kỳ đầu và kỳ cuối có thể lẻ', () => {
    expect(ranges('2026-03-12', '2026-06-11', 25)).toEqual(['2026-03-12..2026-03-25', '2026-03-26..2026-04-25', '2026-04-26..2026-05-25', '2026-05-26..2026-06-11'])
    expect(ranges('2026-03-26', '2026-06-25', 25)).toHaveLength(3)
    expect(ranges('2026-03-25', '2026-04-30', 25)).toEqual(['2026-03-25..2026-03-25', '2026-03-26..2026-04-25', '2026-04-26..2026-04-30'])
    expect(ranges('2026-04-01', '2026-04-30', 31)).toEqual(['2026-04-01..2026-04-30'])
    expect(ranges('2026-04-05', '2026-04-20', 31)).toEqual(['2026-04-05..2026-04-20'])
    expect(ranges('2027-02-01', '2027-03-10', 31)).toEqual(['2027-02-01..2027-02-28', '2027-03-01..2027-03-10'])
  })
})

describe('dueDate', () => {
  it('ngày trả của tháng sau, dời qua cuối tuần, không xét ngày lễ', () => {
    expect(dueDate({ periodEnd: '2026-03-25', payDay: 10, payMonthOffset: 1, holidayRule: 'AFTER' })).toBe('2026-04-10')
    expect(dueDate({ periodEnd: '2026-04-25', payDay: 10, payMonthOffset: 1, holidayRule: 'AFTER' })).toBe('2026-05-11')
    expect(dueDate({ periodEnd: '2027-01-31', payDay: 31, payMonthOffset: 1, holidayRule: 'AFTER' })).toBe('2027-03-01')
    expect(dueDate({ periodEnd: '2027-01-31', payDay: 31, payMonthOffset: 1, holidayRule: 'BEFORE' })).toBe('2027-02-26')
    expect(dueDate({ periodEnd: '2026-03-30', payDay: 30, payMonthOffset: 1, holidayRule: 'AFTER' })).toBe('2026-04-30')
    expect(dueDate({ periodEnd: '2026-03-30', payDay: 1, payMonthOffset: 2, holidayRule: 'BEFORE' })).toBe('2026-05-01')
  })
})

describe('billDisplayStatus', () => {
  it('tính từ trạng thái lưu và hôm nay', () => {
    const base = { periodEnd: '2026-10-31', dueDate: '2026-11-10' }
    expect(billDisplayStatus({ ...base, status: 'OPEN', today: '2026-10-21' })).toBe('UPCOMING')
    expect(billDisplayStatus({ ...base, status: 'OPEN', today: '2026-10-31' })).toBe('TO_APPROVE')
    expect(billDisplayStatus({ ...base, status: 'APPROVED', today: '2026-10-31' })).toBe('TO_SEND')
    expect(billDisplayStatus({ ...base, status: 'APPROVED', today: '2026-11-20' })).toBe('TO_SEND')
    expect(billDisplayStatus({ ...base, status: 'SENT', today: '2026-11-10' })).toBe('SENT')
    expect(billDisplayStatus({ ...base, status: 'SENT', today: '2026-11-11' })).toBe('OVERDUE')
    expect(billDisplayStatus({ ...base, status: 'PAID', today: '2026-12-01' })).toBe('PAID')
  })
})

describe('planBillChanges', () => {
  const term = { closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' }
  const mk = (seq, start, end, status = 'OPEN', edited = false) => ({ id: seq * 10, code: `TT-${seq}`, seq, period_start: start, period_end: end, status, edited })
  // HĐ-C: 10/03 → 31/12, chốt cuối tháng: 10 kỳ, kỳ 1 lẻ 10/03–31/03.
  const bills = [
    mk(1, '2026-03-10', '2026-03-31', 'PAID'), mk(2, '2026-04-01', '2026-04-30', 'PAID'), mk(3, '2026-05-01', '2026-05-31', 'PAID'),
    mk(4, '2026-06-01', '2026-06-30', 'PAID'), mk(5, '2026-07-01', '2026-07-31', 'PAID'), mk(6, '2026-08-01', '2026-08-31', 'PAID'),
    mk(7, '2026-09-01', '2026-09-30', 'PAID'), mk(8, '2026-10-01', '2026-10-31'), mk(9, '2026-11-01', '2026-11-30'), mk(10, '2026-12-01', '2026-12-31'),
  ]
  const plan = (start, end, list = bills) => planBillChanges({ start, end, bills: list, term })

  it('chưa có bill: FIRST, sinh đủ kỳ, bill đầu có khoản một lần', () => {
    const r = plan('2026-03-10', '2026-05-20', [])
    expect(r.mode).toBe('FIRST')
    expect(r.create.map((c) => [c.seq, c.start, c.end, c.with_one_time])).toEqual([
      [1, '2026-03-10', '2026-03-31', true], [2, '2026-04-01', '2026-04-30', false], [3, '2026-05-01', '2026-05-20', false],
    ])
    expect(r.blocked).toEqual([])
  })

  it('không đổi ngày: NONE', () => {
    expect(plan('2026-03-10', '2026-12-31')).toEqual({ mode: 'NONE', cut: [], remove: [], create: [], blocked: [] })
  })

  it('E rơi giữa kỳ: cắt kỳ đó, xoá các kỳ sau, tính lại hạn', () => {
    const r = plan('2026-03-10', '2026-10-17')
    expect(r.mode).toBe('CUT')
    expect(r.cut).toHaveLength(1)
    expect(r.cut[0]).toMatchObject({ code: 'TT-8', from: { start: '2026-10-01', end: '2026-10-31' }, to: { start: '2026-10-01', end: '2026-10-17' }, due_date: '2026-11-10' })
    expect(r.remove.map((b) => b.code)).toEqual(['TT-9', 'TT-10'])
    expect(r.blocked).toEqual([])
  })

  it('E đúng ngày chốt: không cắt, chỉ xoá kỳ sau', () => {
    const r = plan('2026-03-10', '2026-09-30')
    expect(r.mode).toBe('CUT')
    expect(r.cut).toEqual([])
    expect(r.remove.map((b) => b.code)).toEqual(['TT-8', 'TT-9', 'TT-10'])
    expect(r.blocked).toEqual([])
  })

  it('bill Đã duyệt bị chặn như đã gửi; kỳ không bị đụng thì không', () => {
    const approved = bills.map((b) => (b.seq === 9 ? { ...b, status: 'APPROVED' } : b))
    expect(plan('2026-03-10', '2026-10-15', approved).blocked.map((b) => [b.seq, b.status])).toEqual([[9, 'APPROVED']])
    expect(plan('2026-03-10', '2026-11-20', approved).blocked.map((b) => [b.seq, b.status])).toEqual([[9, 'APPROVED']])
    expect(plan('2026-04-01', '2026-12-31', approved).blocked.map((b) => b.seq)).toContain(9)
    expect(plan('2026-03-10', '2027-02-28', approved).blocked).toEqual([])
  })

  it('E sớm làm đụng bill đã thu: blocked đúng tập', () => {
    const r = plan('2026-03-10', '2026-09-15')
    expect(r.cut.map((b) => b.code)).toEqual(['TT-7'])
    expect(r.blocked).toEqual([expect.objectContaining({ code: 'TT-7', status: 'PAID' })])
  })

  it('E muộn hơn: EXTEND từ kỳ lẻ, số kỳ nối tiếp, không có khoản một lần, không chặn', () => {
    const r = plan('2026-03-10', '2027-02-20')
    expect(r.mode).toBe('EXTEND')
    expect(r.create.map((c) => [c.seq, c.start, c.end, c.with_one_time])).toEqual([
      [11, '2027-01-01', '2027-01-31', false], [12, '2027-02-01', '2027-02-20', false],
    ])
    expect(r.blocked).toEqual([])
  })

  it('EXTEND khi kỳ cuối đang lẻ: bắt đầu ngày sau E cũ', () => {
    const odd = [mk(1, '2026-03-10', '2026-03-31'), mk(2, '2026-04-01', '2026-04-12')]
    const r = plan('2026-03-10', '2026-05-31', odd)
    expect(r.create.map((c) => [c.seq, c.start, c.end])).toEqual([[3, '2026-04-13', '2026-04-30'], [4, '2026-05-01', '2026-05-31']])
  })

  it('S đổi qua nhiều kỳ: REGENERATE, xoá hết, sinh lại từ 1, chặn mọi bill chưa OPEN', () => {
    const r = plan('2026-06-15', '2026-12-31')
    expect(r.mode).toBe('REGENERATE')
    expect(r.remove).toHaveLength(10)
    expect(r.create[0]).toMatchObject({ seq: 1, start: '2026-06-15', end: '2026-06-30', with_one_time: true })
    expect(r.create.at(-1)).toMatchObject({ end: '2026-12-31' })
    expect(r.blocked.map((b) => b.code)).toEqual(['TT-1', 'TT-2', 'TT-3', 'TT-4', 'TT-5', 'TT-6', 'TT-7'])
  })

  it('S đổi khi mọi bill còn OPEN: không bị chặn, bill sửa tay được đánh dấu', () => {
    const open = [mk(1, '2026-03-10', '2026-03-31', 'OPEN', true), mk(2, '2026-04-01', '2026-04-30')]
    const r = plan('2026-03-01', '2026-04-30', open)
    expect(r.mode).toBe('REGENERATE')
    expect(r.blocked).toEqual([])
    expect(r.remove[0].edited).toBe(true)
    expect(r.create[0]).toMatchObject({ start: '2026-03-01', end: '2026-03-31' })
  })

  it('ngày chốt 31 và tháng 2: E cuối tháng 2 không cắt', () => {
    const feb = [mk(1, '2027-01-01', '2027-01-31'), mk(2, '2027-02-01', '2027-02-28'), mk(3, '2027-03-01', '2027-03-31')]
    const r = plan('2027-01-01', '2027-02-28', feb)
    expect(r.cut).toEqual([])
    expect(r.remove.map((b) => b.code)).toEqual(['TT-3'])
  })

  it('ngày chốt 15: cắt kỳ giữa và hạn theo quy tắc', () => {
    const t15 = { closing_day: 15, pay_day: 20, pay_month_offset: 1, holiday_rule: 'BEFORE' }
    const list = [mk(1, '2026-03-10', '2026-03-15'), mk(2, '2026-03-16', '2026-04-15')]
    const r = planBillChanges({ start: '2026-03-10', end: '2026-04-01', bills: list, term: t15 })
    expect(r.cut[0]).toMatchObject({ code: 'TT-2', to: { start: '2026-03-16', end: '2026-04-01' } })
    expect(r.cut[0].due_date).toBe(dueDate({ periodEnd: '2026-04-01', payDay: 20, payMonthOffset: 1, holidayRule: 'BEFORE' }))
  })
})
