import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { roleService } = require('../role.service')
const { ALL_PERMISSIONS, GRANTABLE_PERMISSIONS } = require('../../constants/permissions')

// Pool giả có trạng thái: hiểu đúng những câu SQL mà role.service dùng.
function fakeDb() {
  const state = {
    nextId: 2,
    roles: [{ id: 1, code: 'admin', name: 'Quản trị viên', description: null, scopes: {}, created_at: new Date(1) }],
    perms: [],
    users: [],
    log: [],
    failTx: false,
  }
  const run = async (sql, params = []) => {
    state.log.push(sql)
    if (sql.includes('FROM "role" r')) {
      return [state.roles.map((r) => ({ ...r, user_count: state.users.filter((u) => u.role_id === r.id && !u.deleted_at).length }))]
    }
    if (sql.startsWith('SELECT role_id, permission')) return [state.perms]
    if (sql.startsWith('SELECT id FROM "role" WHERE lower(name)')) {
      return [state.roles.filter((r) => r.name.toLowerCase() === params[0].toLowerCase() && r.id !== params[1]).map((r) => ({ id: r.id }))]
    }
    if (sql.startsWith('INSERT INTO "role" SET')) {
      const id = state.nextId++
      state.roles.push({ id, code: null, ...params[0], scopes: JSON.parse(params[0].scopes), created_at: new Date(id) })
      return [{ insertId: id }]
    }
    if (sql.startsWith('INSERT INTO role_permission')) {
      if (state.failTx) throw new Error('boom')
      for (const [role_id, permission] of params[0]) state.perms.push({ role_id, permission })
      return [{}]
    }
    if (sql.startsWith('DELETE FROM role_permission')) {
      state.perms = state.perms.filter((p) => p.role_id !== params[0])
      return [{}]
    }
    if (sql.startsWith('UPDATE "role" SET scopes')) {
      state.roles.find((r) => r.id === params[1]).scopes = JSON.parse(params[0])
      return [{}]
    }
    if (sql.startsWith('UPDATE "role" SET name')) {
      Object.assign(state.roles.find((r) => r.id === params[2]), { name: params[0], description: params[1] })
      return [{}]
    }
    if (sql.startsWith('UPDATE "user" SET role_id = NULL')) {
      state.users.filter((u) => u.role_id === params[0]).forEach((u) => (u.role_id = null))
      return [{}]
    }
    if (sql.startsWith('DELETE FROM "role"')) {
      state.roles = state.roles.filter((r) => r.id !== params[0])
      return [{}]
    }
    throw new Error('Unexpected SQL: ' + sql)
  }
  // Transaction giả: rollback trả trạng thái về như trước khi bắt đầu.
  const db = {
    state,
    query: run,
    async getConnection() {
      let snapshot
      return {
        query: run,
        beginTransaction: async () => { snapshot = JSON.stringify({ roles: state.roles, perms: state.perms, users: state.users }) },
        commit: async () => {},
        rollback: async () => { Object.assign(state, JSON.parse(snapshot)) },
        release: () => {},
      }
    },
  }
  return db
}

