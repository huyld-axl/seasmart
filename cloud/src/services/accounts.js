// Tài khoản: đăng ký (xác minh email), đăng nhập (chống dò), quên / đặt lại mật khẩu. Mật khẩu scrypt; mã trong thư
// chỉ lưu băm. Đặt lại mật khẩu thì huỷ mọi refresh token (mọi máy phải đăng nhập lại khi hết vé).
const pool = require('../db')
const mailer = require('./mailer')
const { randomToken, sha256, hashPassword, checkPassword, EMAIL } = require('../util')

const fail = (statusCode, message) => ({ statusCode, message })
const MIN_PASSWORD = 10
// Mật khẩu quá phổ biến (rút gọn; bản đầy đủ nạp từ tệp khi triển khai thật).
const COMMON = new Set(['1234567890', '0123456789', 'password123', 'matkhau123', 'qwertyuiop', '1111111111', 'abcdefghij', '12345678910', 'password1234', 'admin12345'])
const LOCK_WINDOW_MIN = 15
const MAX_FAIL_EMAIL = 5
const MAX_FAIL_IP = 30

function checkNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw fail(400, `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự`)
  if (password.length > 200) throw fail(400, 'Mật khẩu quá dài')
  if (COMMON.has(password.toLowerCase())) throw fail(400, 'Mật khẩu này quá phổ biến, chọn mật khẩu khác')
}

async function audit(accountId, action, ip, officeId = null, db = pool) {
  await db.query('INSERT INTO audit (account_id, office_id, action, ip) VALUES ($1, $2, $3, $4)', [accountId, officeId, action, ip || null])
}

async function issueEmailToken(accountId, kind, minutes, db = pool) {
  const token = randomToken()
  await db.query("INSERT INTO email_token (token_hash, account_id, kind, expires_at) VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)", [sha256(token), accountId, kind, String(minutes)])
  return token
}

async function useEmailToken(token, kind, db = pool) {
  const { rows } = await db.query(
    'UPDATE email_token SET used_at = NOW() WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > NOW() RETURNING account_id',
    [sha256(token || ''), kind]
  )
  return rows[0]?.account_id || null
}

const accounts = {
  checkNewPassword,
  audit,

  async findById(id, db = pool) {
    const { rows } = await db.query('SELECT * FROM account WHERE id = $1', [id])
    return rows[0] || null
  },

  async findByEmail(email, db = pool) {
    const { rows } = await db.query('SELECT * FROM account WHERE email = $1', [email])
    return rows[0] || null
  },

  // verifiedByInvite: đăng ký từ liên kết mời đúng email → coi như đã xác minh (thư mời đã tới hộp thư đó).
  async register({ email, fullName, password, verifiedByInvite = false, ip }, db = pool) {
    email = String(email || '').trim().toLowerCase()
    if (!EMAIL.test(email) || email.length > 200) throw fail(400, 'Email không hợp lệ')
    if (!fullName || !String(fullName).trim()) throw fail(400, 'Nhập họ tên')
    checkNewPassword(password)
    const existing = await accounts.findByEmail(email, db)
    if (existing?.email_verified_at || existing?.google_sub) throw fail(409, 'Email này đã có tài khoản. Đăng nhập, hoặc dùng Quên mật khẩu.')
    let account
    if (existing) {
      // Đăng ký lại khi chưa xác minh: thay mật khẩu, gửi lại thư (không lộ việc email đã từng đăng ký).
      const { rows } = await db.query('UPDATE account SET full_name = $2, password_hash = $3 WHERE id = $1 RETURNING *', [existing.id, String(fullName).trim(), hashPassword(password)])
      account = rows[0]
    } else {
      const { rows } = await db.query('INSERT INTO account (email, full_name, password_hash) VALUES ($1, $2, $3) RETURNING *', [email, String(fullName).trim(), hashPassword(password)])
      account = rows[0]
    }
    if (verifiedByInvite) {
      await db.query('UPDATE account SET email_verified_at = NOW() WHERE id = $1', [account.id])
      account.email_verified_at = new Date()
    } else {
      await mailer.verifyEmail(email, await issueEmailToken(account.id, 'verify', 24 * 60, db))
    }
    await audit(account.id, 'register', ip, null, db)
    return account
  },

  async resendVerify(email, db = pool) {
    const account = await accounts.findByEmail(String(email || '').trim().toLowerCase(), db)
    if (account && !account.email_verified_at) await mailer.verifyEmail(account.email, await issueEmailToken(account.id, 'verify', 24 * 60, db))
  },

  async verifyEmail(token, db = pool) {
    const accountId = await useEmailToken(token, 'verify', db)
    if (!accountId) throw fail(400, 'Liên kết xác minh không đúng hoặc đã hết hạn. Đăng ký lại để nhận thư mới.')
    await db.query('UPDATE account SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [accountId])
    return accountId
  },

  // Đúng thì trả tài khoản; sai thì ghi lần sai. Quá MAX lần trong 15 phút (theo email hoặc IP) thì chặn.
  async login({ email, password, ip }, db = pool) {
    email = String(email || '').trim().toLowerCase()
    const { rows: [counts] } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE email = $1) AS by_email, COUNT(*) FILTER (WHERE ip = $2) AS by_ip
       FROM login_failure WHERE created_at > NOW() - ($3 || ' minutes')::interval`,
      [email, ip || '', String(LOCK_WINDOW_MIN)]
    )
    if (Number(counts.by_email) >= MAX_FAIL_EMAIL || Number(counts.by_ip) >= MAX_FAIL_IP) {
      throw fail(429, `Sai quá nhiều lần. Thử lại sau ${LOCK_WINDOW_MIN} phút, hoặc dùng Quên mật khẩu.`)
    }
    const account = await accounts.findByEmail(email, db)
    if (!account || !checkPassword(password, account.password_hash)) {
      await db.query('INSERT INTO login_failure (email, ip) VALUES ($1, $2)', [email, ip || null])
      throw fail(401, 'Email hoặc mật khẩu không đúng')
    }
    if (account.disabled_at) throw fail(403, 'Tài khoản đã bị khoá')
    if (!account.email_verified_at) throw fail(403, 'Email chưa xác minh. Bấm liên kết trong thư xác minh rồi đăng nhập lại.')
    await db.query('DELETE FROM login_failure WHERE email = $1', [email])
    await audit(account.id, 'login', ip, null, db)
    return account
  },

  // Không lộ email có tài khoản hay không: luôn trả như nhau.
  async requestReset(email, db = pool) {
    const account = await accounts.findByEmail(String(email || '').trim().toLowerCase(), db)
    if (account && !account.disabled_at) await mailer.resetPassword(account.email, await issueEmailToken(account.id, 'reset', 30, db))
  },

  async resetPassword({ token, password, ip }, db = pool) {
    checkNewPassword(password)
    const accountId = await useEmailToken(token, 'reset', db)
    if (!accountId) throw fail(400, 'Liên kết đặt lại không đúng hoặc đã hết hạn. Gửi lại yêu cầu.')
    const { rows } = await db.query('UPDATE account SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1 RETURNING *', [accountId, hashPassword(password)])
    await db.query('UPDATE refresh_token SET revoked_at = NOW() WHERE account_id = $1 AND revoked_at IS NULL', [accountId])
    await db.query('DELETE FROM login_failure WHERE email = $1', [rows[0].email])
    await audit(accountId, 'password_reset', ip, null, db)
    await mailer.passwordChanged(rows[0].email)
    return rows[0]
  },
}

module.exports = accounts
