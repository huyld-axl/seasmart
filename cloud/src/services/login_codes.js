// Mã đăng nhập 6 số gửi qua email (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md 3.1), thay cho mật khẩu.
// Hạn 10 phút, sai 5 lần thì hết hiệu lực; gửi lại sau 60 giây, tối đa 5 thư / email / giờ và 20 / IP / giờ.
// Email chưa có tài khoản hoặc bị khoá: không gửi thư nhưng trả như thường (không cho dò email nào có tài khoản).
const crypto = require('crypto')
const pool = require('../db')
const mailer = require('./mailer')
const accounts = require('./accounts')
const { sha256, EMAIL } = require('../util')

const fail = (statusCode, message, error) => ({ statusCode, message, error })
const TTL_MIN = 10
const MAX_ATTEMPTS = 5
const RESEND_SEC = 60
const MAX_PER_EMAIL_HOUR = 5
const MAX_PER_IP_HOUR = 20

// Băm có muối theo email: cùng mã 6 số ở hai email khác nhau cho hai băm khác nhau.
const hashCode = (email, code) => sha256(`${email}:${code}`)

const loginCodes = {
  TTL_MIN,
  RESEND_SEC,

  // Giây còn phải chờ trước khi gửi lại được (0 = gửi được).
  async waitSeconds(email, db = pool) {
    const { rows } = await db.query('SELECT EXTRACT(EPOCH FROM NOW() - MAX(created_at)) AS age FROM login_code WHERE email = $1', [email])
    const age = rows[0].age === null ? Infinity : Number(rows[0].age)
    return Math.max(0, Math.ceil(RESEND_SEC - age))
  },

  async send({ email, ip }, db = pool) {
    email = accounts.normalizeEmail(email)
    if (!EMAIL.test(email) || email.length > 200) throw fail(400, 'Nhập email hợp lệ', 'email_invalid')
    const wait = await loginCodes.waitSeconds(email, db)
    if (wait > 0) throw fail(429, `Vừa gửi mã. Thử gửi lại sau ${wait} giây.`, 'resend_wait')
    const { rows: [counts] } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE email = $1)::int AS by_email, COUNT(*) FILTER (WHERE ip = $2)::int AS by_ip
       FROM login_code WHERE created_at > NOW() - INTERVAL '1 hour'`,
      [email, ip || '']
    )
    if (counts.by_email >= MAX_PER_EMAIL_HOUR || counts.by_ip >= MAX_PER_IP_HOUR) throw fail(429, 'Đã gửi quá nhiều mã. Thử lại sau 1 giờ.', 'send_limited')
    const account = await accounts.forLogin(email, db)
    const usable = account && !account.disabled_at
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0')
    await db.query('UPDATE login_code SET revoked_at = NOW() WHERE email = $1 AND used_at IS NULL AND revoked_at IS NULL', [email])
    await db.query(
      `INSERT INTO login_code (email, account_id, code_hash, ip, expires_at) VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)`,
      [email, usable ? account.id : null, hashCode(email, code), ip || null, String(TTL_MIN)]
    )
    if (usable) await mailer.loginCode(email, code)
  },

  // Mã đúng → tài khoản. Tài khoản bị khoá sau khi gửi mã: báo khoá.
  async verify({ email, code }, db = pool) {
    email = accounts.normalizeEmail(email)
    code = String(code || '').replace(/\D/g, '')
    const { rows: [row] } = await db.query(
      'SELECT * FROM login_code WHERE email = $1 AND used_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [email]
    )
    if (!row || row.expires_at < new Date() || row.attempts >= MAX_ATTEMPTS) throw fail(400, 'Mã đã hết hiệu lực. Bấm Gửi lại mã.', 'code_expired')
    if (!row.account_id || code.length !== 6 || hashCode(email, code) !== row.code_hash) {
      const { rows: [next] } = await db.query('UPDATE login_code SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts', [row.id])
      if (next.attempts >= MAX_ATTEMPTS) throw fail(400, 'Sai quá nhiều lần, mã đã hết hiệu lực. Bấm Gửi lại mã.', 'code_expired')
      throw fail(400, 'Mã không đúng', 'code_invalid')
    }
    await db.query('UPDATE login_code SET used_at = NOW() WHERE id = $1', [row.id])
    const account = await accounts.findById(row.account_id, db)
    if (!account || account.disabled_at) throw fail(403, 'Tài khoản này đã bị khoá. Liên hệ quản trị.', 'account_disabled')
    return account
  },
}

module.exports = loginCodes
