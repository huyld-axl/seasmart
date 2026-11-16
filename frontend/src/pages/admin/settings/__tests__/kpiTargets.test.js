import { describe, it, expect } from 'vitest'
import { cellErrors, changedCells, changedRows, prevMonth, totals } from '../kpiTargets'

const original = [
  { user_id: 1, contracts: 3, revenue_usd: 7500, done: 1, revenue: 7100 },
  { user_id: 2, contracts: null, revenue_usd: null, done: 0, revenue: 0 },
]

describe('mục tiêu tháng', () => {
  it('ô đổi; null và chưa nhập coi như nhau', () => {
    const draft = [{ ...original[0], contracts: 4 }, { ...original[1], revenue_usd: undefined }]
    expect(changedCells(original, draft)).toEqual(['1:contracts'])
  })
  it('chỉ gửi dòng có ô đổi, ô trống gửi null (bỏ mục tiêu)', () => {
    const draft = [{ ...original[0], revenue_usd: null }, original[1]]
    expect(changedRows(original, draft)).toEqual([{ user_id: 1, contracts: 3, revenue_usd: null }])
  })
  it('lỗi: số âm, số lẻ ở hợp đồng, USD 3 số lẻ', () => {
    const e = cellErrors([{ user_id: 1, contracts: -1, revenue_usd: 10.005 }, { user_id: 2, contracts: 1.5, revenue_usd: 10.05 }])
    expect(e).toEqual({ '1:contracts': 'Số hợp đồng phải là số nguyên từ 1 đến 1.000', '1:revenue_usd': 'Tối đa 2 số lẻ', '2:contracts': 'Số hợp đồng phải là số nguyên từ 1 đến 1.000' })
  })
  it.each([0, -1])('chặn cả hai mục tiêu bằng %s', (value) => {
    expect(Object.keys(cellErrors([{ user_id: 1, contracts: value, revenue_usd: value }]))).toEqual(['1:contracts', '1:revenue_usd'])
  })
  it('chấp nhận giới hạn hợp lệ nhỏ nhất và ô chưa đặt', () => {
    expect(cellErrors([{ user_id: 1, contracts: 1, revenue_usd: 1 }, { user_id: 2, contracts: null, revenue_usd: null }])).toEqual({})
  })
  it('tổng công ty: chưa ai đặt thì null', () => {
    expect(totals(original)).toEqual({ contracts: 3, revenue_usd: 7500, done: 1, revenue: 7100 })
    expect(totals([original[1]]).contracts).toBeNull()
  })
  it('tháng trước, qua năm', () => {
    expect(prevMonth('2026-11')).toBe('2026-10')
    expect(prevMonth('2027-01')).toBe('2026-12')
  })
})
