import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { splitAmounts, planAmounts, headcountShare, groupByOwner, mergeSpans, termText, validMonth } = require('../report_math')
const { REPORTS, REPORT_KEYS } = require('../../constants/reports')

const row = (owner, seafarer, bill, payout) => ({
  ship_owner: { id: owner, company_name: `Đối tác ${owner}` },
  seafarer: { id: seafarer },
  bill: { amounts: bill },
  payout: { amounts: payout },
})

describe('report_math', () => {
  it('tách khoản hằng tháng / một lần', () => {
    expect(splitAmounts({ BASIC_WAGE: 1500, SERVICE_FEE: 150, OTHER_MONTHLY: 100, FLIGHT_OUT: 500 })).toEqual({ monthly: 1750, one_time: 500, total: 2250 })
    expect(splitAmounts({})).toEqual({ monthly: 0, one_time: 0, total: 0 })
  })

  it('khoản dự kiến theo hợp đồng: hằng tháng mọi kỳ, một lần chỉ kỳ 1', () => {
    const items = [{ item_code: 'BASIC_WAGE', receivable_usd: '1500', payable_usd: '1300' }, { item_code: 'FLIGHT_OUT', receivable_usd: '500', payable_usd: null }]
    expect(planAmounts(items, 'receivable_usd', 1)).toMatchObject({ BASIC_WAGE: 1500, FLIGHT_OUT: 500, VISA_FEE: 0 })
    expect(planAmounts(items, 'receivable_usd', 2)).toMatchObject({ BASIC_WAGE: 1500, FLIGHT_OUT: 0 })
    expect(planAmounts(items, 'payable_usd', 1)).toMatchObject({ BASIC_WAGE: 1300, FLIGHT_OUT: 0 })
    expect(Object.keys(planAmounts([], 'payable_usd', 1))).toHaveLength(14)
  })

  it('tỷ lệ số người tổng đúng 100, phần dư vào dòng đông nhất', () => {
    expect(headcountShare([3, 2, 1])).toEqual([50, 33.33, 16.67])
    expect(headcountShare([1, 1, 1])).toEqual([33.34, 33.33, 33.33])
    expect(headcountShare([5, 5, 5, 1])).toEqual([31.25, 31.25, 31.25, 6.25])
    expect(headcountShare([])).toEqual([])
    expect(headcountShare([0])).toEqual([0])
  })

  it('gộp theo đối tác: cộng tiền, đếm người khác nhau, sắp theo Tổng giảm dần', () => {
    const rows = [
      row(1, 10, { BASIC_WAGE: 1000 }, { BASIC_WAGE: 800 }),
      row(2, 20, { BASIC_WAGE: 3000, FLIGHT_OUT: 400 }, { BASIC_WAGE: 2500, FLIGHT_OUT: 400 }),
      row(1, 10, { BASIC_WAGE: 1000 }, { BASIC_WAGE: 800 }),
      row(1, 11, { BASIC_WAGE: 500 }, {}),
    ]
    const thu = groupByOwner(rows, 'bill')
    expect(thu.map((g) => g.ship_owner.id)).toEqual([2, 1])
    expect(thu[0]).toMatchObject({ monthly: 3000, one_time: 400, total: 3400, headcount: 1, share: 33.33 })
    expect(thu[1]).toMatchObject({ monthly: 2500, one_time: 0, total: 2500, headcount: 2, share: 66.67 })
    const tra = groupByOwner(rows, 'payout')
    expect(tra.map((g) => g.total)).toEqual([2900, 1600])
  })

  it('gộp ô theo nhóm liền nhau', () => {
    expect(mergeSpans(['a', 'a', 'b', 'c', 'c', 'c'], (x) => x)).toEqual([2, 0, 1, 3, 0, 0])
    expect(mergeSpans([], (x) => x)).toEqual([])
  })

  it('chữ kỳ thanh toán như form hợp đồng', () => {
    expect(termText({ closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' })).toEqual({ closing: 'Cuối tháng', pay: 'Ngày 10 tháng sau', holiday: 'Làm sau' })
    expect(termText({ closing_day: 25, pay_day: 31, pay_month_offset: 1, holiday_rule: 'BEFORE' })).toEqual({ closing: 'Ngày 25', pay: 'Cuối tháng sau', holiday: 'Làm trước' })
    expect(termText({ closing_day: 15, pay_day: 5, pay_month_offset: 2, holiday_rule: 'BEFORE' }).pay).toBe('Ngày 5 sau 2 tháng')
    expect(termText({ closing_day: 15, pay_day: 31, pay_month_offset: 3, holiday_rule: 'BEFORE' }).pay).toBe('Cuối tháng, sau 3 tháng')
    expect(termText(null)).toEqual({ closing: '—', pay: '—', holiday: '—' })
  })

  it('tháng hợp lệ', () => {
    expect(validMonth('2026-10')).toBe(true)
    expect(validMonth('2026-13')).toBe(false)
    expect(validMonth('2026-1')).toBe(false)
    expect(validMonth(undefined)).toBe(false)
  })
})

describe('danh sách cột báo cáo', () => {
  it('4 báo cáo, cột theo mẫu', () => {
    expect(REPORT_KEYS).toEqual(['base', 'sales', 'cost', 'cashflow'])
    expect(REPORTS.sales.columns.map((c) => c.label)).toEqual(['STT', 'Tháng', 'Đối tác', 'Khoản hằng tháng', 'Khoản một lần', 'Tổng', 'Số thuyền viên', 'Tỷ lệ số người'])
    expect(REPORTS.cost.columns[2].label).toBe('Đối tác')
    expect(REPORTS.cashflow.columns).toHaveLength(12)
    expect(REPORTS.cashflow.columns.some((c) => /trạng thái/i.test(c.label))).toBe(false)
  })

  it('Dữ liệu tổng hợp: 30 cột khi ẩn 14 khoản, 86 khi hiện; khoá cột không trùng', () => {
    const cols = REPORTS.base.columns
    expect(REPORTS.base.title).toBe('Dữ liệu tổng hợp')
    expect(cols.filter((c) => !c.detail)).toHaveLength(30)
    expect(cols).toHaveLength(86)
    expect(new Set(cols.map((c) => c.key)).size).toBe(86)
    expect([...new Set(cols.map((c) => c.group))]).toEqual(['Thông tin hợp đồng', 'Yêu cầu thanh toán', 'Trả lương', undefined, 'Điều kiện phải thu', 'Điều kiện phải chi'])
    expect(cols.filter((c) => !c.group).map((c) => c.label)).toEqual(['Lãi thực tế', 'Lãi gộp dự kiến'])
    expect(cols.filter((c) => c.sticky).map((c) => c.key)).toEqual(['month', 'contract_number'])
  })
})
