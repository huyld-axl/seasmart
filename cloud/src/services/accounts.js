// Tài khoản từ trên xuống, không mật khẩu (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md): Axalize tạo quản trị văn
// phòng, quản trị văn phòng tạo nhân viên; không có đăng ký. Đăng nhập bằng Google hoặc mã 6 số qua email
// (services/login_codes.js); lần đầu đăng nhập được coi là đã xác minh email.
const pool = require('../db')
const config = require('../config')
const { EMAIL } = require('../util')

const fail = (statusCode, message, error) => ({ statusCode, message, ...(error ? { error } : {}) })

async function audit(accountId, action, ip, officeId = null, db = pool, detail = null) {
  await db.query('INSERT INTO audit (account_id, office_id, action, ip, detail) VALUES ($1, $2, $3, $4, $5)', [accountId, officeId, action, ip || null, detail])
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const accounts = {
  audit,
  normalizeEmail,

  async findById(id, db = pool) {
    const { rows } = await db.query('SELECT * FROM account WHERE id = $1', [id])
    return rows[0] || null
  },

  async findByEmail(email, db = pool) {
    const { rows } = await db.query('SELECT * FROM account WHERE email = $1', [normalizeEmail(email)])
    return rows[0] || null
  },

  // Tài khoản để đăng nhập theo email. Ngoại lệ duy nhất của "không tự tạo tài khoản": email nội bộ Axalize
  // (CLOUD_ADMIN_EMAIL) tự có tài khoản ở lần đăng nhập đầu, vì không ai ở trên tạo cho họ.
  async forLogin(email, db = pool) {
    email = normalizeEmail(email)
    const account = await accounts.findByEmail(email, db)
    if (account || !config.adminEmail || email !== config.adminEmail) return account
    const { rows } = await db.query('INSERT INTO account (email, full_name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING *', [email, email.split('@')[0]])
    return rows[0] || accounts.findByEmail(email, db)
  },

  // Tạo tài khoản (hoặc dùng tài khoản có sẵn chưa thuộc văn phòng nào) và thêm vào văn phòng với vai trò role.
  // Gọi trong transaction của nơi gọi. Lỗi gắn field để trang quản trị báo dưới đúng ô.
  async addToOffice({ email, fullName, officeId, role, createdBy }, db) {
    email = normalizeEmail(email)
    fullName = String(fullName || '').trim()
    if (!EMAIL.test(email) || email.length > 200) throw { ...fail(400, 'Email không hợp lệ'), field: 'email' }
    if (!fullName || fullName.length > 200) throw { ...fail(400, 'Nhập họ tên'), field: 'full_name' }
    if (!['admin', 'member'].includes(role)) throw fail(400, 'Vai trò không hợp lệ')
    let account = await accounts.findByEmail(email, db)
    if (account) {
      const { rows } = await db.query('SELECT office_id FROM office_member WHERE account_id = $1 AND removed_at IS NULL', [account.id])
      if (rows[0] && rows[0].office_id !== officeId) throw { ...fail(409, 'Email này đã thuộc một văn phòng khác. Liên hệ Catoro.', 'member_elsewhere'), field: 'email' }
      if (rows[0]) throw { ...fail(409, 'Người này đã ở trong văn phòng', 'member_exists'), field: 'email' }
    } else {
      ;({ rows: [account] } = await db.query('INSERT INTO account (email, full_name, created_by) VALUES ($1, $2, $3) RETURNING *', [email, fullName, createdBy || null]))
    }
    await db.query(
      `INSERT INTO office_member (office_id, account_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (office_id, account_id) DO UPDATE SET role = EXCLUDED.role, removed_at = NULL, joined_at = NOW()`,
      [officeId, account.id, role]
    )
    return account
  },

  // Đăng nhập xong (Google hoặc mã email): email đã được chứng minh, ghi lần đăng nhập.
  async recordLogin(account, method, ip, db = pool) {
    await db.query('UPDATE account SET last_login_at = NOW(), last_login_method = $2, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [account.id, method])
    await audit(account.id, method === 'google' ? 'login_google' : 'login_email_code', ip, null, db)
  },

  // Axalize khoá / mở khoá một tài khoản. Khoá: huỷ mọi phiên (máy đang mở bị đưa ra ở lần làm mới, tối đa 1 giờ).
  async setDisabled(accountId, disabled, db = pool) {
    await db.query(`UPDATE account SET disabled_at = ${disabled ? 'COALESCE(disabled_at, NOW())' : 'NULL'} WHERE id = $1`, [accountId])
    if (disabled) await db.query('UPDATE refresh_token SET revoked_at = NOW() WHERE account_id = $1 AND revoked_at IS NULL', [accountId])
  },
}

module.exports = accounts
