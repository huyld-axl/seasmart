import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, sectionsFor, activeSection, activeTab, initialsOf } from '../navConfig'

describe('navConfig', () => {
  it('sidebar có đúng 8 mục theo thứ tự đã chốt, chia 3 nhóm', () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual(['Thuyền viên', 'Đối tác', 'Tàu', 'Bản xuất', 'Chuyến tàu', 'Hợp đồng', 'Danh mục', 'Quản trị'])
  })

  it('3 nhóm: hồ sơ, vận hành, hệ thống', () => {
    expect(NAV_SECTIONS.map((s) => s.group)).toEqual([1, 1, 1, 1, 2, 2, 3, 3])
  })

  it('trung tâm đào tạo chỉ thấy khóa học và tin nhắn', () => {
    expect(sectionsFor('training_center').map((s) => s.key)).toEqual(['courses', 'messages'])
    expect(sectionsFor('operator')).toBe(NAV_SECTIONS)
    expect(sectionsFor('training_center').some((s) => ['voyages', 'contracts'].includes(s.key))).toBe(false)
  })

  it('chọn mục theo tiền tố đường dẫn, không khớp nửa chữ', () => {
    expect(activeSection(NAV_SECTIONS, '/seafarers/12/edit').key).toBe('seafarers')
    expect(activeSection(NAV_SECTIONS, '/master-data/port').key).toBe('catalog')
    expect(activeSection(NAV_SECTIONS, '/courses/3').key).toBe('admin')
    expect(activeSection(NAV_SECTIONS, '/seafarers-old')).toBeNull()
  })

  it('chọn tab con của mục', () => {
    expect(activeSection(NAV_SECTIONS, '/partners/7/edit').key).toBe('ship-owners')
    expect(activeSection(NAV_SECTIONS, '/vessels/new').key).toBe('vessels')
    expect(activeSection(NAV_SECTIONS, '/voyages/5/edit').key).toBe('voyages')
    expect(activeSection(NAV_SECTIONS, '/contracts/new').key).toBe('contracts')
    expect(activeTab(activeSection(NAV_SECTIONS, '/seafarers'), '/seafarers')).toBeNull()
  })

  it('chữ avatar lấy từ email', () => {
    expect(initialsOf('phamvantung@mcah.demo')).toBe('PH')
    expect(initialsOf('')).toBe('?')
  })
})
