import { describe, it, expect } from 'vitest'
const {
  ALL_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  SCOPED_MODULES,
  normalizePermissions,
  normalizeScopes,
  catalogForClient,
} = require('../permissions')

describe('danh mục quyền', () => {
  it('có 36 quyền, 9 mục', () => {
    expect(ALL_PERMISSIONS).toHaveLength(36)
    expect(new Set(ALL_PERMISSIONS.map((c) => c.split('.')[0])).size).toBe(9)
    expect(new Set(ALL_PERMISSIONS).size).toBe(36)
  })

  it('role.manage chỉ Quản trị viên, không cấp được', () => {
    expect(ALL_PERMISSIONS).toContain('role.manage')
    expect(GRANTABLE_PERMISSIONS).not.toContain('role.manage')
    expect(GRANTABLE_PERMISSIONS).toHaveLength(35)
  })

  it('4 mục có phạm vi', () => {
    expect(SCOPED_MODULES).toEqual(['seafarer', 'export', 'voyage', 'contract'])
  })

  it('catalog cho giao diện đủ 36 quyền, đánh dấu admin_only', () => {
    const c = catalogForClient()
    expect(c.total).toBe(36)
    const all = c.modules.flatMap((m) => m.permissions)
    expect(all).toHaveLength(36)
    expect(all.find((p) => p.code === 'role.manage').admin_only).toBe(true)
    expect(all.find((p) => p.code === 'seafarer.update').description).toMatch(/ảnh chân dung/)
  })
})

describe('normalizePermissions', () => {
  it('tự thêm view của mục khi có quyền khác', () => {
    expect(normalizePermissions(['voyage.run'])).toEqual(['voyage.view', 'voyage.run'])
  })
  it('lọc mã lạ, mã adminOnly, trùng; sắp theo danh mục', () => {
    expect(
      normalizePermissions(['vessel.delete', 'role.manage', 'x.y', 'seafarer.view', 'seafarer.view', 'seafarer.create'])
    ).toEqual(['seafarer.view', 'seafarer.create', 'vessel.view', 'vessel.delete'])
  })
  it('không thêm view cho role.manage', () => {
    expect(normalizePermissions(['role.manage'])).toEqual([])
  })
  it('đầu vào không phải mảng thì rỗng', () => {
    expect(normalizePermissions(null)).toEqual([])
    expect(normalizePermissions('seafarer.view')).toEqual([])
  })
})

describe('normalizeScopes', () => {
  it('chỉ giữ own của mục có phạm vi', () => {
    expect(normalizeScopes({ seafarer: 'own', voyage: 'all', vessel: 'own', contract: 'xxx', export: 'own' })).toEqual({
      seafarer: 'own',
      export: 'own',
    })
  })
  it('đầu vào lạ thì rỗng', () => {
    expect(normalizeScopes(null)).toEqual({})
    expect(normalizeScopes([])).toEqual({})
  })
})
