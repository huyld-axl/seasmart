// Văn phòng: Axalize tạo (kèm quản trị, chưa có máy chính), máy chính đầu tiên / chuyển máy chính, thành viên do quản trị
// văn phòng tạo, bỏ thành viên, khoá văn phòng (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md 3.2–3.5).
// Mỗi tài khoản thuộc tối đa một văn phòng đang hoạt động (chỉ mục office_member_one_office).
const crypto = require('crypto')
const pool = require('../db')
const accounts = require('./accounts')

const { audit } = accounts

const fail = (statusCode, message) => ({ statusCode, message })

// Khoá công khai Ed25519 dạng PEM (SPKI); trả PEM đã chuẩn hoá hoặc lỗi.
function checkPublicKey(pem) {
  try {
    const key = crypto.createPublicKey(String(pem))
    if (key.asymmetricKeyType !== 'ed25519') throw new Error()
    return key.export({ type: 'spki', format: 'pem' })
  } catch {
    throw fail(400, 'Khoá máy chính không hợp lệ')
  }
}

async function withTx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const offices = {
  checkPublicKey,

  async get(id, db = pool) {
    const { rows } = await db.query('SELECT * FROM office WHERE id = $1', [id])
    return rows[0] || null
  },

  async machineKey(officeId, db = pool) {
    const { rows } = await db.query('SELECT public_key FROM office_machine WHERE office_id = $1 AND revoked_at IS NULL', [officeId])
    return rows[0]?.public_key || null
  },

  async setMachineLan({ officeId, fingerprint, name, port }, db = pool) {
    await db.query(
      'UPDATE office_machine SET cert_fingerprint = $2, lan_name = $3, lan_port = $4, lan_updated_at = NOW() WHERE office_id = $1 AND revoked_at IS NULL',
      [officeId, fingerprint, name, port]
    )
  },

  async membership(accountId, db = pool) {
    const { rows } = await db.query('SELECT * FROM office_member WHERE account_id = $1 AND removed_at IS NULL', [accountId])
    return rows[0] || null
  },

  // Axalize tạo khách hàng: văn phòng (chưa có máy chính) + tài khoản quản trị văn phòng.
  async createCustomer({ name, note, adminEmail, adminName, createdBy, ip }) {
    name = String(name || '').trim()
    note = String(note || '').trim()
    if (!name || name.length > 200) throw { ...fail(400, 'Nhập tên văn phòng'), field: 'name' }
    if (note.length > 500) throw { ...fail(400, 'Ghi chú quá dài'), field: 'note' }
    return withTx(async (db) => {
      const { rows: [office] } = await db.query('INSERT INTO office (name, note, created_by) VALUES ($1, $2, $3) RETURNING *', [name, note || null, createdBy])
      const admin = await accounts.addToOffice({ email: adminEmail, fullName: adminName, officeId: office.id, role: 'admin', createdBy }, db)
      await audit(createdBy, 'customer_create', ip, office.id, db, `Quản trị ${admin.email}`)
      return { office, admin }
    })
  },

  // Thêm tài khoản vào văn phòng: Axalize thêm quản trị (by = admin Axalize), hoặc quản trị văn phòng tạo nhân viên.
  async addMember({ officeId, email, fullName, role, createdBy, action, ip }) {
    return withTx(async (db) => {
      const account = await accounts.addToOffice({ email, fullName, officeId, role, createdBy }, db)
      await audit(createdBy, action, ip, officeId, db, `${account.email} · ${role === 'admin' ? 'Quản trị' : 'Nhân viên'}`)
      return account
    })
  },

  // Chuyển văn phòng sang máy chính mới (docs/catoro-ke-hoach-desktop-gd4.md 3.4): thu hồi khoá máy cũ, đăng ký khoá mới,
  // xoá dấu vân tay cũ (máy mới báo lại). Chỉ quản trị; nơi gọi đã kiểm vé vừa đăng nhập lại.
  async replaceMachine({ officeId, accountId, machinePublicKey, ip }) {
    const publicKey = checkPublicKey(machinePublicKey)
    const done = await withTx(async (db) => {
      const member = await offices.membership(accountId, db)
      if (!member || member.office_id !== officeId || member.role !== 'admin') throw fail(403, 'Chỉ quản trị của văn phòng được chuyển máy chính')
      const current = await offices.machineKey(officeId, db)
      if (current === publicKey) return false
      await db.query('UPDATE office_machine SET revoked_at = NOW() WHERE office_id = $1 AND revoked_at IS NULL', [officeId])
      await db.query('INSERT INTO office_machine (office_id, public_key) VALUES ($1, $2)', [officeId, publicKey])
      // Máy chính đầu tiên (văn phòng Axalize vừa tạo) không tính là chuyển máy, không báo thư.
      await audit(accountId, current ? 'office_machine_replace' : 'office_machine_setup', ip, officeId, db)
      return Boolean(current)
    })
    if (done) {
      const office = await offices.get(officeId)
      const { rows } = await pool.query("SELECT a.email FROM office_member m JOIN account a ON a.id = m.account_id WHERE m.office_id = $1 AND m.role = 'admin' AND m.removed_at IS NULL", [officeId])
      const mailer = require('./mailer')
      for (const { email } of rows) {
        await mailer.send({ to: email, subject: `Catoro: ${office.name} đã chuyển sang máy chính mới`, text: `Văn phòng ${office.name} vừa được chuyển sang một máy chính mới lúc ${new Date().toLocaleString('vi-VN')}. Máy chính cũ ngừng phục vụ.

Không phải bạn hoặc người trong văn phòng làm việc này thì liên hệ Catoro ngay.` }).catch(() => {})
      }
    }
    return { replaced: done }
  },

  // Khoá máy này đã bị thay (văn phòng chuyển sang máy khác)?
  async machineReplaced(officeId, publicKey, db = pool) {
    const { rows } = await db.query('SELECT revoked_at FROM office_machine WHERE office_id = $1 AND public_key = $2 ORDER BY registered_at DESC LIMIT 1', [officeId, publicKey])
    return Boolean(rows[0]?.revoked_at)
  },

  // Bỏ thành viên (tắt người dùng ở máy chính): lần làm mới vé sau, vé không còn văn phòng → máy chính từ chối.
  async removeMember({ officeId, email, by }) {
    const { rows } = await pool.query(
      `UPDATE office_member m SET removed_at = NOW() FROM account a
       WHERE m.account_id = a.id AND m.office_id = $1 AND a.email = $2 AND m.removed_at IS NULL RETURNING m.account_id`,
      [officeId, String(email).toLowerCase()]
    )
    if (rows[0]) await audit(by || null, 'member_remove', null, officeId)
    return { removed: rows.length > 0 }
  },

  // Thêm lại người đã bị bỏ (bật lại người dùng ở máy chính).
  async restoreMember({ officeId, email }) {
    const { rows } = await pool.query(
      `UPDATE office_member m SET removed_at = NULL FROM account a
       WHERE m.account_id = a.id AND m.office_id = $1 AND a.email = $2 AND m.removed_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM office_member x WHERE x.account_id = a.id AND x.removed_at IS NULL)
       RETURNING m.account_id`,
      [officeId, String(email).toLowerCase()]
    )
    return { restored: rows.length > 0 }
  },

  async setLocked(officeId, locked) {
    await pool.query(`UPDATE office SET locked_at = ${locked ? 'NOW()' : 'NULL'} WHERE id = $1`, [officeId])
  },
}

module.exports = offices
