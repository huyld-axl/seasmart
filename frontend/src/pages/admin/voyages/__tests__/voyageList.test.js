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

describe('form Tạo chuyến', () => {
  it('điền sẵn từ đường dẫn, bỏ lý do lạ', async () => {
    const { voyagePrefill } = await import('../voyageList')
    expect(voyagePrefill(new URLSearchParams('seafarer=5&vessel=3&owner=2&reason=TRANSFER'))).toEqual({ seafarer_id: 5, vessel_id: 3, ship_owner_id: 2, manual_reason: 'TRANSFER', ended: false })
    expect(voyagePrefill(new URLSearchParams('reason=XYZ'))).toEqual({ ended: false })
  })

  it('body gửi API: chỉ gửi ngày rời khi đã kết thúc', async () => {
    const dayjs = (await import('dayjs')).default
    const { toVoyagePayload } = await import('../voyageList')
    const base = { seafarer_id: 1, rank_id: 2, vessel_id: 3, ship_owner_id: 4, manual_reason: 'LEGACY', join_date: dayjs('2025-01-10'), join_port_id: 7, planned_leave_date: dayjs('2025-07-10'), notes: '  ' }
    const open = toVoyagePayload(base)
    expect(open).toMatchObject({ join_date: '2025-01-10', planned_leave_date: '2025-07-10', budget_monthly_usd: null, notes: null, ended: false })
    expect(open).not.toHaveProperty('leave_date')
    const ended = toVoyagePayload({ ...base, ended: true, leave_date: dayjs('2025-07-01'), leave_port_id: 8 })
    expect(ended).toMatchObject({ ended: true, leave_date: '2025-07-01', leave_port_id: 8, leave_note: null })
  })

  it('lưu & tạo chuyến khác giữ tàu, ngày, lý do; bỏ người', async () => {
    const { nextVoyageValues } = await import('../voyageList')
    const next = nextVoyageValues({}, { seafarer_id: 1, rank_id: 2, vessel_id: 3, ship_owner_id: 4, manual_reason: 'OWNER_HIRED', join_date: 'd', budget_monthly_usd: 900 })
    expect(next).toEqual({ vessel_id: 3, ship_owner_id: 4, manual_reason: 'OWNER_HIRED', join_date: 'd' })
  })
})

describe('chi tiết chuyến', () => {
  it('lệch ngày theo ngày rồi theo tháng', async () => {
    const { deltaText } = await import('../voyageList')
    expect(deltaText(0)).toBeNull()
    expect(deltaText(13)).toBe('muộn 13 ngày')
    expect(deltaText(-141)).toBe('sớm 4,7 tháng')
  })

  it('còn bao nhiêu tháng', async () => {
    const { monthsLeft } = await import('../voyageList')
    expect(monthsLeft('2027-01-30', '2026-10-27')).toBe('3,2')
    expect(monthsLeft('2026-10-01', '2026-10-27')).toBeNull()
  })

  it('lịch sử ra dòng thời gian', async () => {
    const { historyItems } = await import('../voyageList')
    const items = historyItems([
      { id: 3, action: 'LEAVE_PLAN', payload: { from: '2027-03-05', to: '2027-04-05', note: 'chủ tàu xin thêm' }, created_at: '2026-10-27T01:00:00Z', actor_email: 'a@x' },
      { id: 2, action: 'EDIT_DATES', payload: '{"before":{"join_date":"2026-10-01","join_port_id":1},"after":{"join_date":"2026-10-02","join_port_id":1}}', created_at: '2026-10-26T01:00:00Z' },
      { id: 1, action: 'CREATE', payload: { manual_reason: 'TRANSFER' }, created_at: '2026-10-25T01:00:00Z' },
    ], { formatDate: fmt, portName: (id) => (id === 1 ? 'Hải Phòng' : null) })
    expect(items[0]).toMatchObject({ title: 'Đổi ngày rời dự kiến', before: '05/03/2027', after: '05/04/2027', reason: 'chủ tàu xin thêm', actor: 'a@x' })
    expect(items[1]).toMatchObject({ before: 'lên 01/10/2026 · Hải Phòng', after: 'lên 02/10/2026 · Hải Phòng' })
    expect(items[2].title).toBe('Tạo chuyến · Chuyển tàu')
  })
})

describe('thẻ Đội ngũ', () => {
  it('khoảng xem', async () => {
    const { crewRange } = await import('../voyageList')
    const f = (r) => r.map((d) => d.format('YYYY-MM-DD'))
    expect(f(crewRange('today', '2026-10-27'))).toEqual(['2026-10-27', '2026-10-27'])
    expect(f(crewRange('half', '2026-10-27'))).toEqual(['2026-10-27', '2027-04-27'])
    expect(f(crewRange('year', '2026-10-27'))).toEqual(['2026-01-01', '2026-12-31'])
    expect(crewRange('custom')).toBeNull()
  })

  it('hàng chuyến và cơ hội', async () => {
    const { crewRows } = await import('../voyageList')
    const rows = crewRows({
      today: '2026-10-27',
      formatDate: fmt,
      voyages: [
        { id: 1, seafarer_name: 'A', rank_name: 'Máy hai', code: 'CT-1', status: 'ONBOARD', join_date: '2026-06-05', planned_leave_date: '2027-04-05', original_leave_date: '2027-03-05', join_port_name: 'Hải Phòng', join_delta_days: 13 },
        { id: 2, seafarer_name: 'B', rank_name: 'Thợ máy', code: 'CT-2', status: 'LEFT', join_date: '2026-06-05', planned_leave_date: '2027-02-05', leave_date: '2026-09-14', leave_delta_days: -144 },
      ],
      openings: [{ id: 9, code: 'CH26047', rank_name: 'Thủy thủ', planned_join_date: '2026-11-08', planned_leave_date: '2027-08-08', selected_name: 'K' }],
    })
    expect(rows[0].bars.map((b) => b.kind)).toEqual(['planned', 'onboard', 'moved'])
    expect(rows[0].bars[1]).toMatchObject({ end: '2026-10-27', label: 'Hải Phòng · muộn 13 ngày' })
    expect(rows[0].bars[2]).toMatchObject({ start: '2027-03-05', end: '2027-04-05' })
    expect(rows[1].bars[1]).toMatchObject({ kind: 'left', end: '2026-09-14', label: 'sớm 4,8 tháng' })
    expect(rows[2]).toMatchObject({ id: 'o9', title: 'CH26047' })
    expect(rows[2].bars[0].label).toBe('Dự kiến 08/11/2026 · chủ tàu đã chọn K')
  })
})
