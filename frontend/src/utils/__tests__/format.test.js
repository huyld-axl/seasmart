import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatUsd, formatDiff } from '../format'

describe('format', () => {
  it('ngày DD/MM/YYYY, rỗng thì chuỗi rỗng', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026')
    expect(formatDate(null)).toBe('')
  })
  it('ngày giờ', () => {
    expect(formatDateTime('2026-10-18T14:20:00')).toBe('18/10/2026 14:20')
    expect(formatDateTime('')).toBe('')
  })
  it('tiền kiểu Việt Nam', () => {
    expect(formatUsd(1150, { fixed: true })).toBe('1.150,00')
    expect(formatUsd(16800)).toBe('16.800')
    expect(formatUsd(333.333)).toBe('333,33')
    expect(formatUsd(null)).toBe('')
  })
  it('chênh lệch có dấu', () => {
    expect(formatDiff(1700)).toBe('+1.700')
    expect(formatDiff(-200)).toBe('-200')
    expect(formatDiff(0)).toBe('0')
    expect(formatDiff(null)).toBe('—')
  })
})
