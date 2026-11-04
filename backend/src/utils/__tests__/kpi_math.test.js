import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { daysInMonth, lastMonths, monthOverlapDays, contractRevenue, revenueByMonth, pace, contractLabel, revenueLabel } = require('../kpi_math')

const monthly = (receivable, payable) => ({ kind: 'MONTHLY', receivable_usd: receivable, payable_usd: payable })
const once = (receivable, payable) => ({ kind: 'ONE_TIME', receivable_usd: receivable, payable_usd: payable })

describe('tháng', () => {
  it('số ngày của tháng, kể cả tháng 2 năm nhuận', () => {
    expect(daysInMonth('2026-11')).toBe(30)
    expect(daysInMonth('2026-12')).toBe(31)
    expect(daysInMonth('2027-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })
  it('6 tháng gần nhất, qua năm', () => {
    expect(lastMonths('2026-11', 6)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(lastMonths('2027-02', 3)).toEqual(['2026-12', '2027-01', '2027-02'])
  })
  it('tháng sai thì lỗi', () => {
    expect(() => daysInMonth('2026-13')).toThrow()
    expect(() => lastMonths('2026/11', 2)).toThrow()
  })
})

describe('monthOverlapDays', () => {
  it('nằm trọn, cắt đầu, cắt cuối, dài hơn tháng, ngoài tháng', () => {
    expect(monthOverlapDays('2026-11-05', '2026-11-10', '2026-11')).toBe(6)
    expect(monthOverlapDays('2026-11-16', '2027-05-15', '2026-11')).toBe(15)
    expect(monthOverlapDays('2026-10-01', '2026-11-10', '2026-11')).toBe(10)
    expect(monthOverlapDays('2026-01-01', '2027-12-31', '2026-11')).toBe(30)
    expect(monthOverlapDays('2026-12-01', '2027-01-31', '2026-11')).toBe(0)
  })
  it('upTo chỉ đếm tới hết ngày đó', () => {
    expect(monthOverlapDays('2026-10-01', '2027-05-01', '2026-11', '2026-11-04')).toBe(4)
    expect(monthOverlapDays('2026-11-10', '2027-05-01', '2026-11', '2026-11-04')).toBe(0)
  })
})

describe('contractRevenue', () => {
  it('ví dụ của plan: 1.000 USD/tháng bắt đầu 16/11 → 500 cho tháng 11', () => {
    expect(contractRevenue({ start_date: '2026-11-16', end_date: '2027-05-15', items: [monthly(1000, 0)] }, '2026-11')).toBe(500)
  })
  it('trừ phải chi, trọn tháng 31 ngày', () => {
    expect(contractRevenue({ start_date: '2026-11-01', end_date: '2027-05-01', items: [monthly(1500, 1200)] }, '2026-12')).toBe(300)
  })
  it('khoản một lần vào tháng bắt đầu, không vào tháng sau', () => {
    const c = { start_date: '2026-11-20', end_date: '2027-05-19', items: [monthly(900, 0), once(200, 50)] }
    expect(contractRevenue(c, '2026-11')).toBe(480) // 900 × 11/30 + 150
    expect(contractRevenue(c, '2026-12')).toBe(900)
  })
  it('tháng 2 chia 28 ngày', () => {
    expect(contractRevenue({ start_date: '2027-02-15', end_date: '2027-06-01', items: [monthly(2800, 0)] }, '2027-02')).toBe(1400)
  })
  it('kết thúc sớm chỉ tính tới ngày kết thúc', () => {
    expect(contractRevenue({ start_date: '2026-06-01', end_date: '2026-11-10', items: [monthly(3000, 0)] }, '2026-11')).toBe(1000)
  })
  it('upTo: đã ghi nhận tới hôm nay; khoản một lần chưa tính nếu chưa tới ngày bắt đầu', () => {
    const c = { start_date: '2026-11-10', end_date: '2027-05-09', items: [monthly(3000, 0), once(100, 0)] }
    expect(contractRevenue(c, '2026-11', '2026-11-04')).toBe(0)
    expect(contractRevenue(c, '2026-11', '2026-11-12')).toBe(400)
  })
  it('không có dòng tiền thì 0', () => {
    expect(contractRevenue({ start_date: '2026-11-01', end_date: '2026-11-30' }, '2026-11')).toBe(0)
  })
})

describe('revenueByMonth', () => {
  it('cộng nhiều hợp đồng theo từng tháng, tháng không có thì 0', () => {
    const list = [
      { start_date: '2026-10-17', end_date: '2027-04-16', items: [monthly(3100, 0)] },
      { start_date: '2026-11-01', end_date: '2026-11-30', items: [monthly(600, 300)] },
    ]
    expect(revenueByMonth(list, ['2026-09', '2026-10', '2026-11'])).toEqual({ '2026-09': 0, '2026-10': 1500, '2026-11': 3400 })
  })
})

describe('tiến độ và nhãn', () => {
  it('tiến độ ngày 1, giữa tháng, ngày cuối; chưa đặt mục tiêu', () => {
    expect(pace(10, 4, 30)).toBe(1.33)
    expect(pace(3, 1, 30)).toBe(0.1)
    expect(pace(3, 30, 30)).toBe(3)
    expect(pace(null, 4, 30)).toBeNull()
  })
  it('nhãn hợp đồng', () => {
    expect(contractLabel(1, 3, pace(3, 4, 30))).toBe('ON_TRACK')
    expect(contractLabel(1, 3, pace(3, 20, 30))).toBe('BEHIND')
    expect(contractLabel(0, 2, pace(2, 1, 30))).toBe('BEHIND')
    expect(contractLabel(3, 3, 3)).toBe('DONE')
    expect(contractLabel(1, null, null)).toBeNull()
  })
  it('nhãn doanh thu', () => {
    expect(revenueLabel(26900, 28000)).toEqual({ kind: 'SHORT', short: 1100 })
    expect(revenueLabel(28000, 28000)).toEqual({ kind: 'DONE' })
    expect(revenueLabel(26900, null)).toBeNull()
  })
})
