import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const userService = require('../user.service')

// Db giả có trạng thái, hiểu các câu SQL của user.service.
function fakeDb(users, roles = [{ id: 1, code: 'admin', name: 'Quản trị viên' }, { id: 2, code: null, name: 'Nhân viên' }]) {
  const state = { users, roles, nextId: 100, log: [] }
  const row = (u) => {
    const r = roles.find((x) => x.id === u.role_id)
    return { ...u, role_code: r?.code ?? null, role_name: r?.name ?? null }
  }
  state.query = async (sql, params = []) => {
    state.log.push({ sql, params })
    if (sql.startsWith('SELECT id, code FROM "role"')) return [roles.filter((r) => r.id === params[0])]
    if (sql.includes('FROM "user" u LEFT JOIN "role" r') && sql.includes('WHERE u.id = ?')) {
      return [state.users.filter((u) => u.id === params[0] && !u.deleted_at).map(row)]
    }
    if (sql.includes('JOIN "role" r ON r.id = u.role_id') && sql.includes('r.code = ?')) {
      return [state.users.filter((u) => row(u).role_code === 'admin' && u.is_active && !u.deleted_at && u.id !== params[1]).map(() => ({ 1: 1 }))]
    }
    if (sql.startsWith('SELECT id FROM "user" WHERE email')) {
      return [state.users.filter((u) => u.email === params[0] && !u.deleted_at && u.id !== (params[1] ?? -1)).map((u) => ({ id: u.id }))]
    }
    if (sql.startsWith('INSERT INTO "user"')) {
      const [email, , role_id] = params
      state.users.push({ id: state.nextId, email, role_id, is_active: 1, deleted_at: null })
      return [{ insertId: state.nextId++ }]
    }
    if (sql.startsWith('UPDATE "user" SET deleted_at')) {
      state.users.find((u) => u.id === params[0]).deleted_at = 'x'
      return [{}]
    }
    if (sql.startsWith('UPDATE "user" SET is_active = 1 - is_active')) {
      const u = state.users.find((x) => x.id === params[0])
      u.is_active = 1 - u.is_active
      return [{}]
    }
    if (sql.startsWith('UPDATE "user" SET')) {
      const cols = [...sql.matchAll(/(\w+) = \?/g)].map((m) => m[1])
      const id = params[params.length - 1]
      const u = state.users.find((x) => x.id === id)
      cols.forEach((c, i) => {
        if (c !== 'id') u[c] = params[i]
      })
      return [{}]
    }
    throw new Error('Unexpected SQL: ' + sql)
  }
  return state
}

const admin = (id = 1) => ({ id, email: `a${id}@x`, role_id: 1, is_active: 1, deleted_at: null })
const staff = (id) => ({ id, email: `s${id}@x`, role_id: 2, is_active: 1, deleted_at: null })
const noRole = (id) => ({ id, email: `n${id}@x`, role_id: null, is_active: 1, deleted_at: null })
const actorAdmin = { userId: 1, isAdmin: true }
const actorStaff = { userId: 10, isAdmin: false }

