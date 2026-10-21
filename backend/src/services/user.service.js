const bcrypt = require('bcrypt')
const pool = require('../config/db')
const { ADMIN_ROLE_CODE } = require('../constants/permissions')

const SALT_ROUNDS = 10

const USER_SELECT = `SELECT u.id, u.email, u.is_active, u.role_id, u.created_at, u.updated_at, u.last_login_at,
        r.code AS role_code, r.name AS role_name
 FROM "user" u LEFT JOIN "role" r ON r.id = u.role_id`

function shapeUser(row) {
  if (!row) return null
  const { role_id, role_code, role_name, ...rest } = row
  return {
    ...rest,
    role: role_id == null ? null : { id: role_id, name: role_name, is_system: role_code != null },
    is_admin: role_code === ADMIN_ROLE_CODE,
  }
}

const fail = (statusCode, message) => ({ statusCode, message })

async function listUsers(filters = {}, pagination = {}, db = pool) {
  const { role_id, is_active, email } = filters
  const page = Math.max(1, parseInt(pagination.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 20))
  const offset = (page - 1) * limit

  const conditions = ['u.deleted_at IS NULL']
  const params = []

  if (role_id === 'none') {
    conditions.push('u.role_id IS NULL')
  } else if (role_id) {
    conditions.push('u.role_id = ?')
    params.push(Number(role_id))
  }
  if (is_active !== undefined && is_active !== null) {
    conditions.push('u.is_active = ?')
    params.push(is_active === 'true' || is_active === true ? 1 : 0)
  }
  if (email) {
    conditions.push('unaccent(u.email::text) ILIKE unaccent(?)')
    params.push(`%${email}%`)
  }

  const where = conditions.join(' AND ')
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM "user" u WHERE ${where}`, params)
  const [rows] = await db.query(`${USER_SELECT} WHERE ${where} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`, [
    ...params,
    limit,
    offset,
  ])
  return { rows: rows.map(shapeUser), total, page, limit }
}

async function getUserById(id, db = pool) {
  const [rows] = await db.query(`${USER_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL`, [id])
  return shapeUser(rows[0])
}

async function findRole(db, roleId) {
  const [rows] = await db.query('SELECT id, code FROM "role" WHERE id = ?', [roleId])
  if (!rows[0]) throw fail(400, 'Vai trò không tồn tại')
  return rows[0]
}

// Còn Quản trị viên nào khác (đang hoạt động, chưa xoá) ngoài tài khoản `exceptId`?
async function hasOtherActiveAdmin(db, exceptId) {
  const [rows] = await db.query(
    `SELECT 1 FROM "user" u JOIN "role" r ON r.id = u.role_id
     WHERE r.code = ? AND u.is_active = 1 AND u.deleted_at IS NULL AND u.id <> ? LIMIT 1`,
    [ADMIN_ROLE_CODE, exceptId]
  )
  return rows.length > 0
}

// Các chặn ở mục 1.5. `change`: { role_id?, is_active?, remove? } so với tài khoản `target`.
// `actor`: request.access của người thao tác ({ userId, isAdmin }).
async function assertCanChange(db, actor, target, change) {
  const isSelf = Number(actor.userId) === Number(target.id)

  if (change.remove && isSelf) throw fail(403, 'Không thể xóa tài khoản của chính mình')
  if (change.is_active === false && isSelf) throw fail(403, 'Không thể tự khóa tài khoản của chính mình')
  if (change.role_id !== undefined && isSelf && Number(change.role_id) !== Number(target.role?.id ?? 0)) {
    throw fail(403, 'Không tự đổi vai trò của mình')
  }

  if (target.is_admin && !actor.isAdmin) {
    throw fail(403, 'Chỉ Quản trị viên được sửa, khóa hoặc xóa tài khoản Quản trị viên')
  }

  let leavesAdmin = false
  if (change.role_id !== undefined) {
    const newRole = await findRole(db, change.role_id)
    const toAdmin = newRole.code === ADMIN_ROLE_CODE
    if ((toAdmin || target.is_admin) && toAdmin !== target.is_admin && !actor.isAdmin) {
      throw fail(403, 'Chỉ Quản trị viên được gán hoặc bỏ vai trò Quản trị viên')
    }
    leavesAdmin = target.is_admin && !toAdmin
  }
  const stopsBeingActive = target.is_active && (change.is_active === false || change.remove)
  if (target.is_admin && (leavesAdmin || stopsBeingActive)) {
    if (!(await hasOtherActiveAdmin(db, target.id))) {
      throw fail(409, 'Hệ thống phải còn ít nhất một Quản trị viên đang hoạt động')
    }
  }
}

async function loadTarget(db, id) {
  const target = await getUserById(id, db)
  if (!target) throw fail(404, 'Không tìm thấy user')
  return target
}

async function createUser(data, actor, db = pool) {
  const { email, password, role_id } = data
  const role = await findRole(db, role_id)
  if (role.code === ADMIN_ROLE_CODE && !actor.isAdmin) {
    throw fail(403, 'Chỉ Quản trị viên được gán hoặc bỏ vai trò Quản trị viên')
  }

  const [existing] = await db.query('SELECT id FROM "user" WHERE email = ? AND deleted_at IS NULL', [email])
  if (existing.length > 0) throw fail(400, 'Email đã tồn tại')

  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const [result] = await db.query(
    `INSERT INTO "user" (email, password_hash, role_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, NOW(), NOW())`,
    [email, hash, role.id]
  )
  return getUserById(result.insertId, db)
}

async function updateUser(id, data, actor, db = pool) {
  const target = await loadTarget(db, id)
  const fields = []
  const params = []

  for (const key of ['email', 'is_active']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`)
      params.push(data[key])
    }
  }
  if (data.role_id !== undefined) {
    const role = await findRole(db, data.role_id)
    fields.push('role_id = ?')
    params.push(role.id)
  }
  if (fields.length === 0) throw fail(400, 'Không có trường nào để cập nhật')

  await assertCanChange(db, actor, target, { role_id: data.role_id, is_active: data.is_active })

  if (data.email) {
    const [existing] = await db.query('SELECT id FROM "user" WHERE email = ? AND id != ? AND deleted_at IS NULL', [
      data.email,
      id,
    ])
    if (existing.length > 0) throw fail(400, 'Email đã tồn tại')
  }

  fields.push('updated_at = NOW()')
  await db.query(`UPDATE "user" SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, [...params, id])
  return getUserById(id, db)
}

async function softDeleteUser(id, actor, db = pool) {
  const target = await loadTarget(db, id)
  await assertCanChange(db, actor, target, { remove: true })
  await db.query('UPDATE "user" SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
}

async function toggleActive(id, actor, db = pool) {
  const target = await loadTarget(db, id)
  await assertCanChange(db, actor, target, { is_active: !target.is_active })
  await db.query('UPDATE "user" SET is_active = 1 - is_active, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
  return getUserById(id, db)
}

async function searchUsers(q, db = pool) {
  if (!q || typeof q !== 'string' || q.trim().length === 0) return []
  const term = `%${q.trim()}%`
  const [rows] = await db.query(
    `SELECT u.id, u.email FROM "user" u
     WHERE u.deleted_at IS NULL AND unaccent(u.email::text) ILIKE unaccent(?)
     ORDER BY u.email LIMIT 20`,
    [term]
  )
  return rows.map((r) => ({ id: r.id, email: r.email, display_name: r.email }))
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  softDeleteUser,
  toggleActive,
  searchUsers,
  assertCanChange,
}
