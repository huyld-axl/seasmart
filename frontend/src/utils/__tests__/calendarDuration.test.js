import { describe, expect, it } from 'vitest'
import { formatCalendarDuration } from '../format'

describe('calendar duration display', () => {
  it.each([
    ['2026-07-03', '2027-02-28', '7 tháng 25 ngày'],
    ['2026-07-03', '2027-03-03', '8 tháng'],
    ['2026-07-03', '2026-07-20', '17 ngày'],
    ['2026-07-03', '2026-07-03', '0 ngày'],
    ['2027-01-31', '2027-02-28', '1 tháng'],
    ['2028-01-31', '2028-02-29', '1 tháng'],
    ['2026-12-20', '2027-01-25', '1 tháng 5 ngày'],
  ])('%s to %s is %s', (start, end, label) => {
    expect(formatCalendarDuration(start, end)).toBe(label)
  })
  it('returns empty for missing, invalid or reversed dates', () => {
    expect(formatCalendarDuration(undefined, '2027-02-28')).toBe('')
    expect(formatCalendarDuration('invalid', '2027-02-28')).toBe('')
    expect(formatCalendarDuration('2027-02-28', '2026-07-03')).toBe('')
  })
})
