import { describe, it, expect } from 'vitest'
import { assertSeafarerData, seafarerErrors } from '../field_rules'

describe('field_rules: hồ sơ thuyền viên', () => {
  it('chặn CCCD/CMND toàn số 0, giữ số 0 đầu và cho phép để trống', () => {
    for (const national_id of ['000000000000', '000000000', ' 000000000000 ']) {
      expect(seafarerErrors({ national_id })).toEqual(['Số CCCD không hợp lệ: gồm 12 chữ số (CMND cũ 9 chữ số) và không được toàn số 0'])
    }
    for (const national_id of ['012345678901', '012345678', '', null, undefined]) {
      expect(seafarerErrors({ national_id })).toEqual([])
    }
  })
  it('áp dụng cùng quy tắc CCCD cho gia quyến gửi cùng hồ sơ', () => {
    expect(seafarerErrors({ contacts: [{ full_name: 'Nguyễn An', guarantor_id_number: '000000000000' }] })).toHaveLength(1)
    expect(seafarerErrors({ contacts: [{ full_name: 'Nguyễn An', guarantor_id_number: '012345678901' }] })).toEqual([])
  })
  it('ô trống và dữ liệu đúng thì không lỗi', () => {
    expect(seafarerErrors({})).toEqual([])
    expect(seafarerErrors({ national_id: '012345678901', passport_number: 'B1234567', shoe_size: '42.5', pants_size: '30 / 32', height_cm: 170, weight_kg: 65, phone_primary: '0901 234 567', email: 'a@b.vn', social_insurance_number: '1234567890' })).toEqual([])
  })

  it('số âm, chữ lẫn vào ô số, sai độ dài đều bị chặn', () => {
    expect(seafarerErrors({ national_id: '-11212121212' })).toHaveLength(1)
    expect(seafarerErrors({ national_id: '12345' })).toHaveLength(1)
    expect(seafarerErrors({ shoe_size: '-10' }).length).toBeGreaterThan(0)
    expect(seafarerErrors({ shoe_size: '5' }).length).toBeGreaterThan(0)
    expect(seafarerErrors({ pants_size: '-10' })).toHaveLength(1)
    expect(seafarerErrors({ height_cm: -1 }).length).toBeGreaterThan(0)
    expect(seafarerErrors({ weight_kg: 900 })).toHaveLength(1)
    expect(seafarerErrors({ phone_primary: 'abc' })).toHaveLength(1)
    expect(seafarerErrors({ email: 'abc' })).toHaveLength(1)
    expect(seafarerErrors({ full_name: 'Nguyen 123' })).toHaveLength(1)
  })

  it('0 coi như chưa nhập chiều cao, cân nặng', () => {
    expect(seafarerErrors({ height_cm: 0, weight_kg: 0 })).toEqual([])
  })

  it('ngày: không ở tương lai, hết hạn sau ngày cấp', () => {
    expect(seafarerErrors({ date_of_birth: '2999-01-01' })).toHaveLength(1)
    expect(seafarerErrors({ passport_issued_date: '2024-05-01', passport_expiry: '2023-05-01' })).toHaveLength(1)
  })
  it('ngày cấp hộ chiếu phải từ ngày sinh trở đi', () => {
    expect(seafarerErrors({ date_of_birth: '2000-01-01', passport_issued_date: '1999-01-01', passport_expiry: '2029-01-01' })).toEqual(['Ngày cấp hộ chiếu không được trước ngày sinh'])
    for (const passport_issued_date of ['2000-01-01', '2001-01-01', null, undefined]) {
      expect(seafarerErrors({ date_of_birth: '2000-01-01', passport_issued_date })).toEqual([])
    }
    expect(seafarerErrors({ date_of_birth: new Date('2000-01-01T00:00:00Z'), passport_issued_date: '1999-01-01' })).toHaveLength(1)
  })

  it('tài khoản ngân hàng và người thân kiểm theo từng dòng (mỗi dòng báo lỗi đầu tiên)', () => {
    const errors = seafarerErrors({ bank_accounts: [{ account_number: '12ab' }], contacts: [{ phone_primary: '1', guarantor_id_number: '9' }] })
    expect(errors).toHaveLength(2)
  })

  it('assert ném 400 kèm số lỗi còn lại', () => {
    expect(() => assertSeafarerData({ national_id: '1', email: 'x' })).toThrow()
    try { assertSeafarerData({ national_id: '1', email: 'x' }) } catch (e) { expect(e.statusCode).toBe(400); expect(e.message).toContain('còn 1 lỗi nữa') }
  })
})

