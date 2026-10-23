import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, sectionsFor, activeSection, activeTab, initialsOf } from '../navConfig'

describe('navConfig', () => {
  it('sidebar có đúng 10 mục theo thứ tự đã chốt, chia 3 nhóm', () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual(['Tổng quan', 'Thuyền viên', 'Đối tác', 'Tàu', 'Bản xuất', 'Chuyến tàu', 'Hợp đồng', 'Yêu cầu thanh toán', 'Danh mục', 'Quản trị'])
  })

  it('3 nhóm: hồ sơ, vận hành, hệ thống', () => {
    expect(NAV_SECTIONS.map((s) => s.group)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 3, 3])
  })

  const keys = (user) => sectionsFor(user).map((s) => s.key)
  const ALL = NAV_SECTIONS.flatMap((s) => [s.perm, ...(s.tabs || []).map((t) => t.perm)]).filter(Boolean)

  it('đủ quyền thì thấy đủ mục và tab', () => {
    const sections = sectionsFor({ permissions: ALL })
    expect(sections.map((s) => s.key)).toEqual(NAV_SECTIONS.map((s) => s.key))
    expect(sections.at(-1).tabs.map((t) => t.label)).toEqual(['Tài khoản', 'Vai trò và quyền'])
  })

  it('chưa đăng nhập hoặc chưa có quyền nào thì không có mục nào', () => {
    expect(sectionsFor(null)).toEqual([])
    expect(sectionsFor({ permissions: [] })).toEqual([])
  })

  it('chỉ thấy mục có quyền xem', () => {
    expect(keys({ permissions: ['seafarer.view', 'contract.view'] })).toEqual(['dashboard', 'seafarers', 'contracts'])
  })

  it('mục có tab: lọc tab theo quyền, to trỏ tới tab đầu còn lại, ẩn khi hết tab', () => {
    const [admin] = sectionsFor({ permissions: ['role.manage'] })
    expect(admin.tabs.map((t) => t.to)).toEqual(['/admin/roles'])
    expect(admin.to).toBe('/admin/roles')
    expect(keys({ permissions: ['account.view'] })).toEqual(['admin'])
    expect(keys({ permissions: ['role.manage'] })).toEqual(['admin'])
  })

  it('chọn mục theo tiền tố đường dẫn, không khớp nửa chữ', () => {
    expect(activeSection(NAV_SECTIONS, '/seafarers/12/edit').key).toBe('seafarers')
    expect(activeSection(NAV_SECTIONS, '/master-data/port').key).toBe('catalog')
    expect(activeSection(NAV_SECTIONS, '/admin/users/3').key).toBe('admin')
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
