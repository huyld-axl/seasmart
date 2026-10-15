import { describe, it, expect } from 'vitest'
import {
  vesselSections,
  partnerSections,
  countFilled,
  vesselToFormValues,
  vesselToPayload,
  partnerToPayload,
  changedKeys,
  initialsOfName,
} from '../fleetView'

const vessel = {
  vessel_name: 'ATAYAL STAR',
  imo_number: '9606962',
  vessel_type_name: 'Bulk carrier',
  flag_name: 'Panama',
  year_built: 2012,
  status: 'ACTIVE',
  gross_tonnage: '9991.00',
  deadweight: '16805.00',
  engine_power_kw: '4440.00',
  has_boiler: 0,
  has_refrigeration: 1,
  ship_owner_name: 'Wisdom Marine Lines',
  ship_owner_code: 'WISDOM',
}

describe('fleetView', () => {
  it('tàu có 6 khối theo thứ tự đã chốt', () => {
    expect(vesselSections(vessel).map((s) => s.title)).toEqual([
      'Nhận dạng',
      'Đăng ký và phân loại',
      'Thông số',
      'Máy và thiết bị',
      'Quản lý',
      'Ghi chú',
    ])
  })

  it('đủ 28 trường của tàu, không trùng', () => {
    const labels = vesselSections(vessel).flatMap((s) => s.fields.map((f) => f[0]))
    expect(labels).toHaveLength(28)
    expect(new Set(labels).size).toBe(28)
  })

  it('định dạng số và đơn vị', () => {
    const fields = Object.fromEntries(vesselSections(vessel).flatMap((s) => s.fields.map((f) => [f[0], f[1]])))
    expect(fields.DWT).toBe('16.805 tấn')
    expect(fields['Công suất máy']).toBe('4.440 kW')
    expect(fields['Nồi hơi']).toBe('Không')
    expect(fields['Lạnh (Refrigeration)']).toBe('Có')
    expect(fields['Trạng thái']).toBe('Hoạt động')
    expect(fields['Mã chủ tàu']).toBe('WISDOM')
  })

  it('đếm trường đã điền, bỏ qua cờ luôn có giá trị', () => {
    const engine = vesselSections(vessel).find((s) => s.key === 'eng')
    expect(countFilled(engine)).toEqual({ done: 1, total: 3 })
  })

  it('đối tác: tình trạng theo is_active', () => {
    const owner = { company_name: 'HTK', code: 'HTK', is_active: 0 }
    const company = partnerSections(owner).find((s) => s.key === 'company')
    expect(company.fields.find((f) => f[0] === 'Tình trạng')[1]).toBe('Ngừng hợp tác')
  })

  it('form tàu mới mặc định Hoạt động, nồi hơi và lạnh tắt', () => {
    expect(vesselToFormValues(null)).toMatchObject({ status: 'ACTIVE', has_boiler: false, has_refrigeration: false })
  })

  it('payload tàu: chuỗi rỗng thành null, cờ thành 0/1, số thành number', () => {
    const payload = vesselToPayload({
      vessel_name: '  GEIYO K ',
      call_sign: '   ',
      gross_tonnage: 31557,
      deadweight: null,
      has_boiler: true,
      has_refrigeration: false,
      ship_owner_id: 4,
      class_status: undefined,
    })
    expect(payload).toMatchObject({
      vessel_name: 'GEIYO K',
      call_sign: null,
      gross_tonnage: 31557,
      deadweight: null,
      has_boiler: 1,
      has_refrigeration: 0,
      ship_owner_id: 4,
      class_status: null,
      status: 'ACTIVE',
    })
  })

  it('payload đối tác: mã viết hoa, trạng thái mặc định 1', () => {
    expect(partnerToPayload({ code: 'htk', company_name: 'HTK', country_id: '' })).toMatchObject({ code: 'HTK', country_id: null, is_active: 1 })
    expect(partnerToPayload({ code: 'x', company_name: 'X', is_active: 0 }).is_active).toBe(0)
  })

  it('tìm các khóa đã đổi', () => {
    const before = vesselToFormValues(vessel)
    const after = { ...before, vessel_name: 'ATAYAL STAR II', has_boiler: true }
    expect(changedKeys(before, after, vesselToPayload).sort()).toEqual(['has_boiler', 'vessel_name'])
  })

  it('chữ đầu tên đối tác', () => {
    expect(initialsOfName('HTK SIMEX Co. Ltd')).toBe('HS')
    expect(initialsOfName('VIMARU')).toBe('VI')
    expect(initialsOfName('')).toBe('?')
  })
})
