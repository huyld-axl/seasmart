// Đăng nhập khu nội bộ (docs/catoro-ke-hoach-khu-noi-bo.md 5.3, 5.4): một admin (CLOUD_ADMIN_EMAIL), mật khẩu băm scrypt (util.hashPassword),
// TOTP mã hoá AES-256-GCM, 8 mã khôi phục, chặn dò 5 lần sai / 15 phút. Mật khẩu chỉ đặt bằng scripts/admin.js trên server.
const crypto = require('crypto')
const pool = require('../db')
const config = require('../config')
const accounts = require('./accounts')
const totp = require('./totp')
const { hashPassword, checkPassword, shortCode, normalizeShortCode, sha256 } = require('../util')

const MIN_PASSWORD = 12
const MAX_FAILS = 5
const FAIL_WINDOW_MIN = 15
const RECOVERY_COUNT = 8
// Mọi lần sai ở khu nội bộ cộng chung (một admin, nằm sau Basic Auth).
const FAIL_ACTIONS = ['admin_login_fail', 'admin_2fa_fail']

const fail = (statusCode, message, error) => ({ statusCode, message, ...(error ? { error } : {}) })

function encrypt(secret) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', config.adminTotpKey, iv)
  const enc = Buffer.concat([cipher.update(secret), cipher.final()])
  return { enc, iv, tag: cipher.getAuthTag() }
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', config.adminTotpKey, row.totp_iv)
  decipher.setAuthTag(row.totp_tag)
  return Buffer.concat([decipher.update(row.totp_secret_enc), decipher.final()])
}

// Mã khôi phục dạng XXXX-XXXX (util.shortCode, không có chữ dễ nhầm); gõ có / không gạch, chữ thường đều được.
const hashRecovery = (code) => sha256(normalizeShortCode(code))

async function find(accountId, db = pool) {
  const { rows } = await db.query('SELECT * FROM admin_auth WHERE account_id = $1', [accountId])
  return rows[0] || null
}

// Admin hiện tại: tài khoản của CLOUD_ADMIN_EMAIL, không bị khoá, đã đặt mật khẩu.
async function current(db = pool) {
  if (!config.adminEmail) return null
  const account = await accounts.findByEmail(config.adminEmail, db)
  if (!account || account.disabled_at) return null
  const auth = await find(account.id, db)
  return auth ? { account, auth } : null
}

