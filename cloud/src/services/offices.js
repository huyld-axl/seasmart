// Văn phòng: tạo (kèm khoá máy chính), thành viên, lời mời, bỏ thành viên, khoá văn phòng.
// Mỗi tài khoản thuộc tối đa một văn phòng đang hoạt động (chỉ mục office_member_one_office).
const crypto = require('crypto')
const pool = require('../db')
const mailer = require('./mailer')
const { audit } = require('./accounts')
const { randomToken, sha256, EMAIL } = require('../util')

const fail = (statusCode, message) => ({ statusCode, message })
const INVITE_DAYS = 14

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

  // Tạo văn phòng + đăng ký khoá máy chính; người tạo là quản trị. Gọi lại với cùng khoá (thử lại sau lỗi mạng)
  // trả văn phòng đã tạo, không tạo văn phòng thứ hai.
  async create({ accountId, name, machinePublicKey, ip }) {
    const publicKey = checkPublicKey(machinePublicKey)
    name = String(name || '').trim()
    if (!name || name.length > 200) throw fail(400, 'Nhập tên văn phòng')
    return withTx(async (db) => {
      const current = await offices.membership(accountId, db)
      if (current) {
        const key = await offices.machineKey(current.office_id, db)
        if (key === publicKey) return offices.get(current.office_id, db)
        throw fail(409, 'Tài khoản này đã thuộc một văn phòng')
      }
      const { rows: [office] } = await db.query('INSERT INTO office (name, created_by) VALUES ($1, $2) RETURNING *', [name, accountId])
      await db.query('INSERT INTO office_machine (office_id, public_key) VALUES ($1, $2)', [office.id, publicKey])
      await db.query("INSERT INTO office_member (office_id, account_id, role) VALUES ($1, $2, 'admin')", [office.id, accountId])
      await audit(accountId, 'office_create', ip, office.id, db)
      return office
    })
  },

  // Chuyển văn phòng sang máy chính mới (docs/mcah-ke-hoach-desktop-gd4.md 3.4): thu hồi khoá máy cũ, đăng ký khoá mới,
  // xoá dấu vân tay cũ (máy mới báo lại). Chỉ quản trị; nơi gọi đã kiểm vé vừa đăng nhập lại.
  async replaceMachine({ officeId, accountId, machinePublicKey, ip }) {
    const publicKey = checkPublicKey(machinePublicKey)
    const done = await withTx(async (db) => {
      const member = await offices.membership(accountId, db)
      if (!member || member.office_id !== officeId || member.role !== 'admin') throw fail(403, 'Chỉ quản trị của văn phòng được chuyển máy chính')
      if ((await offices.machineKey(officeId, db)) === publicKey) return false
      await db.query('UPDATE office_machine SET revoked_at = NOW() WHERE office_id = $1 AND revoked_at IS NULL', [officeId])
      await db.query('INSERT INTO office_machine (office_id, public_key) VALUES ($1, $2)', [officeId, publicKey])
      await audit(accountId, 'office_machine_replace', ip, officeId, db)
      return true
    })
    if (done) {
      const office = await offices.get(officeId)
      const { rows } = await pool.query("SELECT a.email FROM office_member m JOIN account a ON a.id = m.account_id WHERE m.office_id = $1 AND m.role = 'admin' AND m.removed_at IS NULL", [officeId])
      const mailer = require('./mailer')
      for (const { email } of rows) {
        await mailer.send({ to: email, subject: `MCAH: ${office.name} đã chuyển sang máy chính mới`, text: `Văn phòng ${office.name} vừa được chuyển sang một máy chính mới lúc ${new Date().toLocaleString('vi-VN')}. Máy chính cũ ngừng phục vụ.

Không phải bạn hoặc người trong văn phòng làm việc này thì liên hệ MCAH ngay.` }).catch(() => {})
      }
    }
    return { replaced: done }
  },

  // Khoá máy này đã bị thay (văn phòng chuyển sang máy khác)?
  async machineReplaced(officeId, publicKey, db = pool) {
    const { rows } = await db.query('SELECT revoked_at FROM office_machine WHERE office_id = $1 AND public_key = $2 ORDER BY registered_at DESC LIMIT 1', [officeId, publicKey])
    return Boolean(rows[0]?.revoked_at)
  },

  async invite({ officeId, email, fullName, role = 'member', invitedBy }) {
    email = String(email || '').trim().toLowerCase()
    if (!EMAIL.test(email)) throw fail(400, 'Email không hợp lệ')
    if (!['admin', 'member'].includes(role)) throw fail(400, 'Vai trò không hợp lệ')
    const office = await offices.get(officeId)
    const { rows: members } = await pool.query(
      'SELECT 1 FROM office_member m JOIN account a ON a.id = m.account_id WHERE m.office_id = $1 AND a.email = $2 AND m.removed_at IS NULL',
      [officeId, email]
    )
    if (members.length) throw fail(409, 'Người này đã ở trong văn phòng')
    const token = randomToken()
    // Lời mời cũ chưa dùng cho cùng email thì huỷ, chỉ giữ thư mới nhất.
    await pool.query('UPDATE invite SET revoked_at = NOW() WHERE office_id = $1 AND email = $2 AND accepted_at IS NULL AND revoked_at IS NULL', [officeId, email])
    const { rows: [invite] } = await pool.query(
      `INSERT INTO invite (token_hash, office_id, email, full_name, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' days')::interval) RETURNING id, email, role, expires_at`,
      [sha256(token), officeId, email, fullName || null, role, invitedBy || null, String(INVITE_DAYS)]
    )
    const inviter = invitedBy ? (await pool.query('SELECT full_name, email FROM account WHERE id = $1', [invitedBy])).rows[0] : null
    await mailer.invite(email, { inviterName: inviter?.full_name || inviter?.email || office.name, officeName: office.name, token })
    await audit(invitedBy, 'invite', null, officeId)
    return invite
  },

  async revokeInvite({ officeId, email }) {
    await pool.query('UPDATE invite SET revoked_at = NOW() WHERE office_id = $1 AND email = $2 AND accepted_at IS NULL AND revoked_at IS NULL', [officeId, String(email).toLowerCase()])
  },

  // Lời mời còn hiệu lực theo mã trong liên kết, kèm tên văn phòng; null nếu sai / hết hạn / đã dùng / đã huỷ.
  async findInvite(token, db = pool) {
    const { rows } = await db.query(
      `SELECT i.*, o.name AS office_name FROM invite i JOIN office o ON o.id = i.office_id
       WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW() AND o.locked_at IS NULL`,
      [sha256(token || '')]
    )
    return rows[0] || null
  },

  // Nhận lời mời: email tài khoản phải trùng email được mời; tài khoản đã thuộc văn phòng khác thì từ chối.
  async acceptInvite(token, account, ip) {
    return withTx(async (db) => {
      const invite = await offices.findInvite(token, db)
      if (!invite) throw fail(400, 'Lời mời không đúng, đã hết hạn hoặc đã bị huỷ')
      if (invite.email.toLowerCase() !== account.email.toLowerCase()) throw fail(403, `Lời mời này dành cho ${invite.email}. Đăng nhập bằng email đó.`)
      const current = await offices.membership(account.id, db)
      if (current && current.office_id !== invite.office_id) throw fail(409, 'Tài khoản này đã thuộc một văn phòng khác')
      if (!current) {
        await db.query(
          `INSERT INTO office_member (office_id, account_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (office_id, account_id) DO UPDATE SET role = EXCLUDED.role, removed_at = NULL, joined_at = NOW()`,
          [invite.office_id, account.id, invite.role]
        )
      }
      await db.query('UPDATE invite SET accepted_at = NOW() WHERE id = $1', [invite.id])
      await audit(account.id, 'invite_accept', ip, invite.office_id, db)
      return invite
    })
  },

  // Bỏ thành viên (tắt người dùng ở máy chính): lần làm mới vé sau, vé không còn văn phòng → máy chính từ chối.
  async removeMember({ officeId, email, by }) {
    const { rows } = await pool.query(
      `UPDATE office_member m SET removed_at = NOW() FROM account a
       WHERE m.account_id = a.id AND m.office_id = $1 AND a.email = $2 AND m.removed_at IS NULL RETURNING m.account_id`,
      [officeId, String(email).toLowerCase()]
    )
    await offices.revokeInvite({ officeId, email })
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
