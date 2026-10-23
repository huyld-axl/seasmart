import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { expiryState, attentionItems, activeContract, headLine, toProfileContracts, voyageNow } from '../profileView'

const today = dayjs('2026-10-07')

describe('profileView', () => {
  it('hạn giấy tờ: hết hạn, trong 60 ngày, còn hạn', () => {
    expect(expiryState('2026-10-06', today)).toBe('EXPIRED')
    expect(expiryState('2026-10-07', today)).toBe('EXPIRING')
    expect(expiryState('2026-12-06', today)).toBe('EXPIRING')
    expect(expiryState('2026-12-07', today)).toBe('VALID')
    expect(expiryState(null, today)).toBeNull()
  })

  it('cần chú ý: hết hạn trước, sắp hết hạn sau, chờ duyệt cuối, bỏ chứng chỉ bị thu hồi', () => {
    const items = attentionItems(
      { passport_expiry: '2025-01-01', seaman_book_expiry: '2030-01-01', medical_cert_expiry: '2026-11-01' },
      [
        { certificate_type_name: 'COC', expiry_date: '2026-12-01', status: 'VALID' },
        { certificate_type_name: 'PCCC', expiry_date: '2026-01-01', status: 'REVOKED' },
        { certificate_type_name: 'GMDSS', expiry_date: '2029-01-01', status: 'PENDING' },
      ],
      today,
    )
    expect(items.map((item) => item.text)).toEqual([
      'Hộ chiếu hết hạn 01/01/2025',
      'Giấy khám sức khỏe hết hạn 01/11/2026',
      'COC hết hạn 01/12/2026',
      '1 giấy tờ chờ duyệt',
    ])
  })

  it('hợp đồng đang chạy mới nhất và dòng phụ đầu hồ sơ', () => {
    const contract = activeContract([
      { start_date: '2025-01-01', actual_end_date: '2025-09-01', vessel_name: 'Đã rời tàu' },
      { start_date: '2026-12-01', vessel_name: 'Chưa xuống tàu' },
      { start_date: '2026-01-01', vessel_name: 'MV A' },
      { start_date: '2026-06-05', vessel_name: 'MV Lotus Pearl', end_date: '2027-01-05' },
    ], today)
    expect(contract.vessel_name).toBe('MV Lotus Pearl')
    expect(headLine({ rank_name: 'Phó ba', nationality_name: 'Việt Nam' }, contract)).toBe('Phó ba · MV Lotus Pearl · đến 05/01/2027')
    expect(headLine({ rank_name: 'Phó ba' }, null)).toBe('Phó ba')
  })

  it('toProfileContracts chỉ giữ hợp đồng Hiệu lực và Hết hạn, Hết hạn coi như đã kết thúc', () => {
    const rows = [
      { id: 1, status: 'ACTIVE', vessel_name: 'MV A', start_date: '2026-01-01', end_date: '2026-12-31' },
      { id: 2, status: 'ENDED', vessel_name: 'MV B', start_date: '2025-01-01', end_date: '2025-06-30' },
      { id: 3, status: 'DRAFT', vessel_name: 'MV C', start_date: '2026-01-01', end_date: '2026-12-31' },
      { id: 4, status: 'PENDING' },
      { id: 5, status: 'REJECTED' },
    ]
    const out = toProfileContracts(rows)
    expect(out.map((c) => c.id)).toEqual([1, 2])
    expect(out[1].actual_end_date).toBe('2025-06-30')
    expect(activeContract(out, dayjs('2026-06-01'))?.vessel_name).toBe('MV A')
    expect(activeContract(out.slice(1), dayjs('2026-06-01'))).toBeNull()
  })
})

describe('voyageNow', () => {
  const rows = [
    { id: 1, status: 'ENDED', voyage_status: 'ENDED', start_date: '2026-03-03', end_date: '2026-08-30', vessel_name: 'A' },
    { id: 2, status: 'ACTIVE', voyage_status: 'ONBOARD', start_date: '2026-09-17', end_date: '2027-06-15', vessel_name: 'B' },
    { id: 3, status: 'ACTIVE', voyage_status: 'PLANNING', start_date: '2026-12-01', end_date: '2027-06-01', vessel_name: 'C' },
    { id: 4, status: 'PENDING', voyage_status: 'PLANNING', start_date: '2026-11-01', end_date: '2027-05-01', vessel_name: 'D' },
  ]

  it('đang trên tàu chỉ khi trạng thái ON_VESSEL và chuyến đã bắt đầu', () => {
    expect(voyageNow(rows, 'ON_VESSEL')).toMatchObject({ kind: 'current', row: { id: 2 } })
  })

  it('ở bờ thì ra chuyến sắp tới (hợp đồng Hiệu lực chưa lên tàu, sớm nhất), bỏ hợp đồng chưa hiệu lực', () => {
    expect(voyageNow(rows, 'AVAILABLE')).toMatchObject({ kind: 'next', row: { id: 2 } })
    expect(voyageNow(rows.filter((r) => r.id !== 2), 'AVAILABLE')).toMatchObject({ kind: 'next', row: { id: 3 } })
  })

  it('hết chuyến sắp tới thì ra chuyến gần nhất; chuyến đã kết thúc không tính là đang chạy', () => {
    expect(voyageNow([rows[0]], 'AVAILABLE')).toMatchObject({ kind: 'last', row: { id: 1 } })
    expect(voyageNow([{ ...rows[1], voyage_status: 'ENDED' }], 'AVAILABLE')).toMatchObject({ kind: 'last' })
    expect(voyageNow([], 'AVAILABLE')).toBeNull()
  })
})
