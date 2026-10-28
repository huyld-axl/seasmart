const crypto = require('crypto')
const bcrypt = require('bcrypt')
const pool = require('../config/db')
const { ADMIN_ROLE_CODE } = require('../constants/permissions')
const emailService = require('./email.service')

const SALT_ROUNDS = 10

const USER_SELECT = `SELECT u.id, u.email, u.full_name, u.is_active, u.activated_at, u.role_id, u.created_at, u.updated_at, u.last_login_at,
        r.code AS role_code, r.name AS role_name
 FROM "user" u LEFT JOIN "role" r ON r.id = u.role_id`

function shapeUser(row) {
  if (!row) return null
  const { role_id, role_code, role_name, ...rest } = row
  return {
    ...rest,
    status: !row.is_active ? 'LOCKED' : row.activated_at ? 'ACTIVE' : 'PENDING',
    role: role_id == null ? null : { id: role_id, name: role_name, is_system: role_code != null },
    is_admin: role_code === ADMIN_ROLE_CODE,
  }
}

const fail = (statusCode, message) => ({ statusCode, message })

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

// Mã đặt mật khẩu: bản gốc chỉ nằm trong thư, DB giữ bản băm.
async function issueInviteToken(db, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  await db.query('UPDATE "user" SET invite_token_hash = ?, updated_at = NOW() WHERE id = ?', [hashToken(token), userId])
  return token
}

async function sendInvite(user, token) {
  await emailService.sendInvite({
    to: user.email,
    fullName: user.full_name || user.email,
    roleName: user.role?.name || '',
    token,
  })
}

async function listUsers(filters = {}, pagination = {}, db = pool) {
  const { role_id, is_active, email, status } = filters
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
  if (status === 'pending') conditions.push('u.activated_at IS NULL AND u.is_active = 1')
  if (status === 'active') conditions.push('u.activated_at IS NOT NULL AND u.is_active = 1')
  if (status === 'locked') conditions.push('u.is_active = 0')
  if (email) {
    conditions.push('(unaccent(u.email::text) ILIKE unaccent(?) OR unaccent(COALESCE(u.full_name, \'\')) ILIKE unaccent(?))')
    params.push(`%${email}%`, `%${email}%`)
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
  const { email, full_name, role_id } = data
  const role = await findRole(db, role_id)
  if (role.code === ADMIN_ROLE_CODE && !actor.isAdmin) {
    throw fail(403, 'Chỉ Quản trị viên được gán hoặc bỏ vai trò Quản trị viên')
  }

  const [existing] = await db.query('SELECT id FROM "user" WHERE email = ? AND deleted_at IS NULL', [email])
  if (existing.length > 0) throw fail(400, 'Email đã tồn tại')

  const [result] = await db.query(
    `INSERT INTO "user" (email, full_name, password_hash, role_id, is_active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 1, NOW(), NOW())`,
    [email, full_name.trim(), role.id]
  )
  const token = await issueInviteToken(db, result.insertId)
  const user = await getUserById(result.insertId, db)
  await sendInvite(user, token)
  return user
}

async function resendInvite(id, db = pool) {
  const user = await loadTarget(db, id)
  if (user.status !== 'PENDING') throw fail(400, 'Tài khoản này đã kích hoạt')
  await sendInvite(user, await issueInviteToken(db, id))
  return user
}

async function findPendingByToken(db, token) {
  const [rows] = await db.query(
    'SELECT id, email, full_name FROM "user" WHERE invite_token_hash = ? AND activated_at IS NULL AND is_active = 1 AND deleted_at IS NULL',
    [hashToken(token)]
  )
  if (!rows[0]) throw fail(400, 'Liên kết không hợp lệ hoặc đã được dùng')
  return rows[0]
}

// Trang đặt mật khẩu hỏi mã này của ai để hiện email.
async function getInviteByToken(token, db = pool) {
  const { email, full_name } = await findPendingByToken(db, token)
  return { email, full_name }
}

// Người dùng đặt mật khẩu lần đầu qua liên kết trong thư mời.
async function setPasswordByToken({ token, password }, db = pool) {
  const user = await findPendingByToken(db, token)
  if (password.toLowerCase() === String(user.email).toLowerCase()) throw fail(400, 'Mật khẩu không được trùng email')
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  await db.query(
    'UPDATE "user" SET password_hash = ?, activated_at = NOW(), invite_token_hash = NULL, updated_at = NOW() WHERE id = ?',
    [hash, user.id]
  )
}

async function updateUser(id, data, actor, db = pool) {
  const target = await loadTarget(db, id)
  const fields = []
  const params = []

  for (const key of ['email', 'full_name', 'is_active']) {
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

module.exports = {
  listUsers,
  getUserById,
  createUser,
  resendInvite,
  setPasswordByToken,
  getInviteByToken,
  updateUser,
  softDeleteUser,
  toggleActive,
  assertCanChange,
}
