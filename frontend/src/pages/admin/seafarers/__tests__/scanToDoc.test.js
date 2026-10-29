import { describe, it, expect } from 'vitest'
import { fromScan, profileDiff, profileFromForm } from '../scanToDoc'

const types = [{ id: 1, code: 'PASSPORT' }, { id: 2, code: 'CITIZEN_ID' }, { id: 3, code: 'BST' }]

describe('nạp giấy: AI đọc → hộp thoại và hồ sơ', () => {
  it('hộ chiếu: điền số, ngày cấp, hạn; gom ô hồ sơ đọc được', () => {
    const out = fromScan({ documents: [{ type: 'passport' }], fields: [
      { field: 'passport_number', value: 'C123', source: 'passport' }, { field: 'passport_issued_date', value: '2020-01-02', source: 'passport' },
      { field: 'passport_expiry', value: '2030-01-01', source: 'passport' }, { field: 'full_name', value: 'TRẦN AN', source: 'passport' },
    ] }, types)
    expect(out).toMatchObject({ docType: 'passport', typeId: 1, values: { certificate_number: 'C123', issued_date: '2020-01-02', expiry_date: '2030-01-01' } })
    expect(out.profile).toEqual({ passport_number: 'C123', passport_issued_date: '2020-01-02', passport_expiry: '2030-01-01', full_name: 'TRẦN AN' })
  })

  it('chứng chỉ: tìm loại theo mã, không đụng hồ sơ; AI không nhận ra thì null', () => {
    expect(fromScan({ documents: [{ type: 'certificate' }], fields: [{ field: 'certificate_type_code', value: 'BST' }] }, types)).toMatchObject({ typeId: 3, profile: {} })
    expect(fromScan({ documents: [], fields: [] }, types)).toBeNull()
  })

  it('chỉ liệt kê ô hồ sơ khác giá trị đang có', () => {
    const next = { ...profileFromForm('PASSPORT', { certificate_number: 'C123', issued_date: '2020-01-02', expiry_date: '2030-01-01' }), full_name: 'trần an' }
    const diff = profileDiff(next, { passport_number: 'C000', passport_issued_date: '2020-01-02T00:00:00Z', full_name: 'Trần An' })
    expect(diff.map((d) => d.field)).toEqual(['passport_number', 'passport_expiry'])
  })
})
