import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { payoutDefaults, fullAmounts, sumAmounts, monthRange } = require('../payout_math')

const contractItems = [
  { item_code: 'BASIC_WAGE', payable_usd: '1300' },
  { item_code: 'SERVICE_FEE', payable_usd: null },
  { item_code: 'OTHER_MONTHLY', payable_usd: '80' },
  { item_code: 'FLIGHT_OUT', payable_usd: '500' },
]

describe('payout_math', () => {
  it('mặc định kỳ 1: đủ 14 khoản, cột Phải chi, khoản một lần có số, trống là 0', () => {
    const d = payoutDefaults({ contractItems, seq: 1 })
    expect(Object.keys(d)).toHaveLength(14)
    expect(d).toMatchObject({ BASIC_WAGE: 1300, SERVICE_FEE: 0, OTHER_MONTHLY: 80, FLIGHT_OUT: 500, FLIGHT_BACK: 0 })
    expect(sumAmounts(d)).toBe(1880)
  })
  it('kỳ sau: khoản một lần là 0', () => {
    const d = payoutDefaults({ contractItems, seq: 2 })
    expect(d.FLIGHT_OUT).toBe(0)
    expect(sumAmounts(d)).toBe(1380)
  })
  it('hợp đồng chưa có phải chi: toàn 0', () => {
    expect(sumAmounts(payoutDefaults({ contractItems: [], seq: 1 }))).toBe(0)
  })
  it('fullAmounts đủ mã, thiếu là 0', () => {
    const a = fullAmounts([{ item_code: 'BONUS', amount_usd: '12.5' }])
    expect(Object.keys(a)).toHaveLength(14)
    expect(a.BONUS).toBe(12.5)
    expect(a.BASIC_WAGE).toBe(0)
  })
  it('khoảng ngày của tháng', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' })
  })
})
