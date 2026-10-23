import { describe, expect, it } from 'vitest'
import scan, { toFormFields, mergeFields } from '../document_scan.service'

const f = (key, value, state = 'PROPOSED') => ({ key, raw: value, value, state, note: null })

describe('toFormFields', () => {
  it('CCCD: đổi giới tính, ngày về ISO, số chỉ giữ chữ số', () => {
    const out = toFormFields('national_id', [
      f('name', 'Nguyễn Văn An'), f('sex', 'Nam'), f('dob', '04/09/1995'), f('no', '031 095 001234'),
      f('origin', 'Hải Phòng'), f('issuedOn', '', 'UNKNOWN'),
    ])
    expect(out).toEqual([
      { field: 'full_name', value: 'Nguyễn Văn An', state: 'ok', source: 'national_id' },
      { field: 'gender', value: 'M', state: 'ok', source: 'national_id' },
      { field: 'date_of_birth', value: '1995-09-04', state: 'ok', source: 'national_id' },
      { field: 'national_id', value: '031095001234', state: 'ok', source: 'national_id' },
      { field: 'place_of_origin', value: 'Hải Phòng', state: 'ok', source: 'national_id' },
    ])
  })

  it('ô ngày chưa chắc thành "check"; ngày không đọc được thì bỏ', () => {
    const out = toFormFields('passport', [f('valid', '12/03/2032', 'DATE_AMBIGUOUS'), f('issuedOn', 'không rõ')])
    expect(out).toEqual([{ field: 'passport_expiry', value: '2032-03-12', state: 'check', source: 'passport' }])
  })

  it('bằng tốt nghiệp: trình độ ngoài danh mục thì bỏ ô đó', () => {
    const out = toFormFields('diploma', [f('level', 'Kỹ sư'), f('school', 'Đại học Hàng hải Việt Nam')])
    expect(out.map((x) => x.field)).toEqual(['education_school'])
    expect(toFormFields('diploma', [f('level', 'Tốt nghiệp Trung cấp')])[0].value).toBe('Trung cấp')
  })

  it('giấy loại không có khuôn thì không điền gì', () => {
    expect(toFormFields('other', [f('no', 'A1')])).toEqual([])
  })

  it('chứng chỉ: đổi mã loại, số, ngày cấp, hạn; "không thời hạn" chỉ điền khi là true', () => {
    const out = toFormFields('certificate', [f('typeCode', 'AFF'), f('no', 'AFF-01'), f('issuedOn', '20/08/2023'), f('noExpiry', 'false')])
    expect(out.map((o) => [o.field, o.value])).toEqual([['certificate_type_code', 'AFF'], ['certificate_number', 'AFF-01'], ['issued_date', '2023-08-20']])
    expect(toFormFields('certificate', [f('noExpiry', 'true')])[0]).toMatchObject({ field: 'no_expiry', value: 'true' })
  })
})

describe('mergeFields', () => {
  it('CCCD thắng hộ chiếu ở ô trùng, ô riêng của hộ chiếu vẫn giữ', () => {
    const merged = mergeFields([
      { type: 'passport', fields: [{ field: 'full_name', value: 'NGUYEN VAN AN', state: 'ok', source: 'passport' }, { field: 'passport_number', value: 'C1', state: 'ok', source: 'passport' }] },
      { type: 'national_id', fields: [{ field: 'full_name', value: 'Nguyễn Văn An', state: 'ok', source: 'national_id' }] },
    ])
    expect(merged.find((x) => x.field === 'full_name').value).toBe('Nguyễn Văn An')
    expect(merged.find((x) => x.field === 'passport_number').value).toBe('C1')
  })
})

describe('scan', () => {
  it('từ chối kind lạ', async () => {
    await expect(scan.scan({}, 'xyz')).rejects.toMatchObject({ statusCode: 400 })
  })
})
