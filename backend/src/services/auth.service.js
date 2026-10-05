const pool = require('../config/db')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const emailService = require('./email.service')

const SALT_ROUNDS = 10

function generateOtp() {
  // Cryptographically secure OTP
  return String(crypto.randomInt(100000, 999999))
}

const authService = {
  async register({ email, password, role }) {
    const [existing] = await pool.query('SELECT id FROM `user` WHERE email = ?', [email])
    if (existing.length > 0) {
      throw { statusCode: 409, message: 'Email đã được sử dụng' }
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
    const [result] = await pool.query(
      'INSERT INTO `user` (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password_hash, role]
    )
    return { id: result.insertId, email, role }
  },

  async login({ email, password }) {
    const [rows] = await pool.query('SELECT * FROM `user` WHERE email = ? AND deleted_at IS NULL', [
      email,
    ])
    const user = rows[0]
    if (!user) throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' }
    if (!user.is_active) throw { statusCode: 403, message: 'Tài khoản đã bị khóa' }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' }

    await pool.query('UPDATE `user` SET last_login_at = NOW() WHERE id = ?', [user.id])

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      verification_status: user.verification_status,
      linked_entity_id: user.linked_entity_id || null,
      linked_entity_type: user.linked_entity_type || null,
    }
  },

  async registerSeafarer({ email, password }) {
    const [existing] = await pool.query('SELECT id FROM `user` WHERE email = ?', [email])
    if (existing.length > 0) throw { statusCode: 409, message: 'Email đã được sử dụng' }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
    const [result] = await pool.query(
      'INSERT INTO `user` (email, password_hash, role, verification_status) VALUES (?, ?, \'seafarer\', \'unverified\')',
      [email, password_hash]
    )
    return { id: result.insertId, email, role: 'seafarer', verification_status: 'unverified' }
  },

  async requestVerify(userId, email) {
    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 phút

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      // Xóa OTP cũ và insert mới trong cùng transaction
      await conn.query('DELETE FROM otp_verification WHERE user_id = ? AND used_at IS NULL', [
        userId,
      ])
      await conn.query(
        `INSERT INTO otp_verification (user_id, phone, otp_code_hash, purpose, expires_at, attempt_count)
         VALUES (?, '', ?, 'email_verify', ?, 0)`,
        [userId, otpHash, expiresAt]
      )
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    await emailService.sendOtp(email, otp)

    const masked = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    return { message: 'OTP đã gửi', email_masked: masked }
  },

  async confirmVerify(userId, otp) {
    const [rows] = await pool.query(
      `SELECT * FROM otp_verification
       WHERE user_id = ? AND used_at IS NULL AND purpose = 'email_verify'
       ORDER BY id DESC LIMIT 1`,
      [userId]
    )
    const record = rows[0]
    if (!record) throw { statusCode: 400, message: 'Không tìm thấy yêu cầu xác nhận' }
    if (new Date() > new Date(record.expires_at))
      throw { statusCode: 400, message: 'OTP đã hết hạn' }
    if (record.attempt_count >= 5)
      throw { statusCode: 400, message: 'Quá số lần thử, vui lòng yêu cầu OTP mới' }

    const valid = await bcrypt.compare(otp, record.otp_code_hash)
    if (!valid) {
      await pool.query(
        'UPDATE otp_verification SET attempt_count = attempt_count + 1 WHERE id = ?',
        [record.id]
      )
      throw { statusCode: 400, message: 'OTP không đúng' }
    }

    await pool.query('UPDATE otp_verification SET used_at = NOW() WHERE id = ?', [record.id])
    await pool.query('UPDATE `user` SET verification_status = \'verified\' WHERE id = ?', [userId])

    return { message: 'Xác nhận thành công' }
  },
}

module.exports = authService
