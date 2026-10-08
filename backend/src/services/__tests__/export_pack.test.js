import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { normalizeDocs, packTitle, cleanInputs, requiredSignatures, isComplete, packCode, packIdFromCode, checkSignatureImage } = require('../export_pack.service')
const { PACK_TEMPLATES } = require('../../constants/pack_templates')
const { diffFields } = require('../seafarer.service')

describe('bộ giấy tờ: luật thuần', () => {
  it('12 mẫu, đúng các mẫu có file Excel', () => {
    expect(PACK_TEMPLATES).toHaveLength(12)
    expect(PACK_TEMPLATES.filter((t) => !t.formKey).map((t) => t.key)).toEqual(['cv'])
  })

  it('chuẩn hoá danh sách giấy: theo thứ tự mẫu, bỏ trùng', () => {
    expect(normalizeDocs(['uql', 'qddd', 'qddd'])).toEqual(['qddd', 'uql'])
  })

  it('từ chối mẫu lạ, danh sách rỗng, hai đơn BHXH cùng lúc', () => {
    expect(() => normalizeDocs(['xyz'])).toThrow()
    expect(() => normalizeDocs([])).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expect(() => normalizeDocs(['bhxh', 'kbhxh'])).toThrowError(expect.objectContaining({ message: 'Chỉ chọn một trong hai đơn BHXH' }))
  })

  it('tên bộ theo giai đoạn', () => {
    expect(packTitle(['qddd', 'bl'])).toBe('Bộ giấy lên tàu')
    expect(packTitle(['kq', 'qdrt'])).toBe('Bộ giấy')
  })

  it('chỉ giữ ô điền đã biết, bỏ chuỗi rỗng', () => {
    expect(cleanInputs({ 'Tên tàu': ' MV A ', 'Lạ': 'x', 'Số tiền': '  ' })).toEqual({ 'Tên tàu': 'MV A' })
  })

  it('chữ ký cần và khi nào xong', () => {
    const needed = requiredSignatures(['tl', 'cv'])
    expect(needed).toEqual([{ templateKey: 'tl', signer: 'Thuyền viên' }, { templateKey: 'tl', signer: 'Giám đốc' }])
    expect(isComplete(['tl'], [{ template_key: 'tl', signer: 'Giám đốc' }])).toBe(false)
    expect(isComplete(['tl', 'cv'], [{ template_key: 'tl', signer: 'Giám đốc' }, { template_key: 'tl', signer: 'Thuyền viên' }])).toBe(true)
  })

  it('mã bộ', () => {
    expect(packCode(42)).toBe('B0042')
    expect(packIdFromCode('b0042')).toBe(42)
    expect(packIdFromCode('Trần')).toBeNull()
  })

  it('ảnh chữ ký phải là PNG data URL', () => {
    expect(() => checkSignatureImage('data:image/png;base64,iVBORw0KGgo=')).not.toThrow()
    expect(() => checkSignatureImage('data:image/svg+xml;base64,PHN2Zz4=')).toThrow()
    expect(() => checkSignatureImage('<script>')).toThrow()
  })
})

describe('lịch sử sửa hồ sơ', () => {
  it('chỉ ghi trường thật sự đổi, ngày so theo ngày', () => {
    const before = { full_name: 'A', date_of_birth: new Date('1990-03-13T00:00:00Z'), height_cm: 170, notes: null }
    expect(diffFields(before, { full_name: 'A', date_of_birth: '1990-03-13', height_cm: '170', notes: '' })).toEqual({})
    expect(diffFields(before, { full_name: 'B', height_cm: 172 })).toEqual({ full_name: ['A', 'B'], height_cm: ['170', '172'] })
  })
})
