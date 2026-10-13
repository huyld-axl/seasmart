import { describe, it, expect } from 'vitest'
import { isOngoing, sortNewestFirst, findOverlap, toTimelineTrips } from '../seaServiceView'

const trip = (id, on, off, extra = {}) => ({ id, sign_on_date: on, sign_off_date: off, vessel_name_raw: `TÀU ${id}`, rank_raw: 'OLR', rank_name: 'Thợ máy', vessel_match_status: 'NOT_CHECKED', source_type: 'DOCUMENT', ...extra })

describe('chuyến đi tàu', () => {
  it('đang trên tàu khi có ngày xuống mà chưa có ngày rời', () => {
    expect(isOngoing(trip(1, '2020-03-15', null))).toBe(true)
    expect(isOngoing(trip(1, '2020-03-15', '2020-04-01'))).toBe(false)
    expect(isOngoing(trip(1, null, null))).toBe(false)
  })

  it('mới nhất trước, chuyến chưa có ngày xuống ở cuối', () => {
    const out = sortNewestFirst([trip(1, '2019-01-01', '2019-05-01'), trip(2, null, null), trip(3, '2020-01-01', null)])
    expect(out.map((t) => t.id)).toEqual([3, 1, 2])
  })

  it('trùng thời gian khi hai khoảng có phần chung; chạm đầu mút thì không', () => {
    const all = [trip(1, '2019-08-09', '2020-01-21'), trip(2, '2020-03-15', null), trip(3, '2020-01-10', '2020-03-20'), trip(4, '2020-01-21', '2020-02-01')]
    expect(findOverlap(all[0], all)?.id).toBe(3)
    expect(findOverlap(all[1], all)?.id).toBe(3)
    expect(findOverlap(trip(9, '2018-01-01', '2018-02-01'), all)).toBeNull()
    expect(findOverlap(trip(10, null, null), all)).toBeNull()
    // chạm đầu mút: 1 rời 21/01, 4 xuống 21/01: không trùng với nhau
    expect(findOverlap(all[0], [all[0], all[3]])).toBeNull()
  })

  it('đổi sang props của dòng thời gian', () => {
    const out = toTimelineTrips([
      trip(1, '2019-08-09', '2020-01-21', { vessel_type_raw: 'Container', flag_raw: 'Panama', gross_tonnage_raw: '18.230', vessel_match_status: 'NOT_FOUND' }),
      trip(2, '2020-03-15', null, { source_type: 'MANUAL', vessel_match_status: 'MATCHED', vessel_name: 'Pacific Arrow 2' }),
    ])
    expect(out[0]).toMatchObject({ id: 2, vessel: 'Pacific Arrow 2', signOn: '15/03/2020', signOff: null, ongoing: true, vesselStatus: 'VERIFIED', source: { type: 'manual' } })
    expect(out[1]).toMatchObject({ vesselSub: 'Container · Panama · 18.230 GT', vesselStatus: 'NOT_FOUND', signOn: '09/08/2019', source: { type: 'document' } })
    expect(out[1].overlapNote).toBeNull()
  })
})
