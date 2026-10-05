const bcrypt = require('bcrypt')
const pool = require('../config/db')

const SALT_ROUNDS = 10

async function listUsers(filters = {}, pagination = {}) {
  const { role, is_active, email } = filters
  const page = Math.max(1, parseInt(pagination.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 20))
  const offset = (page - 1) * limit

  const conditions = ['deleted_at IS NULL']
  const params = []

  if (role) {
    conditions.push('role = ?')
    params.push(role)
  }
  if (is_active !== undefined && is_active !== null) {
    conditions.push('is_active = ?')
    params.push(is_active === 'true' || is_active === true ? 1 : 0)
  }
  if (email) {
    conditions.push('email LIKE ?')
    params.push(`%${email}%`)
  }

  const where = conditions.join(' AND ')

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM \`user\` WHERE ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, email, role, is_active, verification_status, created_at, updated_at
     FROM \`user\` WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return { rows, total, page, limit }
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, email, role, is_active, verification_status, created_at, updated_at
     FROM \`user\` WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
  return rows[0] || null
}

async function verifyUserPassword(id, plainPassword) {
  const [rows] = await pool.query(
    `SELECT password_hash
     FROM \`user\`
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  )
  const record = rows[0]
  if (!record) return false
  return bcrypt.compare(plainPassword, record.password_hash)
}

async function createUser(data) {
  const { email, password, role } = data

  const [existing] = await pool.query(
    'SELECT id FROM `user` WHERE email = ? AND deleted_at IS NULL',
    [email]
  )
  if (existing.length > 0) {
    const err = new Error('Email đã tồn tại')
    err.statusCode = 400
    throw err
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const [result] = await pool.query(
    `INSERT INTO \`user\` (email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, NOW(), NOW())`,
    [email, hash, role]
  )

  return getUserById(result.insertId)
}

async function updateUser(id, data) {
  const allowed = ['email', 'role', 'is_active', 'password']
  const fields = []
  const params = []

  for (const key of allowed) {
    if (data[key] === undefined) continue
    if (key === 'password') {
      const hash = await bcrypt.hash(data.password, SALT_ROUNDS)
      fields.push('password_hash = ?')
      params.push(hash)
      continue
    }

    fields.push(`${key} = ?`)
    params.push(data[key])
  }

  if (fields.length === 0) {
    const err = new Error('Không có trường nào để cập nhật')
    err.statusCode = 400
    throw err
  }

  if (data.email) {
    const [existing] = await pool.query(
      'SELECT id FROM `user` WHERE email = ? AND id != ? AND deleted_at IS NULL',
      [data.email, id]
    )
    if (existing.length > 0) {
      const err = new Error('Email đã tồn tại')
      err.statusCode = 400
      throw err
    }
  }

  fields.push('updated_at = NOW()')
  params.push(id)

  await pool.query(
    `UPDATE \`user\` SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params
  )

  return getUserById(id)
}

async function softDeleteUser(id) {
  await pool.query('UPDATE `user` SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
}

async function toggleActive(id) {
  await pool.query(
    `UPDATE \`user\` SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
  return getUserById(id)
}

async function searchUsers(q) {
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return []
  }
  const term = `%${q.trim()}%`
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.role,
            COALESCE(s.full_name, u.email) AS display_name
     FROM \`user\` u
     LEFT JOIN seafarer s ON u.linked_entity_type = 'seafarer' AND u.linked_entity_id = s.id AND s.deleted_at IS NULL
     WHERE u.deleted_at IS NULL
       AND (u.email LIKE ? OR s.full_name LIKE ?)
     ORDER BY u.email
     LIMIT 20`,
    [term, term]
  )
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    display_name: r.display_name || r.email,
    role: r.role,
  }))
}

module.exports = {
  listUsers,
  getUserById,
  verifyUserPassword,
  createUser,
  updateUser,
  softDeleteUser,
  toggleActive,
  searchUsers,
}