describe('field_rules: đối tác, tàu, danh mục', () => {
  it('website kiểm tra cổng URL, vẫn nhận địa chỉ hợp lệ và ô trống', async () => {
    const { ownerErrors } = await import('../field_rules')
    for (const website of ['https://example.com:99999', 'https://example.com:65536', 'https://example.com:abc', 'https://example.com:-1', 'example.com', 'ftp://example.com']) {
      expect(ownerErrors({ website })).toEqual(['URL không hợp lệ. Website phải dùng http:// hoặc https:// và có cổng hợp lệ.'])
    }
    for (const website of ['https://example.com', 'http://example.com:8080', 'https://example.com:65535/a?q=1#contact', '', null, undefined]) {
      expect(ownerErrors({ website })).toEqual([])
    }
  })
  it('chặn điện thoại công ty toàn số 0 kể cả khi có dấu phân cách', async () => {
    const { ownerErrors } = await import('../field_rules')
    for (const phone of ['0000000000', ' 0000000000 ', '+00 0000 0000', '(000) 000-0000', '000.000.0000']) {
      expect(ownerErrors({ phone })).toEqual(['Số điện thoại công ty không hợp lệ: gồm 8–15 chữ số và không được toàn số 0'])
    }
    for (const phone of ['0901234567', '0225 123 4567', '+84 901 234 567', '', null, undefined]) {
      expect(ownerErrors({ phone })).toEqual([])
    }
  })
  it('mã số thuế không được toàn số 0, kể cả khi có dấu phân cách', async () => {
    const { ownerErrors } = await import('../field_rules')
    for (const tax_id of ['0000000000', '0000000000000', ' 0000000000 ', '0000000000-000', '000.000.0000']) {
      expect(ownerErrors({ tax_id })).toEqual(['Mã số thuế không hợp lệ: không được toàn số 0'])
    }
    for (const tax_id of ['0123456789', '0000123456', '0123456789-001', 'SG-12345', '', null, undefined]) {
      expect(ownerErrors({ tax_id })).toEqual([])
    }
  })
  it('MMSI không được toàn số 0 hoặc sai độ dài; cho phép bỏ trống', async () => {
    const { vesselErrors } = await import('../field_rules')
    for (const mmsi of ['000000000', '12345', '1234567890', '12345678A']) {
      expect(vesselErrors({ mmsi })).toEqual(['MMSI không hợp lệ: phải gồm 9 chữ số và không được toàn số 0'])
    }
    for (const mmsi of ['574123456', '000000001', '', null, undefined]) {
      expect(vesselErrors({ mmsi })).toEqual([])
    }
  })
  it('đối tác: thuế, điện thoại, email, website, người liên hệ', async () => {
    const { ownerErrors } = await import('../field_rules')
    expect(ownerErrors({ company_name: 'ABC', tax_id: '0123456789', phone: '+65 9123 4567', email: 'a@b.com', website: 'https://abc.com' })).toEqual([])
    expect(ownerErrors({ company_name: '   ' })).toHaveLength(1)
    expect(ownerErrors({ tax_id: '-1' })).toHaveLength(1)
    expect(ownerErrors({ phone: 'abc', fax: '1' })).toHaveLength(2)
    expect(ownerErrors({ website: 'abc' })).toHaveLength(1)
    expect(ownerErrors({ contacts: [{ name: 'A', phone: '12', email: 'x' }] })).toHaveLength(1)
  })

  it('tàu: số dương có trần, NT không quá GRT, call sign, năm đóng', async () => {
    const { vesselErrors } = await import('../field_rules')
    expect(vesselErrors({ vessel_name: 'MV A', call_sign: 'ABCD1', gross_tonnage: 5000, net_tonnage: 2000, length_overall: 120, year_built: 2016 }, 2026)).toEqual([])
    expect(vesselErrors({ gross_tonnage: 0 })).toEqual([])
    expect(vesselErrors({ call_sign: 'a-1' })).toHaveLength(1)
    expect(vesselErrors({ length_overall: 9999 })).toHaveLength(1)
    expect(vesselErrors({ gross_tonnage: 100, net_tonnage: 200 })).toEqual(['NT không được lớn hơn GRT'])
    expect(vesselErrors({ year_built: 2099 }, 2026)).toHaveLength(1)
  })

  it('LOA nếu nhập phải lớn hơn 0, vẫn cho phép số thập phân và để trống', async () => {
    const { vesselErrors } = await import('../field_rules')
    for (const length_overall of [0, '0', -1, 600.01]) {
      expect(vesselErrors({ length_overall })).toEqual(['LOA phải là số dương, không quá 600'])
    }
    for (const length_overall of [0.01, 120.5, 600, '', null, undefined]) {
      expect(vesselErrors({ length_overall })).toEqual([])
    }
  })

  it('danh mục: mã, tên quá dài, hiệu lực, UN/LOCODE', async () => {
    const { masterErrors } = await import('../field_rules')
    expect(masterErrors('vessel_type', { code: 'BULK', name_vi: 'Hàng rời' })).toEqual([])
    expect(masterErrors('vessel_type', { code: 'a b' })).toHaveLength(1)
    expect(masterErrors('vessel_type', { name_vi: 'x'.repeat(101) })).toHaveLength(1)
    expect(masterErrors('certificate_type', { name_vi: 'x'.repeat(150), validity_years: 0 })).toHaveLength(1)
    expect(masterErrors('port', { name: ' ', un_locode: 'VN1' })).toHaveLength(2)
    expect(masterErrors('country', { code: 'zz' })).toEqual([])
  })
})
