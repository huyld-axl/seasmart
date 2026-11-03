import { describe, it, expect } from 'vitest'
import { voyageTrips } from '../seaServiceView'

describe('chuyến tàu trên tab Đi tàu', () => {
  it('đổi chuyến sang props của dòng thời gian, đang trên tàu khi chưa có ngày rời', () => {
    const out = voyageTrips([{ id: 6, code: 'CT-2026-0006', vessel_name: 'MV Ocean Glory', ship_owner_name: 'Lotus', rank_name: 'Đại phó', join_date: '2026-09-17' }])
    expect(out[0]).toMatchObject({ id: 'v6', vessel: 'MV Ocean Glory', signOn: '17/09/2026', signOff: null, ongoing: true, source: { label: 'CT-2026-0006' } })
  })

  it('mới nhất trước theo ngày lên tàu', () => {
    const out = voyageTrips([
      { id: 1, code: 'A', vessel_name: 'A', join_date: '2025-01-01', leave_date: '2025-06-01' },
      { id: 2, code: 'B', vessel_name: 'B', join_date: '2027-01-01' },
      { id: 3, code: 'C', vessel_name: 'C', join_date: '2026-01-01', leave_date: '2026-05-01' },
    ])
    expect(out.map((t) => t.id)).toEqual(['v2', 'v3', 'v1'])
    expect(out[2]).toMatchObject({ signOff: '01/06/2025', ongoing: false })
  })
})
