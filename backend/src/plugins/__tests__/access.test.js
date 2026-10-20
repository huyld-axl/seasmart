import { describe, it, expect, vi } from 'vitest'
const { loadAccess, can, scopeOf, ownFilter, assertInScope } = require('../access')
const { ALL_PERMISSIONS } = require('../../constants/permissions')

const dbWith = (row) => ({ query: vi.fn().mockResolvedValue([row ? [row] : []]) })
const base = { email: 'a@b.vn', is_active: 1, deleted_at: null }

describe('loadAccess', () => {
  it('Quản trị viên có mọi quyền, phạm vi all', async () => {
    const a = await loadAccess(1, dbWith({ ...base, role_id: 1, role_code: 'admin', role_name: 'Quản trị viên', role_scopes: { seafarer: 'own' }, permissions: [] }))
    expect(a.isAdmin).toBe(true)
    expect([...a.permissions]).toEqual(ALL_PERMISSIONS)
    expect(a.scopes).toEqual({})
  })
  it('chưa có vai trò thì không có quyền nào', async () => {
    const a = await loadAccess(2, dbWith({ ...base, role_id: null, role_code: null, role_name: null, role_scopes: null, permissions: [] }))
    expect(a.isAdmin).toBe(false)
    expect(a.roleId).toBeNull()
    expect(a.permissions.size).toBe(0)
  })
  it('vai trò thường lấy quyền và phạm vi từ DB', async () => {
    const a = await loadAccess(3, dbWith({ ...base, role_id: 5, role_code: null, role_name: 'Nhân viên', role_scopes: { voyage: 'own' }, permissions: ['voyage.view'] }))
    expect(a.permissions.has('voyage.view')).toBe(true)
    expect(a.scopes).toEqual({ voyage: 'own' })
    expect(a.isSystemRole).toBe(false)
  })
  it('tài khoản khoá, xoá mềm hoặc không có thì null', async () => {
    expect(await loadAccess(1, dbWith({ ...base, is_active: 0 }))).toBeNull()
    expect(await loadAccess(1, dbWith({ ...base, deleted_at: new Date() }))).toBeNull()
    expect(await loadAccess(1, dbWith(null))).toBeNull()
  })
})

describe('can', () => {
  const reply = () => {
    const r = { code: vi.fn(() => r), send: vi.fn(() => r) }
    return r
  }
  it('đủ quyền thì cho qua', async () => {
    const r = reply()
    await can('voyage.view', 'voyage.run')({ access: { permissions: new Set(['voyage.view', 'voyage.run']) } }, r)
    expect(r.code).not.toHaveBeenCalled()
  })
  it('thiếu bất kỳ quyền nào thì 403', async () => {
    const r = reply()
    await can('voyage.view', 'voyage.run')({ access: { permissions: new Set(['voyage.view']) } }, r)
    expect(r.code).toHaveBeenCalledWith(403)
    expect(r.send).toHaveBeenCalledWith({ error: 'Không có quyền' })
  })
  it('không có access thì 403', async () => {
    const r = reply()
    await can('voyage.view')({}, r)
    expect(r.code).toHaveBeenCalledWith(403)
  })
})

describe('phạm vi dữ liệu', () => {
  const own = { access: { userId: 7, isAdmin: false, scopes: { seafarer: 'own' } } }
  const all = { access: { userId: 7, isAdmin: false, scopes: {} } }
  const admin = { access: { userId: 7, isAdmin: true, scopes: { seafarer: 'own' } } }

  it('scopeOf', () => {
    expect(scopeOf(own, 'seafarer')).toBe('own')
    expect(scopeOf(own, 'voyage')).toBe('all')
    expect(scopeOf(all, 'seafarer')).toBe('all')
    expect(scopeOf(admin, 'seafarer')).toBe('all')
  })
  it('ownFilter hai nhánh', () => {
    expect(ownFilter(own, 'seafarer', 's.created_by')).toEqual({ sql: ' AND s.created_by = ?', params: [7] })
    expect(ownFilter(all, 'seafarer', 's.created_by')).toEqual({ sql: '', params: [] })
  })
  it('assertInScope: own chỉ cho bản ghi của mình, còn lại 404', () => {
    expect(() => assertInScope(own, 'seafarer', { created_by: 7 })).not.toThrow()
    expect(() => assertInScope(own, 'seafarer', { created_by: 8 })).toThrow(expect.objectContaining({ statusCode: 404 }))
    expect(() => assertInScope(own, 'seafarer', { created_by: null })).toThrow(expect.objectContaining({ statusCode: 404 }))
    expect(() => assertInScope(all, 'seafarer', { created_by: null })).not.toThrow()
  })
})
