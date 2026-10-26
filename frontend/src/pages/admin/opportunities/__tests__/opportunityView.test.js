import { describe, it, expect } from 'vitest'
import { candidateSummary, deadlineLabel } from '../opportunityView'

const fmt = (d) => d.slice(8, 10) + '/' + d.slice(5, 7)

describe('deadlineLabel', () => {
  it('quá hạn đỏ, sắp tới vàng, hôm nay', () => {
    expect(deadlineLabel({ kind: 'LATE', days: 11 })).toEqual({ tone: 'error', text: 'quá 11 ngày' })
    expect(deadlineLabel({ kind: 'SOON', days: 4 })).toEqual({ tone: 'warning', text: 'còn 4 ngày' })
    expect(deadlineLabel({ kind: 'SOON', days: 0 }).text).toBe('hôm nay')
    expect(deadlineLabel(null)).toBeNull()
  })
})

describe('candidateSummary', () => {
  it('ưu tiên người được chốt, rồi người chủ tàu đã chọn, rồi số ứng viên', () => {
    expect(candidateSummary({ placed_name: 'A', voyage_code: 'CT-2026-0141' }, fmt)).toEqual({ main: 'A', sub: 'chuyến CT-2026-0141' })
    expect(candidateSummary({ selected_name: 'B', selected_at: '2026-10-20', candidates_count: 4 }, fmt).sub).toBe('chủ tàu đã chọn 20/10 · 4 ứng viên')
    expect(candidateSummary({ candidates_count: 4, sent_count: 2, last_sent_at: '2026-10-14' }, fmt)).toEqual({ main: '4 ứng viên', sub: '2 đã gửi 14/10' })
    expect(candidateSummary({ candidates_count: 0 }, fmt)).toMatchObject({ main: 'Chưa có', muted: true })
  })
})
