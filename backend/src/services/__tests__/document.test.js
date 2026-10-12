import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { documentService, sniffMime, toIsoDate, applyAction, docStatusOf, profileChanges } = require('../document.service')
const pool = require('../../config/db')
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
    // Dùng chung hàm ngày mới: kiểu tên tháng nhận được, năm hai chữ số thì không (phải người duyệt sửa).
    expect(toIsoDate('17th-FEB-2020')).toBe('2020-02-17')
    expect(toIsoDate('JUL.11.2020')).toBe('2020-07-11')
    expect(toIsoDate('27.03.18')).toBeNull()
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

  it('ô không bắt buộc duyệt của chứng chỉ không giữ giấy ở trạng thái chờ duyệt', () => {
    const fields = [
      { field_key: 'typeCode', state: 'ACCEPTED' },
      { field_key: 'valid', state: 'EDITED' },
      { field_key: 'noExpiry', state: 'ACCEPTED' },
      { field_key: 'no', state: 'PROPOSED' },
      { field_key: 'holder', state: 'DATE_AMBIGUOUS' },
    ]
    expect(docStatusOf(fields, 'certificate')).toBe('COMPLETED')
    expect(docStatusOf(fields)).toBe('REVIEW_REQUIRED')
    expect(docStatusOf([...fields.slice(0, 2), { field_key: 'noExpiry', state: 'PROPOSED' }], 'certificate')).toBe('REVIEW_REQUIRED')
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

describe('dòng chứng chỉ và dòng đi tàu từ giấy đã duyệt', () => {
  afterEach(() => vi.restoreAllMocks())

  const doc = { id: 7, seafarer_id: 1, file_name: 'cc.pdf' }
  const accepted = (key, value) => ({ field_key: key, value, state: 'ACCEPTED' })
  // Bảng tra giả: BST có trong danh mục (id 5); hồ sơ đang có sẵn `existing`.
  const mockPool = (existing = []) => vi.spyOn(pool, 'query').mockImplementation(async (sql) => {
    if (sql.includes('FROM certificate_type')) return [[{ id: 5 }]]
    if (sql.includes('FROM seafarer_certificate')) return [existing]
    return [[]]
  })

  it('không cần ngày cấp: chỉ cần loại và hạn', async () => {
    mockPool()
    const row = await documentService.certificateRow(doc, [accepted('typeCode', 'BST'), accepted('valid', '14/03/2028')])
    expect(row).toMatchObject({ certificate_type_id: 5, issued_date: null, expiry_date: '2028-03-14', no_expiry: 0, source_document_id: 7 })
  })

  it('không thời hạn: hạn null, no_expiry bật', async () => {
    mockPool()
    const row = await documentService.certificateRow(doc, [accepted('typeCode', 'BST'), accepted('noExpiry', 'true')])
    expect(row).toMatchObject({ expiry_date: null, no_expiry: 1, status: 'VALID' })
  })

  it('thiếu cả hạn lẫn không thời hạn thì chặn', async () => {
    mockPool()
    await expect(documentService.certificateRow(doc, [accepted('typeCode', 'BST'), accepted('noExpiry', 'false')])).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('không thời hạn') })
  })

  it('không khớp danh mục: lưu tên trên giấy, loại để trống; không có cả hai thì chặn', async () => {
    mockPool()
    const row = await documentService.certificateRow(doc, [accepted('nameRaw', 'Ship Security Awareness'), accepted('valid', '01/01/2030')])
    expect(row).toMatchObject({ certificate_type_id: null, certificate_name_raw: 'Ship Security Awareness' })
    await expect(documentService.certificateRow(doc, [accepted('valid', '01/01/2030')])).rejects.toMatchObject({ statusCode: 400 })
  })

  it('mã loại không có trong danh mục thì chặn', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue([[]])
    await expect(documentService.certificateRow(doc, [accepted('typeCode', 'KHONGCO'), accepted('valid', '01/01/2030')])).rejects.toMatchObject({ statusCode: 400 })
  })

  it('trùng: cùng loại và cùng số, hoặc cùng loại và cùng hạn; khác cả hai thì cho qua', async () => {
    const existing = [{ certificate_type_id: 5, certificate_number: 'A-1', expiry_date: '2028-03-14' }]
    mockPool(existing)
    const fields = (no, valid) => [accepted('typeCode', 'BST'), accepted('no', no), accepted('valid', valid)]
    await expect(documentService.certificateRow(doc, fields('A-1', '01/01/2031'))).rejects.toMatchObject({ statusCode: 409 })
    await expect(documentService.certificateRow(doc, fields('B-2', '14/03/2028'))).rejects.toMatchObject({ statusCode: 409 })
    await expect(documentService.certificateRow(doc, fields('B-2', '01/01/2031'))).resolves.toMatchObject({ certificate_number: 'B-2' })
  })

  it('trùng giữa hai giấy cùng đợt đưa vào hồ sơ', async () => {
    mockPool()
    const first = await documentService.certificateRow(doc, [accepted('typeCode', 'BST'), accepted('no', 'X-9'), accepted('valid', '01/01/2031')])
    await expect(documentService.certificateRow(doc, [accepted('typeCode', 'BST'), accepted('no', 'X-9'), accepted('valid', '02/02/2032')], [first]))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('dòng đi tàu: chữ gốc, chức danh chuẩn hoá bằng code, ngày rời tàu trống thì null', () => {
    const ranks = [{ id: 18, code: 'OLR', name_vi: 'Thợ máy', name_en: 'Oiler' }]
    const fields = [
      accepted('ship', 'ATAYAL STAR'), accepted('rank', 'Oiler'), accepted('onPort', 'Singapore'), accepted('onDate', '04/01/2016'),
      { field_key: 'offDate', value: '', state: 'UNKNOWN_KEPT' }, { field_key: 'coc', value: 'VN-123', state: 'PROPOSED' },
    ]
    const row = documentService.seaServiceRow({ ...doc, id: 9, vessel_id: null, vessel_match_status: null }, fields, ranks, 3)
    expect(row).toMatchObject({
      document_id: 9, vessel_name_raw: 'ATAYAL STAR', rank_raw: 'Oiler', rank_id: 18, sign_on_date: '2016-01-04', sign_off_date: null,
      vessel_match_status: 'NOT_CHECKED', coc_number: null, created_by: 3,
    })
  })

  it('dòng đi tàu thiếu cả tên tàu lẫn chức danh, hoặc ngày sai thì chặn', () => {
    expect(() => documentService.seaServiceRow(doc, [accepted('onDate', '04/01/2016')], [], 1)).toThrow()
    expect(() => documentService.seaServiceRow(doc, [accepted('ship', 'A'), accepted('onDate', '04/01/16')], [], 1)).toThrow()
  })
})
