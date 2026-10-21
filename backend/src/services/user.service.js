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
    conditions.push('unaccent(email::text) ILIKE unaccent(?)')
    params.push(`%${email}%`)
  }

  const where = conditions.join(' AND ')

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM "user" WHERE ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, email, role, is_active, verification_status, created_at, updated_at
     FROM "user" WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return { rows, total, page, limit }
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, email, role, is_active, verification_status, created_at, updated_at
     FROM "user" WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
  return rows[0] || null
}

async function createUser(data) {
  const { email, password, role } = data

  const [existing] = await pool.query(
    'SELECT id FROM "user" WHERE email = ? AND deleted_at IS NULL',
    [email]
  )
  if (existing.length > 0) {
    const err = new Error('Email đã tồn tại')
    err.statusCode = 400
    throw err
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const [result] = await pool.query(
    `INSERT INTO "user" (email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, NOW(), NOW())`,
    [email, hash, role]
  )

  return getUserById(result.insertId)
}

async function updateUser(id, data) {
  const allowed = ['email', 'role', 'is_active']
  const fields = []
  const params = []

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`)
      params.push(data[key])
    }
  }

  if (fields.length === 0) {
    const err = new Error('Không có trường nào để cập nhật')
    err.statusCode = 400
    throw err
  }

  if (data.email) {
    const [existing] = await pool.query(
      'SELECT id FROM "user" WHERE email = ? AND id != ? AND deleted_at IS NULL',
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
    `UPDATE "user" SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params
  )

  return getUserById(id)
}

async function softDeleteUser(id) {
  await pool.query('UPDATE "user" SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
}

async function toggleActive(id) {
  await pool.query(
    `UPDATE "user" SET is_active = 1 - is_active, updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
  return getUserById(id)
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  softDeleteUser,
  toggleActive,
}
