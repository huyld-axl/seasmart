import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { expiryState, attentionItems, activeContract, headLine } from '../profileView'

const today = dayjs('2026-10-07')

describe('profileView', () => {
  it('hạn giấy tờ: hết hạn, trong 90 ngày, còn hạn', () => {
    expect(expiryState('2026-10-06', today)).toBe('EXPIRED')
    expect(expiryState('2026-10-07', today)).toBe('EXPIRING')
    expect(expiryState('2027-01-05', today)).toBe('EXPIRING')
    expect(expiryState('2027-01-06', today)).toBe('VALID')
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
    expect(headLine({ rank_name: 'Phó ba', nationality_name: 'Việt Nam' }, contract)).toBe('Phó ba · Việt Nam · MV Lotus Pearl · đến 05/01/2027')
    expect(headLine({ rank_name: 'Phó ba' }, null)).toBe('Phó ba')
  })
})
