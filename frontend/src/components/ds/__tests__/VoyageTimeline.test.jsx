import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import VoyageTimeline from '../VoyageTimeline'
import { timelineRows, durationText } from '../voyageTimeline'

const items = [
  { id: 1, start: '2026-05-05', end: null, vessel: 'MV A', owner: 'Chủ A', rank: 'Oiler', code: 'CT-1' },
  { id: 2, start: '2025-06-02', end: '2026-02-28', vessel: 'MV B', rank: 'AB', code: 'CT-2' },
]

describe('voyageTimeline', () => {
  it('mới nhất trước, tính ngày ở bờ giữa hai chuyến', () => {
    const rows = timelineRows(items, '2026-11-03')
    expect(rows.map((r) => r.id)).toEqual([1, 2])
    expect(rows[0].ongoing).toBe(true)
    expect(rows[0].ashoreDays).toBeNull()
    expect(rows[1].ashoreDays).toBe(66)
  })
  it('đọc thời gian', () => {
    expect(durationText(20)).toBe('20 ngày')
    expect(durationText(60)).toBe('2 tháng')
    expect(durationText(372)).toBe('12 tháng 12 ngày')
  })
})

describe('VoyageTimeline', () => {
  it('hiện tóm tắt, chuyến đang đi và khoảng ở bờ', () => {
    render(<VoyageTimeline items={items} today="2026-11-03" />)
    expect(screen.getByText('Đang trên tàu')).toBeTruthy()
    expect(screen.getByText(/Ở bờ 2 tháng 6 ngày/)).toBeTruthy()
    expect(screen.getByText('28/02/2026 → 05/05/2026')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('2025')).toBeTruthy()
  })
  it('đã rời tàu thì báo đang ở bờ tới hôm nay', () => {
    render(<VoyageTimeline items={[items[1]]} today="2026-04-10" />)
    expect(screen.getByText(/Đang ở bờ 1 tháng 11 ngày/)).toBeTruthy()
  })
  it('không có chuyến thì hiện trạng thái trống', () => {
    render(<VoyageTimeline items={[]} today="2026-11-03" empty={<p>Trống</p>} />)
    expect(screen.getByText('Trống')).toBeTruthy()
  })
})