describe('role.service', () => {
  it('danh sách: Quản trị viên đầu tiên, toàn bộ quyền, is_system', async () => {
    const db = fakeDb()
    const [admin] = await roleService.list(db)
    expect(admin).toMatchObject({ code: 'admin', is_system: true, user_count: 0 })
    expect(admin.permissions).toEqual(ALL_PERMISSIONS)
  })

  it('tạo vai trò: cắt khoảng trắng, mô tả rỗng thành null, bắt tên trống', async () => {
    const db = fakeDb()
    const role = await roleService.create(db, { name: '  Nhân viên  ', description: '   ' }, 1)
    expect(role).toMatchObject({ name: 'Nhân viên', description: null, is_system: false, permissions: [] })
    await expect(roleService.create(db, { name: '   ' }, 1)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('tên trùng (không phân biệt hoa thường) thì 409', async () => {
    const db = fakeDb()
    await roleService.create(db, { name: 'Nhân viên' }, 1)
    await expect(roleService.create(db, { name: 'NHÂN VIÊN' }, 1)).rejects.toMatchObject({ statusCode: 409, message: 'Đã có vai trò tên này' })
    await expect(roleService.create(db, { name: 'quản trị viên' }, 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('chép từ Quản trị viên = mọi quyền cấp được (không có role.manage), phạm vi rỗng', async () => {
    const db = fakeDb()
    const role = await roleService.create(db, { name: 'Bản sao', copy_from_role_id: 1 }, 1)
    expect(role.permissions).toEqual(GRANTABLE_PERMISSIONS)
    expect(role.permissions).not.toContain('role.manage')
    expect(role.scopes).toEqual({})
  })

  it('chép từ vai trò thường giữ quyền và phạm vi', async () => {
    const db = fakeDb()
    const a = await roleService.create(db, { name: 'A' }, 1)
    await roleService.savePermissions(db, [{ id: a.id, permissions: ['voyage.run'], scopes: { voyage: 'own' } }])
    const b = await roleService.create(db, { name: 'B', copy_from_role_id: a.id }, 1)
    expect(b.permissions).toEqual(['voyage.view', 'voyage.run'])
    expect(b.scopes).toEqual({ voyage: 'own' })
    await expect(roleService.create(db, { name: 'C', copy_from_role_id: 99 }, 1)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lưu lô: tự thêm view, bỏ role.manage và mã lạ, chuẩn hoá phạm vi', async () => {
    const db = fakeDb()
    const a = await roleService.create(db, { name: 'A' }, 1)
    const list = await roleService.savePermissions(db, [
      {
        id: a.id,
        permissions: ['contract.approve', 'role.manage', 'abc.def', 'vessel.view'],
        scopes: { contract: 'own', vessel: 'own', seafarer: 'all' },
      },
    ])
    const saved = list.find((r) => r.id === a.id)
    expect(saved.permissions).toEqual(['vessel.view', 'contract.view', 'contract.approve'])
    expect(saved.scopes).toEqual({ contract: 'own' })
  })

  it('lưu lô có vai trò hệ thống hoặc không tồn tại thì lỗi, không ghi gì', async () => {
    const db = fakeDb()
    const a = await roleService.create(db, { name: 'A' }, 1)
    await expect(
      roleService.savePermissions(db, [{ id: a.id, permissions: ['vessel.view'] }, { id: 1, permissions: [] }])
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(roleService.savePermissions(db, [{ id: 77, permissions: [] }])).rejects.toMatchObject({ statusCode: 404 })
    expect(db.state.perms).toEqual([])
  })

  it('lưu lô lỗi giữa chừng thì rollback cả lô', async () => {
    const db = fakeDb()
    const a = await roleService.create(db, { name: 'A' }, 1)
    await roleService.savePermissions(db, [{ id: a.id, permissions: ['vessel.view'] }])
    db.state.failTx = true
    await expect(roleService.savePermissions(db, [{ id: a.id, permissions: ['partner.view'] }])).rejects.toThrow('boom')
    expect(db.state.perms).toEqual([{ role_id: a.id, permission: 'vessel.view' }])
  })

  it('không sửa được vai trò Quản trị viên; sửa tên vai trò thường và chặn trùng', async () => {
    const db = fakeDb()
    await expect(roleService.update(db, 1, { name: 'X' })).rejects.toMatchObject({ statusCode: 400, message: 'Không sửa được vai trò Quản trị viên' })
    const a = await roleService.create(db, { name: 'A' }, 1)
    await roleService.create(db, { name: 'B' }, 1)
    expect((await roleService.update(db, a.id, { name: 'A mới', description: 'mô tả' })).name).toBe('A mới')
    await expect(roleService.update(db, a.id, { name: 'b' })).rejects.toMatchObject({ statusCode: 409 })
    expect((await roleService.update(db, a.id, { name: 'A mới', description: null })).description).toBeNull()
  })

  it('xoá: chặn khi còn tài khoản (409), hệ thống (400); không còn thì xoá, tài khoản xoá mềm được gỡ vai trò', async () => {
    const db = fakeDb()
    const a = await roleService.create(db, { name: 'A' }, 1)
    db.state.users.push({ id: 5, role_id: a.id, deleted_at: null })
    await expect(roleService.remove(db, a.id)).rejects.toMatchObject({ statusCode: 409, message: 'Còn 1 tài khoản đang dùng vai trò này' })
    await expect(roleService.remove(db, 1)).rejects.toMatchObject({ statusCode: 400 })
    db.state.users[0].deleted_at = '2026-01-01'
    await roleService.remove(db, a.id)
    expect(db.state.roles.map((r) => r.id)).toEqual([1])
    expect(db.state.users[0].role_id).toBeNull()
  })
})
