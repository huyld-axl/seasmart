import { describe, it, expect } from 'vitest'
import { timelineLayout } from '../crewTimeline'

describe('timelineLayout', () => {
  const base = { from: '2026-06-01', to: '2026-07-31', today: '2026-07-01' }

  it('chia cột theo tháng, tổng đủ 100%', () => {
    const { months } = timelineLayout(base)
    expect(months.map((m) => m.label)).toEqual(['06/26', '07/26'])
    expect(months[0].left).toBe(0)
    expect(months[0].width + months[1].width).toBeCloseTo(100)
    expect(months[1].left).toBeCloseTo((30 / 61) * 100)
  })

  it('vạch hôm nay đúng chỗ, ngoài khoảng thì null', () => {
    expect(timelineLayout(base).todayLeft).toBeCloseTo((30 / 61) * 100)
    expect(timelineLayout({ ...base, today: '2026-08-01' }).todayLeft).toBeNull()
  })

  it('thanh cắt vào khoảng, thanh nằm ngoài bị bỏ, ngày cuối tính trọn ngày', () => {
    const { rows } = timelineLayout({
      ...base,
      rows: [{ id: 1, bars: [
        { kind: 'onboard', start: '2026-05-01', end: '2026-06-30' },
        { kind: 'left', start: '2026-09-01', end: '2026-09-30' },
        { kind: 'moved', start: '2026-07-31', end: '2026-07-31' },
      ] }],
    })
    const [cut, single] = rows[0].bars
    expect(rows[0].bars).toHaveLength(2)
    expect(cut.left).toBe(0)
    expect(cut.width).toBeCloseTo((30 / 61) * 100)
    expect(single.left + single.width).toBeCloseTo(100)
  })

  it('khoảng ngắn có một cột cho mỗi ngày: thứ, số ngày, cuối tuần, hôm nay', () => {
    const out = timelineLayout({ from: '2026-10-22', to: '2026-11-19', today: '2026-11-05', rows: [] })
    expect(out.days).toBe(29)
    expect(out.ticks).toHaveLength(29)
    expect(out.ticks[0]).toMatchObject({ dow: 'T5', label: '22', weekend: false })
    expect(out.ticks.filter((t) => t.major).map((t) => t.label)).toEqual(['26', '2', '9', '16'])
    expect(out.ticks.filter((t) => t.weekend).map((t) => t.label)).toEqual(['24', '25', '31', '1/11', '7', '8', '14', '15'])
    expect(out.ticks.filter((t) => t.monthStart).map((t) => t.label)).toEqual(['1/11'])
    expect(out.ticks.filter((t) => t.today).map((t) => t.dow)).toEqual(['T5'])
  })

  it('khoảng dài không có vạch ngày', () => {
    expect(timelineLayout({ from: '2026-01-01', to: '2026-12-31', today: '2026-11-05', rows: [] }).ticks).toEqual([])
  })
})
