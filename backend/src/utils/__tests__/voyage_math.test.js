import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { monthsBetween, splitBudget, contractBalance, dueFlag, displayStatus, splitPeriods, dueDate, billDisplayStatus } = require('../voyage_math')

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
    expect(billDisplayStatus({ ...base, status: 'OPEN', today: '2026-10-31' })).toBe('TO_SEND')
    expect(billDisplayStatus({ ...base, status: 'SENT', today: '2026-11-10' })).toBe('SENT')
    expect(billDisplayStatus({ ...base, status: 'SENT', today: '2026-11-11' })).toBe('OVERDUE')
    expect(billDisplayStatus({ ...base, status: 'PAID', today: '2026-12-01' })).toBe('PAID')
  })
})
