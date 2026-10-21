import { describe, expect, it } from 'vitest'
import { matchCountry, mergeScans, sectionSummaries, summaryText } from '../scanView'

const COUNTRIES = [
  { id: 1, code: 'VN', name_vi: 'Việt Nam', name_en: 'Vietnam' },
  { id: 2, code: 'PH', name_vi: 'Philippines', name_en: 'Philippines' },
]

describe('mergeScans', () => {
  it('CCCD thắng hộ chiếu ở ô trùng', () => {
    const out = mergeScans([
      { fields: [{ field: 'full_name', value: 'NGUYEN', source: 'passport' }] },
      { fields: [{ field: 'full_name', value: 'Nguyễn', source: 'national_id' }, { field: 'gender', value: 'M', source: 'national_id' }] },
    ])
    expect(out.find((x) => x.field === 'full_name').value).toBe('Nguyễn')
    expect(out).toHaveLength(2)
  })
})

describe('matchCountry', () => {
  it('khớp tên, mã và dạng tính từ', () => {
    expect(matchCountry('VIỆT NAM', COUNTRIES)).toBe(1)
    expect(matchCountry('VIETNAMESE', COUNTRIES)).toBe(1)
    expect(matchCountry('PHL', COUNTRIES)).toBe(null)
    expect(matchCountry('Philippines', COUNTRIES)).toBe(2)
    expect(matchCountry('', COUNTRIES)).toBe(null)
  })
})

describe('sectionSummaries', () => {
  const sections = [
    { key: 'general', title: 'Thông tin chung', fields: ['full_name', 'date_of_birth'] },
    { key: 'identity', title: 'Giấy tờ tùy thân', fields: ['passport_number'] },
  ]
  const marks = {
    full_name: { state: 'ok', source: 'national_id' },
    date_of_birth: { state: 'check', source: 'national_id' },
    passport_number: { state: 'ok', source: 'passport' },
  }
  it('đếm từng khối và nêu khối khác', () => {
    const rows = sectionSummaries(marks, sections)
    expect(rows[0]).toMatchObject({ key: 'general', filled: 2, check: 1, sources: ['CCCD'] })
    expect(summaryText(rows[0])).toBe('Đã điền 2 ô từ CCCD, 1 ô cần kiểm tra. Khối khác cũng được điền: Giấy tờ tùy thân (1 ô).')
    expect(summaryText(rows[1])).toContain('1 ô từ hộ chiếu')
  })
  it('không có đánh dấu thì không có dòng nào', () => {
    expect(sectionSummaries({}, sections)).toEqual([])
  })
})
