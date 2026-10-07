import { describe, it, expect } from 'vitest'
import { availabilityText, docsAlert, nameInitials, CREW_TABS } from '../crewView'

describe('crewView', () => {
  it('đang trên tàu: tên tàu và ngày rời tàu', () => {
    expect(availabilityText({ status: 'ON_VESSEL', vessel_name: 'MV Lotus Pearl', contract_end: '2027-01-05' })).toBe('MV Lotus Pearl · đến 05/01/2027')
    expect(availabilityText({ status: 'ON_VESSEL', vessel_name: 'MV Lotus Pearl' })).toBe('MV Lotus Pearl')
    expect(availabilityText({ status: 'ON_VESSEL' })).toBe('Đang trên tàu')
  })

  it('chờ tàu, nghỉ phép, trạng thái khác', () => {
    expect(availabilityText({ status: 'AVAILABLE' })).toBe('Sẵn sàng')
    expect(availabilityText({ status: 'ON_LEAVE' })).toBe('Đang nghỉ phép')
    expect(availabilityText({ status: 'RETIRED' })).toBe('—')
  })

  it('giấy tờ hết hạn đứng trước sắp hết hạn', () => {
    expect(docsAlert({ expired_count: 2, expiring_count: 1 })).toEqual({ tone: 'error', text: '2 giấy tờ hết hạn' })
    expect(docsAlert({ expired_count: 0, expiring_count: 1 })).toEqual({ tone: 'warning', text: '1 sắp hết hạn' })
    expect(docsAlert({ expired_count: 0, expiring_count: 0 }).text).toBe('Còn hạn')
  })

  it('chữ avatar lấy hai chữ cuối của tên', () => {
    expect(nameInitials('Trần Minh Khôi')).toBe('MK')
    expect(nameInitials('Lê Văn Đức')).toBe('VĐ')
    expect(nameInitials('Sơn')).toBe('S')
    expect(nameInitials('')).toBe('?')
  })

  it('đủ 5 tab theo UI Kit', () => {
    expect(CREW_TABS.map((t) => t.label)).toEqual(['Tất cả', 'Đang trên tàu', 'Chờ tàu', 'Chờ duyệt', 'Sắp hết hạn'])
  })
})
