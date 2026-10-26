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
    { id: 1, code: 'CT-2026-0001', status: 'LEFT', join_date: '2025-01-01', leave_date: '2025-06-01', planned_leave_date: '2025-07-01', vessel_id: 3, vessel_name: 'MV A' },
    { id: 2, code: 'CT-2026-0002', status: 'LEFT', join_date: '2025-08-01', leave_date: '2026-02-01', planned_leave_date: '2026-02-01', vessel_id: 3, vessel_name: 'MV A' },
    { id: 3, code: 'CT-2026-0003', status: 'ONBOARD', join_date: '2026-06-05', leave_date: null, planned_leave_date: '2027-03-05', vessel_id: 4, vessel_name: 'MV B' },
  ]
  it('đang trên tàu thì lấy chuyến ONBOARD, hạn là ngày rời dự kiến', () => {
    expect(voyageNow(rows)).toMatchObject({ kind: 'current', row: { voyage_id: 3, voyage_code: 'CT-2026-0003', vessel_name: 'MV B', end_date: '2027-03-05' } })
  })
  it('đã rời hết thì lấy chuyến rời gần nhất; không có chuyến thì null', () => {
    expect(voyageNow(rows.slice(0, 2))).toMatchObject({ kind: 'last', row: { voyage_id: 2, end_date: '2026-02-01' } })
    expect(voyageNow([])).toBeNull()
  })
})
