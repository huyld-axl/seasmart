import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { sniffMime, toIsoDate, applyAction, docStatusOf, profileChanges } = require('../document.service')
const { normalizeExtraction } = require('../document_reader.service')

describe('document helpers', () => {
  it('nhận loại tệp theo magic bytes', () => {
    expect(sniffMime(Buffer.from('%PDF-1.4'))).toBe('application/pdf')
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png')
    expect(sniffMime(Buffer.from('GIF89a'))).toBeNull()
  })

  it('đổi ngày dd/mm/yyyy sang ISO, bỏ ngày sai', () => {
    expect(toIsoDate('13/03/1990')).toBe('1990-03-13')
    expect(toIsoDate('04 . 1 . 2016')).toBe('2016-01-04')
    expect(toIsoDate('31/02/2020')).toBeNull()
    expect(toIsoDate('1990')).toBeNull()
  })

  it('hành động trên ô', () => {
    const field = { value: 'A', ai_value: 'A', ai_state: 'PROPOSED' }
    expect(applyAction(field, 'accept')).toEqual({ value: 'A', state: 'ACCEPTED' })
    expect(applyAction({ value: '' }, 'accept')).toEqual({ value: '', state: 'UNKNOWN_KEPT' })
    expect(applyAction(field, 'edit', ' B ')).toEqual({ value: 'B', state: 'EDITED' })
    expect(() => applyAction(field, 'edit', ' ')).toThrow()
    expect(applyAction({ ...field, state: 'EDITED', value: 'B' }, 'undo')).toEqual({ value: 'A', state: 'PROPOSED' })
  })

  it('giấy xong khi không còn ô cần xem', () => {
    expect(docStatusOf([{ state: 'ACCEPTED' }, { state: 'DATE_AMBIGUOUS' }])).toBe('REVIEW_REQUIRED')
    expect(docStatusOf([{ state: 'ACCEPTED' }, { state: 'REJECTED' }])).toBe('COMPLETED')
  })

  it('chỉ ô đã chấp nhận/sửa và có chỗ trong hồ sơ mới vào hồ sơ', () => {
    const fields = [
      { field_key: 'no', value: 'VN1', state: 'ACCEPTED' },
      { field_key: 'dob', value: '13/03/1990', state: 'EDITED' },
      { field_key: 'id', value: '0001', state: 'REJECTED' },
      { field_key: 'name', value: 'Trần Minh Khôi', state: 'ACCEPTED' },
    ]
    expect(profileChanges('seaman_book_info', fields)).toEqual({ seaman_book_number: 'VN1', date_of_birth: '1990-03-13' })
    expect(() => profileChanges('seaman_book_info', [{ field_key: 'dob', value: 'abc', state: 'EDITED' }])).toThrow()
  })

  it('lọc kết quả AI theo khuôn', () => {
    const out = normalizeExtraction({
      doc_type: 'vaccination',
      page_label: '1 trang',
      fields: [
        { key: 'name', raw: 'TRAN MINH KHOI', value: 'Trần Minh Khôi', state: 'PROPOSED', note: '' },
        { key: 'hack', raw: 'x', value: 'x', state: 'PROPOSED', note: '' },
        { key: 'disease', raw: '', value: 'Sốt vàng', state: 'UNKNOWN', note: 'trống' },
      ],
    })
    expect(out.fields.map((f) => f.key)).toEqual(['name', 'disease', 'vaccine', 'from', 'to'])
    expect(out.fields[1]).toMatchObject({ value: '', state: 'UNKNOWN' })
    expect(out.fields[2]).toMatchObject({ state: 'UNKNOWN', note: null })
    expect(normalizeExtraction({ doc_type: 'other', fields: [] }).doc_type).toBeNull()
  })
})
