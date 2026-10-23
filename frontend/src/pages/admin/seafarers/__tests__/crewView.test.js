import { describe, it, expect } from 'vitest'
import { vesselNow, docsAlert, nameInitials, CREW_TABS } from '../crewView'

describe('crewView', () => {
  it('tàu đang sign on: tên tàu và hạn hợp đồng, chỉ khi đang trên tàu', () => {
    expect(vesselNow({ status: 'ON_VESSEL', vessel_name: 'MV Lotus Pearl', contract_end: '2027-01-05' })).toEqual({ vessel: 'MV Lotus Pearl', vesselId: null, until: 'đến 05/01/2027' })
    expect(vesselNow({ status: 'ON_VESSEL', vessel_name: 'MV Lotus Pearl' })).toEqual({ vessel: 'MV Lotus Pearl', vesselId: null, until: null })
    expect(vesselNow({ status: 'ON_VESSEL' })).toBeNull()
    expect(vesselNow({ status: 'AVAILABLE', vessel_name: 'MV Lotus Pearl' })).toBeNull()
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

  it('đủ 4 tab: tất cả và ba trạng thái với tàu', () => {
    expect(CREW_TABS.map((t) => t.label)).toEqual(['Tất cả', 'Đang trên tàu', 'Ở bờ', 'Tạm ngưng'])
  })
})
