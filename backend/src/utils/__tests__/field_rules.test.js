import { describe, it, expect } from 'vitest'
import { assertSeafarerData, seafarerErrors } from '../field_rules'

describe('field_rules: hồ sơ thuyền viên', () => {
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
    expect(vesselErrors({ gross_tonnage: 0, length_overall: 0 })).toEqual([])
    expect(vesselErrors({ call_sign: 'a-1' })).toHaveLength(1)
    expect(vesselErrors({ length_overall: 9999 })).toHaveLength(1)
    expect(vesselErrors({ gross_tonnage: 100, net_tonnage: 200 })).toEqual(['NT không được lớn hơn GRT'])
    expect(vesselErrors({ year_built: 2099 }, 2026)).toHaveLength(1)
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
