import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ai = require('../ai')
const reader = require('../document_reader.service')
const { DOC_TYPES } = require('../../constants/document_types')

const CERT_TYPES = [{ code: 'BST', name_vi: 'An toàn cơ bản' }, { code: 'GMDSS', name_vi: 'GMDSS' }]
const TODAY = new Date(Date.UTC(2026, 9, 12))
const field = (key, value, extra = {}) => ({ key, raw: value, value, state: value ? 'PROPOSED' : 'UNKNOWN', note: '', ...extra })

describe('khuôn giấy', () => {
  it('trang bố trí chức danh có 12 ô, cảng và ngày tách riêng', () => {
    const keys = DOC_TYPES.seaman_book_duty.fields.map((f) => f.key)
    expect(keys).toEqual(['ship', 'type', 'flag', 'gt', 'kw', 'owner', 'rank', 'coc', 'onPort', 'onDate', 'offPort', 'offDate'])
    expect(DOC_TYPES.seaman_book_duty.fields.filter((f) => f.date).map((f) => f.key)).toEqual(['onDate', 'offDate'])
  })

  it('chứng chỉ theo khuôn nhẹ; ô bắt buộc duyệt là loại và hạn', () => {
    const fields = DOC_TYPES.certificate.fields
    expect(fields.map((f) => f.key)).toEqual(['typeCode', 'nameRaw', 'valid', 'noExpiry', 'no', 'issuedOn', 'issuer', 'holder'])
    expect(fields.filter((f) => !f.optional).map((f) => f.key)).toEqual(['typeCode', 'valid', 'noExpiry'])
  })

  it('ô số CMND hoặc hộ chiếu của sổ không tự đẩy vào hồ sơ', () => {
    const id = DOC_TYPES.seaman_book_info.fields.find((f) => f.key === 'id')
    expect(id.target).toBeUndefined()
  })
})

describe('lời nhắc theo việc', () => {
  it('chỉ chứng chỉ mới nhận danh mục loại; sổ không nhận danh mục tàu hay chức danh', () => {
    expect(reader.buildPrompt('certificate', CERT_TYPES)).toContain('BST: An toàn cơ bản')
    const duty = reader.buildPrompt('seaman_book_duty', CERT_TYPES)
    expect(duty).not.toContain('BST:')
    expect(duty).toContain('onPort')
    expect(duty).toMatch(/không phải chỉ dẫn/)
  })

  it('mỗi loại một việc, một mức model, một phiên bản', () => {
    expect(reader.taskOf('seaman_book_info')).toEqual({ task: 'book_info', tier: 'strong', version: 'book_info-1' })
    expect(reader.taskOf('seaman_book_duty')).toMatchObject({ task: 'book_duty', tier: 'strong' })
    expect(reader.taskOf('certificate')).toMatchObject({ task: 'certificate', tier: 'strong' })
    expect(reader.taskOf('passport')).toMatchObject({ task: 'read', tier: 'small' })
  })

  it('khuôn trả về chỉ cho phép key của loại giấy đó', () => {
    const schema = reader.outputSchema('certificate')
    expect(schema.properties.fields.items.properties.key.enum).toEqual(DOC_TYPES.certificate.fields.map((f) => f.key))
    expect(schema.additionalProperties).toBe(false)
  })

  it('loại không có khuôn thì từ chối', () => {
    expect(() => reader.buildPrompt('other')).toThrow()
  })
})

describe('normalizeExtraction', () => {
  const run = (docType, fields, options = {}) => reader.normalizeExtraction({ doc_type: docType, page_label: 'p', fields }, { today: TODAY, ...options })
  const get = (out, key) => out.fields.find((f) => f.key === key)

  it('ngày viết kiểu sổ được đổi sang dd/mm/yyyy bằng code', () => {
    const out = run('seaman_book_duty', [
      field('onDate', '17th-FEB-2020', { value: '2020-02-17' }),
      field('offDate', 'JUL.11.2020', { value: '11/07/2020' }),
    ])
    expect(get(out, 'onDate')).toMatchObject({ value: '17/02/2020', state: 'PROPOSED', raw: '17th-FEB-2020' })
    expect(get(out, 'offDate')).toMatchObject({ value: '11/07/2020', state: 'PROPOSED' })
  })

  it('năm hai chữ số hoặc ngày không đọc được thì DATE_AMBIGUOUS kèm ghi chú', () => {
    const out = run('seaman_book_duty', [field('onDate', '27.03.18', { value: '27/03/18' }), field('offDate', '??/??', { value: '??/??' })])
    expect(get(out, 'onDate')).toMatchObject({ value: '27/03/2018', state: 'DATE_AMBIGUOUS' })
    expect(get(out, 'onDate').note).toBeTruthy()
    expect(get(out, 'offDate')).toMatchObject({ state: 'DATE_AMBIGUOUS' })
  })

  it('ngày rời tàu để trống giữ UNKNOWN, không bịa', () => {
    const out = run('seaman_book_duty', [field('onDate', '10-FEB-2024'), field('offDate', '')])
    expect(get(out, 'offDate')).toMatchObject({ value: '', state: 'UNKNOWN' })
  })

  it('mã loại chứng chỉ không có trong danh mục thì UNKNOWN', () => {
    const codes = CERT_TYPES.map((t) => t.code)
    expect(get(run('certificate', [field('typeCode', 'BST')], { certificateCodes: codes }), 'typeCode')).toMatchObject({ value: 'BST', state: 'PROPOSED' })
    const bad = get(run('certificate', [field('typeCode', 'XYZ')], { certificateCodes: codes }), 'typeCode')
    expect(bad).toMatchObject({ value: '', state: 'UNKNOWN' })
    expect(bad.note).toMatch(/danh mục/)
  })

  it('noExpiry luôn là "true" hoặc "false"', () => {
    expect(get(run('certificate', [field('noExpiry', 'Yes')]), 'noExpiry').value).toBe('true')
    expect(get(run('certificate', [field('noExpiry', '')]), 'noExpiry')).toMatchObject({ value: 'false', state: 'PROPOSED' })
  })

  it('loại không nhận ra thì rỗng', () => {
    expect(reader.normalizeExtraction({ doc_type: 'other', fields: [] }).doc_type).toBeNull()
  })
})

describe('read', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('gọi đúng việc, mức model, ảnh và lời nhắc của loại giấy; ép loại đã biết', async () => {
    vi.spyOn(ai, 'isConfigured').mockReturnValue(true)
    const run = vi.spyOn(ai, 'run').mockResolvedValue({ data: { doc_type: 'other', page_label: '1 trang', fields: [field('typeCode', 'BST'), field('valid', '14/03/2028')] } })
    const images = [{ buffer: Buffer.from('a'), mimeType: 'image/jpeg' }]
    const out = await reader.read(images, CERT_TYPES, { uploadId: 3, documentId: 8 }, 'certificate')
    expect(run.mock.calls[0][0]).toMatchObject({ task: 'certificate', tier: 'strong', detail: 'high', uploadId: 3, documentId: 8, promptVersion: 'certificate-3', images })
    expect(out.doc_type).toBe('certificate')
    expect(out.fields.find((f) => f.key === 'valid').value).toBe('14/03/2028')
  })

  it('chưa cấu hình thì báo, không gọi AI', async () => {
    vi.spyOn(ai, 'isConfigured').mockReturnValue(false)
    const run = vi.spyOn(ai, 'run')
    await expect(reader.read([], [], {}, 'certificate')).rejects.toMatchObject({ statusCode: 503 })
    expect(run).not.toHaveBeenCalled()
  })
})
