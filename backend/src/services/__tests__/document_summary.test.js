import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { documentService, summarizeUpload, categoryOf } = require('../document.service')
const certificateService = require('../certificate.service')
const pool = require('../../config/db')

describe('tóm tắt tệp cho màn Tải giấy tờ lên', () => {
  const now = new Date('2026-10-13T10:00:00').getTime()
  const minutesAgo = (n) => new Date(now - n * 60000)

  it('xếp loại giấy theo cách người dùng nói', () => {
    expect(categoryOf('seaman_book_info')).toBe('book')
    expect(categoryOf('seaman_book_duty')).toBe('book')
    expect(categoryOf('certificate')).toBe('certificate')
    expect(categoryOf('other')).toBe('other')
    expect(categoryOf('passport')).toBe('other')
    expect(categoryOf(null)).toBe('unsorted')
  })

  it('tệp đang đọc: running, đếm giấy theo loại và theo trạng thái', () => {
    const groups = [
      { doc_type: 'certificate', status: 'COMPLETED', n: 2 },
      { doc_type: 'certificate', status: 'READING', n: 1 },
      { doc_type: 'seaman_book_duty', status: 'REVIEW_REQUIRED', n: 3 },
      { doc_type: 'other', status: 'SKIPPED', n: 1 },
    ]
    const out = summarizeUpload({ status: 'READING', updated_at: minutesAgo(1) }, groups, now)
    expect(out).toMatchObject({ total: 7, book: 3, certificate: 3, other: 1, reading: 1, to_review: 3, failed: 0, phase: 'running', stalled: false })
  })

  it('tệp xong: done; quá 5 phút vẫn bận thì stalled', () => {
    expect(summarizeUpload({ status: 'DONE', updated_at: minutesAgo(30) }, [], now)).toMatchObject({ phase: 'done', stalled: false, total: 0 })
    expect(summarizeUpload({ status: 'READING', updated_at: minutesAgo(6) }, [], now)).toMatchObject({ phase: 'running', stalled: true })
    expect(summarizeUpload({ status: 'FAILED', updated_at: minutesAgo(6) }, [], now)).toMatchObject({ phase: 'failed', stalled: false })
  })
})

describe('duyệt nhanh một giấy', () => {
  afterEach(() => vi.restoreAllMocks())

  it('chấp nhận ô đọc rõ nhưng để lại số GCNKNCM cho người duyệt chạm', async () => {
    const calls = []
    vi.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('FROM seafarer_document d')) return [[{ id: 9, doc_type: 'seaman_book_duty', status: 'REVIEW_REQUIRED', seafarer_id: 1 }]]
      if (sql.includes('FROM document_field')) return [[{ id: 1, document_id: 9, field_key: 'coc', value: '004217', state: 'PROPOSED' }]]
      return [[]]
    })
    await documentService.acceptClear(9, 1).catch(() => {})
    const update = calls.find((call) => call.sql.startsWith('UPDATE document_field SET state'))
    expect(update.sql).toContain('field_key NOT IN (?)')
    expect(update.params[4]).toEqual(['coc'])
  })

  it('giấy không có ô cần chạm thì không có điều kiện loại trừ', async () => {
    const calls = []
    vi.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('FROM seafarer_document d')) return [[{ id: 9, doc_type: 'seaman_book_info', status: 'REVIEW_REQUIRED', seafarer_id: 1 }]]
      if (sql.includes('FROM document_field')) return [[{ id: 1, document_id: 9, field_key: 'no', value: 'B 0418725', state: 'PROPOSED' }]]
      return [[]]
    })
    await documentService.acceptClear(9, 1).catch(() => {})
    const update = calls.find((call) => call.sql.startsWith('UPDATE document_field SET state'))
    expect(update.sql).not.toContain('NOT IN')
  })
})

describe('tab Chứng chỉ', () => {
  afterEach(() => vi.restoreAllMocks())

  it('trạng thái hạn tính từ ngày hết hạn', () => {
    const now = new Date('2026-10-13T09:00:00')
    const { expiryStatusOf } = certificateService
    expect(expiryStatusOf({ no_expiry: 1, expiry_date: null }, now)).toBe('NO_EXPIRY')
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: '2026-10-12' }, now)).toBe('EXPIRED')
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: '2026-10-13' }, now)).toBe('EXPIRING')
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: '2027-01-11' }, now)).toBe('EXPIRING')
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: '2027-01-12' }, now)).toBe('VALID')
    // Driver MySQL trả Date: không được rơi về VALID khi đã hết hạn.
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: new Date(2025, 6, 1) }, now)).toBe('EXPIRED')
    expect(expiryStatusOf({ no_expiry: 0, expiry_date: new Date(2028, 4, 14) }, now)).toBe('VALID')
  })

  it('danh sách có tên hiện ra, nguồn và trạng thái hạn', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*)')) return [[{ total: 2 }]]
      return [[
        { id: 1, certificate_type_name: 'Basic Safety Training', certificate_name_raw: null, source_document_id: 5, source_file_name: 'IMG_2041.jpg', source_page: '1 ảnh', expiry_date: '2030-01-01', no_expiry: 0 },
        { id: 2, certificate_type_name: null, certificate_name_raw: 'Huấn luyện nâng cao', source_document_id: null, expiry_date: null, no_expiry: 1 },
      ]]
    })
    const out = await certificateService.list(1)
    expect(out.data[0]).toMatchObject({ display_name: 'Basic Safety Training', source: 'document', expiry_status: 'VALID', source_file_name: 'IMG_2041.jpg' })
    expect(out.data[1]).toMatchObject({ display_name: 'Huấn luyện nâng cao', source: 'manual', expiry_status: 'NO_EXPIRY' })
    expect(out.total).toBe(2)
  })

  it('thêm tay trùng loại và ngày cấp thì báo 409, không lỗi 500', async () => {
    vi.spyOn(pool, 'query').mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))
    await expect(certificateService.create(1, { certificate_type_id: 3 }, 1)).rejects.toMatchObject({ statusCode: 409 })
  })
})
