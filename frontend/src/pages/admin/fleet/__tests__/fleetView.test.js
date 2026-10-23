import { describe, it, expect } from 'vitest'
import {
  vesselSections,
  partnerSections,
  countFilled,
  vesselToFormValues,
  vesselToPayload,
  partnerToPayload,
  partnerToFormValues,
  cleanContactList,
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

  it('đủ 27 trường của tàu, không trùng', () => {
    const labels = vesselSections(vessel).flatMap((s) => s.fields.map((f) => f[0]))
    expect(labels).toHaveLength(27)
    expect(new Set(labels).size).toBe(27)
  })

  it('định dạng số và đơn vị', () => {
    const fields = Object.fromEntries(vesselSections(vessel).flatMap((s) => s.fields.map((f) => [f[0], f[1]])))
    expect(fields.DWT).toBe('16.805 tấn')
    expect(fields['Công suất máy']).toBe('4.440 kW')
    expect(fields['Nồi hơi']).toBe('Không')
    expect(fields['Lạnh (Refrigeration)']).toBe('Có')
    expect(fields['Trạng thái']).toBe('Hoạt động')
  })

  it('đếm trường đã điền, bỏ qua cờ luôn có giá trị', () => {
    const engine = vesselSections(vessel).find((s) => s.key === 'eng')
    expect(countFilled(engine)).toEqual({ done: 1, total: 3 })
  })

  it('đối tác: tình trạng theo is_active', () => {
    const owner = { company_name: 'HTK', is_active: 0 }
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
    expect(partnerToPayload({ company_name: 'HTK', country_id: '' })).toMatchObject({ country_id: null, is_active: 1 })
    expect(partnerToPayload({ company_name: 'X', is_active: 0 }).is_active).toBe(0)
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

describe('người liên hệ của đối tác', () => {
  it('bỏ dòng trống và luôn có đúng một liên hệ chính', () => {
    const list = cleanContactList([{ name: ' An ', phone: '' }, { name: '', position: '' }, { name: 'Bình', is_primary: true }, { name: 'Chi', is_primary: true }])
    expect(list.map((c) => c.name)).toEqual(['An', 'Bình', 'Chi'])
    expect(list.map((c) => c.is_primary)).toEqual([false, true, false])
  })

  it('người đầu tiên là liên hệ chính khi chưa chọn ai', () => {
    expect(cleanContactList([{ name: 'An' }, { name: 'Bình' }]).map((c) => c.is_primary)).toEqual([true, false])
    expect(cleanContactList(undefined)).toEqual([])
  })

  it('đổi người liên hệ tính là đã sửa, giữ nguyên thì không', () => {
    const owner = { id: 1, company_name: 'ACME', contacts: [{ name: 'An', phone: '1', is_primary: true }] }
    const initial = partnerToFormValues(owner)
    expect(changedKeys(initial, { ...initial }, partnerToPayload)).toEqual([])
    expect(changedKeys(initial, { ...initial, contacts: [{ ...initial.contacts[0], phone: '2' }] }, partnerToPayload)).toEqual(['contacts'])
  })

  it('màn chi tiết liệt kê từng người, ghi rõ ai là liên hệ chính', () => {
    const person = partnerSections({ contacts: [{ name: 'An', position: 'GĐ', phone: '1', is_primary: true }, { name: 'Bình', is_primary: false }] }).find((x) => x.key === 'person')
    expect(person.items.map((item) => item.title)).toEqual(['Người liên hệ 1', 'Người liên hệ 2'])
    expect(person.items[0].tags).toEqual(['Liên hệ chính'])
    expect(person.items[1].tags).toEqual([])
    expect(person.items[0].fields.find((f) => f[0] === 'Chức vụ')[1]).toBe('GĐ')
  })
})