const adminAuth = {
  MIN_PASSWORD,
  RECOVERY_COUNT,
  current,
  find,

  // Chặn dò: đủ MAX_FAILS lần sai trong FAIL_WINDOW_MIN phút gần nhất.
  async locked(db = pool) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM audit WHERE action = ANY($1) AND created_at > NOW() - make_interval(mins => $2)`,
      [FAIL_ACTIONS, FAIL_WINDOW_MIN]
    )
    return rows[0].n >= MAX_FAILS
  },

  async recordFail(action, ip, accountId = null, detail = null) {
    await accounts.audit(accountId, action, ip, null, pool, detail)
  },

  // Bước 1: email + mật khẩu. Sai bất kỳ cái nào → null (cùng một câu báo ở trang).
  async checkLogin(email, password) {
    const admin = await current()
    const ok = admin && accounts.normalizeEmail(email) === config.adminEmail && checkPassword(String(password || ''), admin.auth.password_hash)
    return ok ? admin : null
  },

  // Lệnh trên server: đặt / đổi mật khẩu; tạo tài khoản nếu chưa có. Đá mọi phiên cũ (auth_version + 1).
  async setPassword(password) {
    if (!config.adminEmail) throw fail(400, 'Chưa đặt CLOUD_ADMIN_EMAIL trong cloud/.env')
    if (String(password || '').length < MIN_PASSWORD) throw fail(400, `Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự`)
    const account = await accounts.forLogin(config.adminEmail)
    const hash = hashPassword(String(password))
    await pool.query(
      `INSERT INTO admin_auth (account_id, password_hash) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, auth_version = admin_auth.auth_version + 1, updated_at = NOW()`,
      [account.id, hash]
    )
    await accounts.audit(account.id, 'admin_password_set', null, null, pool, 'Lệnh trên server')
    return account
  },

  // Lệnh trên server: tắt 2FA, xoá mã khôi phục; lần đăng nhập sau phải cài lại.
  async resetTotp() {
    const admin = await current()
    if (!admin) throw fail(400, `Chưa có admin ${config.adminEmail || ''} (chạy set-password trước)`.trim())
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE admin_auth SET totp_secret_enc = NULL, totp_iv = NULL, totp_tag = NULL, totp_confirmed_at = NULL, totp_last_step = -1,
         auth_version = auth_version + 1, updated_at = NOW() WHERE account_id = $1`,
        [admin.account.id]
      )
      await client.query('DELETE FROM admin_recovery_code WHERE account_id = $1', [admin.account.id])
      await accounts.audit(admin.account.id, 'admin_2fa_reset', null, null, client, 'Lệnh trên server')
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    return admin.account
  },

  enrolled: (auth) => Boolean(auth.totp_confirmed_at),

  // Cài lần đầu: bí mật chờ xác nhận (tải lại trang vẫn cùng QR). Đã cài rồi thì không cho cài đè.
  async pendingSecret(accountId) {
    const auth = await find(accountId)
    if (!auth || auth.totp_confirmed_at) return null
    if (auth.totp_secret_enc) return decrypt(auth)
    const secret = crypto.randomBytes(20)
    const { enc, iv, tag } = encrypt(secret)
    await pool.query('UPDATE admin_auth SET totp_secret_enc = $2, totp_iv = $3, totp_tag = $4, updated_at = NOW() WHERE account_id = $1 AND totp_confirmed_at IS NULL', [accountId, enc, iv, tag])
    return secret
  },

  // Nhập đúng mã đầu tiên → bật 2FA, trả 8 mã khôi phục (chỉ lần này). Sai → null.
  async confirmSetup(accountId, code, ip) {
    const secret = await adminAuth.pendingSecret(accountId)
    if (!secret) return null
    const step = totp.verify(secret, code)
    if (step === null) return null
    const codes = Array.from({ length: RECOVERY_COUNT }, shortCode)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rowCount } = await client.query('UPDATE admin_auth SET totp_confirmed_at = NOW(), totp_last_step = $2, updated_at = NOW() WHERE account_id = $1 AND totp_confirmed_at IS NULL', [accountId, step])
      if (!rowCount) {
        await client.query('ROLLBACK')
        return null
      }
      await client.query('DELETE FROM admin_recovery_code WHERE account_id = $1', [accountId])
      for (const c of codes) await client.query('INSERT INTO admin_recovery_code (account_id, code_hash) VALUES ($1, $2)', [accountId, hashRecovery(c)])
      await accounts.audit(accountId, 'admin_2fa_enroll', ip, null, client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    return codes
  },

  // Mã 6 số hằng ngày. Ghi bước vừa dùng có điều kiện (hai request cùng mã thì chỉ một cái qua).
  async verifyTotp(accountId, code) {
    const auth = await find(accountId)
    if (!auth?.totp_confirmed_at) return false
    const step = totp.verify(decrypt(auth), code, { afterStep: Number(auth.totp_last_step) })
    if (step === null) return false
    const { rowCount } = await pool.query('UPDATE admin_auth SET totp_last_step = $2 WHERE account_id = $1 AND totp_last_step < $2', [accountId, step])
    return rowCount === 1
  },

  // Mã khôi phục: dùng xong hết hiệu lực. → số mã còn lại, hoặc null nếu sai / đã dùng.
  async useRecovery(accountId, code) {
    if (normalizeShortCode(code).length !== 8) return null
    const { rowCount } = await pool.query('UPDATE admin_recovery_code SET used_at = NOW() WHERE account_id = $1 AND code_hash = $2 AND used_at IS NULL', [accountId, hashRecovery(code)])
    if (!rowCount) return null
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM admin_recovery_code WHERE account_id = $1 AND used_at IS NULL', [accountId])
    return rows[0].n
  },
}

module.exports = adminAuth
