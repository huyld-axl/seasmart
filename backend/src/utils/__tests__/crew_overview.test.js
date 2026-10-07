import { describe, it, expect } from 'vitest'
import { completeness, shapeRow, TABS, TAB_CONDITIONS } from '../crew_overview'

const full = {
  national_id: '001', date_of_birth: '1990-03-13', nationality_id: 1, phone_primary: '0900',
  current_rank_id: 2, passport_number: 'C1', seaman_book_number: 'S1', medical_cert_number: 'M1',
}

describe('crew_overview', () => {
  it('hồ sơ đủ 8 trường là 100%, thiếu hết là 0%', () => {
    expect(completeness(full)).toBe(100)
    expect(completeness({})).toBe(0)
  })

  it('chuỗi rỗng tính là thiếu', () => {
    expect(completeness({ ...full, passport_number: '', medical_cert_number: null })).toBe(75)
  })

  it('shapeRow bỏ cột phụ, đổi số đếm sang số', () => {
    const row = shapeRow({ id: 1, full_name: 'A', ...full, expired_count: '2', expiring_count: null, pending_review_count: '1' })
    expect(row).toMatchObject({ id: 1, expired_count: 2, expiring_count: 0, pending_review_count: 1, completeness: 100 })
    expect(row).not.toHaveProperty('passport_number')
    expect(row).not.toHaveProperty('current_rank_id')
    expect(row.national_id).toBe('001')
  })

  it('có điều kiện cho đủ 4 tab, không nhận giá trị lạ', () => {
    expect(TABS).toEqual(['onboard', 'standby', 'review', 'expiring'])
    expect(TAB_CONDITIONS['1 OR 1=1']).toBeUndefined()
  })
})
