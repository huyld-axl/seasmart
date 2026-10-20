const pool = require('../config/db')
const bcrypt = require('bcrypt')

const authService = {
  async login({ email, password }) {
    const [rows] = await pool.query('SELECT * FROM "user" WHERE email = ? AND deleted_at IS NULL', [
      email,
    ])
    const user = rows[0]
    if (!user) throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' }
    if (!user.is_active) throw { statusCode: 403, message: 'Tài khoản đã bị khóa' }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' }

    await pool.query('UPDATE "user" SET last_login_at = NOW() WHERE id = ?', [user.id])

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    }
  },
}

module.exports = authService
