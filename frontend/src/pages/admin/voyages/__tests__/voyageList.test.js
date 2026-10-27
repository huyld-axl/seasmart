import { describe, expect, it } from 'vitest'
import { joinDeltaLabel, leaveCell, leaveFlagLabel, leaveHint, sourceText } from '../voyageList'

const fmt = (d) => d.split('-').reverse().join('/')

describe('voyageList', () => {
  it('nhãn lệch ngày lên', () => {
    expect(joinDeltaLabel(null)).toBeNull()
    expect(joinDeltaLabel(0)).toBeNull()
    expect(joinDeltaLabel(3)).toBe('muộn 3 ngày')
    expect(joinDeltaLabel(-2)).toBe('sớm 2 ngày')
  })

  it('nhãn rời tàu', () => {
    expect(leaveFlagLabel(null)).toBeNull()
    expect(leaveFlagLabel({ kind: 'LATE', days: 4 })).toEqual({ tone: 'error', text: 'Quá 4 ngày chưa rời' })
    expect(leaveFlagLabel({ kind: 'SOON', days: 0 }).text).toBe('Rời hôm nay')
    expect(leaveFlagLabel({ kind: 'SOON', days: 12 }).text).toBe('Còn 12 ngày')
  })

  it('ô rời tàu theo trạng thái', () => {
    expect(leaveCell({ status: 'LEFT', leave_date: '2026-09-01', leave_port_name: 'Hải Phòng' }, fmt)).toEqual({ date: '2026-09-01', sub: 'Hải Phòng' })
    expect(leaveCell({ status: 'ONBOARD', planned_leave_date: '2027-01-01', original_leave_date: '2027-01-01' }, fmt).sub).toBe('dự kiến')
    expect(leaveCell({ status: 'ONBOARD', planned_leave_date: '2027-02-01', original_leave_date: '2027-01-01' }, fmt).sub).toBe('đã dời từ 01/01/2027')
  })

  it('nguồn', () => {
    expect(sourceText({ source: 'OPPORTUNITY', opportunity_code: 'CH26004' })).toBe('CH26004')
    expect(sourceText({ source: 'MANUAL', manual_reason: 'TRANSFER' })).toBe('Tạo tay · Chuyển tàu')
    expect(sourceText({ source: 'MANUAL' })).toBe('Tạo tay')
  })

  it('gợi ý sớm / muộn khi ghi rời', () => {
    expect(leaveHint('2027-01-01', '2027-01-01')).toBe('Đúng ngày rời dự kiến')
    expect(leaveHint('2026-12-25', '2027-01-01')).toBe('Sớm 7 ngày so với dự kiến')
    expect(leaveHint('2027-01-03', '2027-01-01')).toBe('Muộn 2 ngày so với dự kiến')
  })
})