describe('tạo tài khoản', () => {
  it('chọn vai trò không tồn tại thì 400', async () => {
    const db = fakeDb([admin()])
    await expect(userService.createUser({ email: 'n@x', password: 'secret1', role_id: 99 }, actorAdmin, db)).rejects.toMatchObject({ statusCode: 400 })
  })
  it('người không phải Quản trị viên không gán được vai trò Quản trị viên', async () => {
    const db = fakeDb([admin(), staff(10)])
    await expect(userService.createUser({ email: 'n@x', password: 'secret1', role_id: 1 }, actorStaff, db)).rejects.toMatchObject({ statusCode: 403 })
    expect(db.users).toHaveLength(2)
  })
  it('Quản trị viên tạo được tài khoản vai trò thường', async () => {
    const db = fakeDb([admin()])
    const user = await userService.createUser({ email: 'n@x', password: 'secret1', role_id: 2 }, actorAdmin, db)
    expect(user.role).toEqual({ id: 2, name: 'Nhân viên', is_system: false })
  })
  it('email trùng thì 400', async () => {
    const db = fakeDb([admin(), staff(10)])
    await expect(userService.createUser({ email: 's10@x', password: 'secret1', role_id: 2 }, actorAdmin, db)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('chống tự khoá / tự nâng quyền', () => {
  it('không tự đổi vai trò của mình', async () => {
    const db = fakeDb([admin(1), admin(2)])
    await expect(userService.updateUser(1, { role_id: 2 }, actorAdmin, db)).rejects.toMatchObject({ statusCode: 403, message: 'Không tự đổi vai trò của mình' })
  })
  it('gửi lại đúng vai trò hiện tại của mình thì không sao', async () => {
    const db = fakeDb([admin(1)])
    await expect(userService.updateUser(1, { role_id: 1, email: 'new@x' }, actorAdmin, db)).resolves.toMatchObject({ email: 'new@x' })
  })
  it('không tự khoá, không tự xoá', async () => {
    const db = fakeDb([admin(1), admin(2)])
    await expect(userService.updateUser(1, { is_active: false }, actorAdmin, db)).rejects.toMatchObject({ statusCode: 403 })
    await expect(userService.toggleActive(1, actorAdmin, db)).rejects.toMatchObject({ statusCode: 403 })
    await expect(userService.softDeleteUser(1, actorAdmin, db)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('người có account.update nhưng không phải Quản trị viên: không đụng tới Quản trị viên', async () => {
    const db = fakeDb([admin(1), staff(10)])
    await expect(userService.updateUser(1, { email: 'x@x' }, actorStaff, db)).rejects.toMatchObject({ statusCode: 403 })
    await expect(userService.toggleActive(1, actorStaff, db)).rejects.toMatchObject({ statusCode: 403 })
    await expect(userService.softDeleteUser(1, actorStaff, db)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('người không phải Quản trị viên không gán hoặc bỏ vai trò Quản trị viên', async () => {
    const db = fakeDb([admin(1), staff(10), staff(11)])
    await expect(userService.updateUser(11, { role_id: 1 }, actorStaff, db)).rejects.toMatchObject({ statusCode: 403 })
    await expect(userService.updateUser(11, { role_id: 2, email: 'e@x' }, actorStaff, db)).resolves.toMatchObject({ email: 'e@x' })
  })
  it('không còn Quản trị viên hoạt động nào thì chặn khoá, xoá, hạ vai trò (409)', async () => {
    // Người thao tác là Quản trị viên 3 đang hoạt động ở id khác, nhưng chỉ còn admin 2 là hoạt động duy nhất ngoài chính admin 1 bị khoá.
    const db = fakeDb([{ ...admin(1), is_active: 0 }, admin(2), staff(10)])
    const actor = { userId: 3, isAdmin: true } // người thao tác không nằm trong bảng (đã coi như admin hợp lệ)
    await expect(userService.toggleActive(2, actor, db)).rejects.toMatchObject({ statusCode: 409 })
    await expect(userService.softDeleteUser(2, actor, db)).rejects.toMatchObject({ statusCode: 409 })
    await expect(userService.updateUser(2, { role_id: 2 }, actor, db)).rejects.toMatchObject({ statusCode: 409 })
    await expect(userService.updateUser(2, { is_active: false }, actor, db)).rejects.toMatchObject({ statusCode: 409 })
    expect(db.users.find((u) => u.id === 2).is_active).toBe(1)
  })
  it('còn Quản trị viên khác hoạt động thì khoá / hạ vai trò / xoá được', async () => {
    const db = fakeDb([admin(1), admin(2), admin(3)])
    await expect(userService.toggleActive(2, actorAdmin, db)).resolves.toMatchObject({ is_active: 0 })
    await expect(userService.updateUser(3, { role_id: 2 }, actorAdmin, db)).resolves.toMatchObject({ role: { id: 2 } })
    // Giờ chỉ còn admin 1 hoạt động; admin 2 đã khoá nên xoá được.
    await expect(userService.softDeleteUser(2, actorAdmin, db)).resolves.toBeUndefined()
  })
})

describe('danh sách / chi tiết', () => {
  it('chi tiết trả role null cho tài khoản chưa có vai trò', async () => {
    const db = fakeDb([noRole(5)])
    expect(await userService.getUserById(5, db)).toMatchObject({ role: null, is_admin: false })
    expect(await userService.getUserById(404, db)).toBeNull()
  })
  it('lọc role_id=none dùng IS NULL, lọc số dùng tham số', async () => {
    const calls = []
    const db = { query: async (sql, params) => { calls.push({ sql, params }); return [[{ total: 0 }]] } }
    await userService.listUsers({ role_id: 'none' }, {}, db)
    expect(calls[0].sql).toContain('u.role_id IS NULL')
    calls.length = 0
    await userService.listUsers({ role_id: '2' }, {}, db)
    expect(calls[0].sql).toContain('u.role_id = ?')
    expect(calls[0].params).toEqual([2])
  })
})
