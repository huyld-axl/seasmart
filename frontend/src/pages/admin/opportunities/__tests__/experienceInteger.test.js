import { expect, it } from 'vitest'
import { experienceIntegerError } from '../opportunityView'

it('phân biệt thông báo số tháng và số chuyến, nhận số nguyên', () => {
  expect(experienceIntegerError({ kind: 'EXPERIENCE', _by: 'rank', min_months: 1.5 })).toBe('Số tháng phải là số nguyên')
  expect(experienceIntegerError({ kind: 'EXPERIENCE', _by: 'type', min_trips: 1.5 })).toBe('Số chuyến phải là số nguyên')
  expect(experienceIntegerError({ kind: 'EXPERIENCE', rank_id: 1, min_months: 12 })).toBeNull()
  expect(experienceIntegerError({ kind: 'EXPERIENCE', vessel_type_id: 1, min_trips: 2 })).toBeNull()
})
