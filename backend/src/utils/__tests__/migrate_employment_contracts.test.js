import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { plan } = require('../../../scripts/migrate_employment_contracts')

const TODAY = '2026-10-19'
const base = { start_date: '2026-01-01', end_date: '2027-01-01', actual_end_date: null, sign_on_port_id: 1, sign_off_port_id: 2 }

describe('migrate_employment_contracts.plan', () => {
  it('đã bắt đầu, chưa kết thúc thì ONBOARD', () => {
    expect(plan(base, TODAY)).toMatchObject({ voyageStatus: 'ONBOARD', start: '2026-01-01', end: '2027-01-01', actualDisembark: null })
  })
  it('có ngày kết thúc thực tế hoặc đã quá ngày kết thúc thì ENDED', () => {
    expect(plan({ ...base, actual_end_date: '2026-06-30' }, TODAY)).toMatchObject({ voyageStatus: 'ENDED', actualDisembark: '2026-06-30' })
    expect(plan({ ...base, end_date: '2026-07-01' }, TODAY)).toMatchObject({ voyageStatus: 'ENDED', actualDisembark: '2026-07-01' })
  })
  it('chưa tới ngày bắt đầu thì PLANNING, không cần cảng', () => {
    expect(plan({ ...base, start_date: '2026-12-01', sign_on_port_id: null, sign_off_port_id: null }, TODAY)).toMatchObject({ voyageStatus: 'PLANNING' })
  })
  it('thiếu ngày kết thúc thì lấy ngày bắt đầu + số tháng; thiếu cả hai thì bỏ qua', () => {
    expect(plan({ ...base, end_date: null, duration_months: 9 }, TODAY)).toMatchObject({ end: '2026-10-01' })
    expect(plan({ ...base, end_date: null }, TODAY).skip).toBeTruthy()
    expect(plan({ ...base, start_date: null }, TODAY).skip).toBeTruthy()
  })
  it('thiếu cảng mà chuyến đã bắt đầu / kết thúc thì bỏ qua', () => {
    expect(plan({ ...base, sign_on_port_id: null }, TODAY).skip).toMatch(/xuống tàu/)
    expect(plan({ ...base, actual_end_date: '2026-06-30', sign_off_port_id: null }, TODAY).skip).toMatch(/rời tàu/)
  })
})
