import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, sectionsFor, activeSection, activeTab, initialsOf } from '../navConfig'

describe('navConfig', () => {
  it('sidebar có đúng 4 mục theo thứ tự đã chốt', () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual(['Thuyền viên', 'Bản xuất', 'Danh mục', 'Quản trị'])
  })

  it('trung tâm đào tạo chỉ thấy khóa học và tin nhắn', () => {
    expect(sectionsFor('training_center').map((s) => s.key)).toEqual(['courses', 'messages'])
    expect(sectionsFor('operator')).toBe(NAV_SECTIONS)
  })

  it('chọn mục theo tiền tố đường dẫn, không khớp nửa chữ', () => {
    expect(activeSection(NAV_SECTIONS, '/seafarers/12/edit').key).toBe('seafarers')
    expect(activeSection(NAV_SECTIONS, '/master-data/port').key).toBe('catalog')
    expect(activeSection(NAV_SECTIONS, '/courses/3').key).toBe('admin')
    expect(activeSection(NAV_SECTIONS, '/seafarers-old')).toBeNull()
  })

  it('chọn tab con của mục', () => {
    const catalog = activeSection(NAV_SECTIONS, '/master-data/ship-owners')
    expect(activeTab(catalog, '/master-data/ship-owners').label).toBe('Chủ tàu')
    expect(activeTab(activeSection(NAV_SECTIONS, '/seafarers'), '/seafarers')).toBeNull()
  })

  it('chữ avatar lấy từ email', () => {
    expect(initialsOf('phamvantung@mcah.demo')).toBe('PH')
    expect(initialsOf('')).toBe('?')
  })
})
