// Đăng nhập của app máy tính (docs/mcah-ke-hoach-desktop-gd2.md 4.2). Chỉ đăng ký khi có DESKTOP_TICKET_PUBLIC_KEY.
// Vé do máy chủ dịch vụ ký Ed25519 (kid = 16 ký tự đầu SHA-256 của khoá công khai PEM); máy chính kiểm không cần mạng.
// JWT cấp ra mang offline_until = exp của vé; authenticate từ chối khi đã qua mốc này (plugins/index.js).
const crypto = require('crypto')
const pool = require('../../config/db')
const { loadAccess, toClientUser } = require('../../plugins/access')

const AUDIENCE = 'mcah-office'
const fail = (statusCode, message, code) => ({ statusCode, message, ...(code ? { code } : {}) })

const keyId = (pem) => crypto.createHash('sha256').update(pem).digest('hex').slice(0, 16)
// Dấu của khoá máy chính trong vé: 32 ký tự đầu SHA-256 của khoá công khai PEM (SPKI) đã chuẩn hoá.
const normalizePem = (pem) => crypto.createPublicKey(String(pem)).export({ type: 'spki', format: 'pem' })
const machineId = (pem) => crypto.createHash('sha256').update(normalizePem(pem)).digest('hex').slice(0, 32)

// publicKeysPem: một hoặc nhiều khoá (nối PEM) để đổi khoá ký mà không hỏng vé đang dùng.
function verifyTicket(ticket, keys) {
  const parts = String(ticket || '').split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const head = JSON.parse(Buffer.from(header, 'base64url'))
  if (head.alg !== 'EdDSA') return null
  const key = keys.find((k) => k.kid === head.kid) || (keys.length === 1 && !head.kid ? keys[0] : null)
  if (!key || !crypto.verify(null, Buffer.from(`${header}.${payload}`), key.publicKey, Buffer.from(signature, 'base64url'))) return null
  const claims = JSON.parse(Buffer.from(payload, 'base64url'))
  if (claims.aud !== AUDIENCE || !claims.sub || !claims.email || claims.exp <= Math.floor(Date.now() / 1000)) return null
  return claims
}

async function officeInfo(db = pool) {
  const [rows] = await db.query('SELECT * FROM office_info WHERE id = 1')
  return rows[0] || null
}

async function desktopTicketRoutes(fastify, { publicKeyPem }) {
  const keys = String(publicKeyPem).match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g).map((pem) => {
    const clean = normalizePem(pem)
    return { kid: keyId(clean), publicKey: crypto.createPublicKey(clean) }
  })

  const readTicket = (raw) => {
    let claims = null
    try {
      claims = verifyTicket(raw, keys)
    } catch {}
    if (!claims) throw fail(401, 'Vé đăng nhập không hợp lệ hoặc đã hết hạn', 'TICKET_INVALID')
    return claims
  }

  async function session(user, claims) {
    await pool.query('UPDATE "user" SET last_login_at = NOW() WHERE id = ?', [user.id])
    const access = await loadAccess(user.id)
    const secondsLeft = claims.exp - Math.floor(Date.now() / 1000)
    const token = fastify.jwt.sign({ id: user.id, email: user.email, offline_until: claims.exp }, { expiresIn: secondsLeft })
    return { user: toClientUser(access), token, offline_until: new Date(claims.exp * 1000).toISOString() }
  }

  const ticketBody = { type: 'object', required: ['ticket'], properties: { ticket: { type: 'string', maxLength: 8192 } } }
  const limit = { rateLimit: { max: 20, timeWindow: '1 minute' } }

  // Đăng nhập bằng vé. Máy chưa có văn phòng → { needs_office } (app hiện màn Lần đầu, wireframe 3).
  fastify.post('/desktop-ticket', { config: limit, schema: { body: ticketBody } }, async (request) => {
    const claims = readTicket(request.body.ticket)
    const office = await officeInfo()
    if (!office) return { needs_office: true, account: { email: claims.email, name: claims.name, office: claims.office, office_name: claims.office_name } }
    if (claims.office !== office.office_id || claims.machine !== machineId(office.machine_public_key)) {
      throw fail(403, claims.office ? 'Tài khoản thuộc văn phòng khác, hoặc máy này không phải máy chính của văn phòng' : 'Tài khoản chưa thuộc văn phòng này. Nhờ quản trị mời bạn.', 'NOT_IN_OFFICE')
    }
    let [[user]] = await pool.query('SELECT id, email, is_active, activated_at FROM "user" WHERE cloud_account_id = ? AND deleted_at IS NULL', [claims.sub])
    if (!user) {
      // Người được mời: dòng "Đã mời" tạo ở màn Tài khoản, gắn tài khoản ở lần đăng nhập đầu theo email.
      const [linked] = await pool.query(
        'UPDATE "user" SET cloud_account_id = ?, activated_at = COALESCE(activated_at, NOW()) WHERE lower(email) = lower(?) AND cloud_account_id IS NULL AND deleted_at IS NULL RETURNING id, email, is_active, activated_at',
        [claims.sub, claims.email]
      )
      user = linked.rows[0]
    }
    if (!user) throw fail(403, 'Tài khoản chưa được mời vào văn phòng này. Nhờ quản trị mời bạn.', 'NOT_IN_OFFICE')
    if (!user.is_active) throw fail(403, 'Tài khoản đã bị khoá', 'USER_LOCKED')
    return session(user, claims)
  })

  // Lần đầu: tiến trình chính đã tạo văn phòng ở máy chủ dịch vụ và làm mới vé (vé có office + machine). Ghi văn phòng
  // vào máy này và tạo người tạo làm quản trị. Chỉ chạy khi máy chưa có văn phòng.
  fastify.post('/desktop-office', {
    config: limit,
    schema: { body: { type: 'object', required: ['ticket', 'machine_public_key'], properties: { ticket: { type: 'string', maxLength: 8192 }, machine_public_key: { type: 'string', maxLength: 2000 } } } },
  }, async (request) => {
    const claims = readTicket(request.body.ticket)
    if (await officeInfo()) throw fail(409, 'Máy này đã có văn phòng')
    let pem
    try {
      pem = normalizePem(request.body.machine_public_key)
    } catch {
      throw fail(400, 'Khoá máy chính không hợp lệ')
    }
    if (!claims.office || claims.office_role !== 'admin' || claims.machine !== machineId(pem)) throw fail(403, 'Vé không khớp văn phòng vừa tạo')
    const client = await pool.native.connect()
    let userId
    try {
      await client.query('BEGIN')
      await client.query('INSERT INTO office_info (id, office_id, name, machine_public_key) VALUES (1, $1, $2, $3)', [claims.office, claims.office_name || 'Văn phòng', pem])
      const { rows: [role] } = await client.query('SELECT id FROM role WHERE code = \'admin\'')
      const { rows: existing } = await client.query('SELECT id FROM "user" WHERE lower(email) = lower($1) AND deleted_at IS NULL', [claims.email])
      if (existing[0]) {
        userId = existing[0].id
        await client.query('UPDATE "user" SET cloud_account_id = $2, role_id = $3, activated_at = COALESCE(activated_at, NOW()) WHERE id = $1', [userId, claims.sub, role.id])
      } else {
        const { rows } = await client.query(
          'INSERT INTO "user" (email, full_name, role_id, verification_status, activated_at, cloud_account_id) VALUES ($1, $2, $3, \'verified\', NOW(), $4) RETURNING id',
          [claims.email, claims.name || null, role.id, claims.sub]
        )
        userId = rows[0].id
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    // Văn phòng mới: báo luôn chứng chỉ trong mạng văn phòng để máy nhân viên ghép được ngay.
    require('../../utils/desktop_cloud').registerLan().catch((err) => request.log.warn({ err: err.message || err }, 'Chưa báo được chứng chỉ máy chính'))
    return session({ id: userId, email: claims.email }, claims)
  })

  // Máy chính mới sau khi hỗ trợ MCAH nạp bản chụp (docs/mcah-ke-hoach-desktop-gd4.md 3.4): tiến trình chính đã đổi khoá
  // máy chính trên máy chủ dịch vụ; vé mới mang khoá mới. Ghi khoá mới vào office_info rồi đăng nhập như thường.
  fastify.post('/desktop-machine', {
    config: limit,
    schema: { body: { type: 'object', required: ['ticket', 'machine_public_key'], properties: { ticket: { type: 'string', maxLength: 8192 }, machine_public_key: { type: 'string', maxLength: 2000 } } } },
  }, async (request) => {
    const claims = readTicket(request.body.ticket)
    const office = await officeInfo()
    let pem
    try {
      pem = normalizePem(request.body.machine_public_key)
    } catch {
      throw fail(400, 'Khoá máy chính không hợp lệ')
    }
    if (!office || claims.office !== office.office_id || claims.office_role !== 'admin' || claims.machine !== machineId(pem)) {
      throw fail(403, 'Vé không khớp văn phòng của bản chụp', 'NOT_IN_OFFICE')
    }
    await pool.query('UPDATE office_info SET machine_public_key = ? WHERE id = 1', [pem])
    const [[user]] = await pool.query('SELECT id, email, is_active FROM "user" WHERE (cloud_account_id = ? OR lower(email) = lower(?)) AND deleted_at IS NULL ORDER BY cloud_account_id IS NULL LIMIT 1', [claims.sub, claims.email])
    if (!user?.is_active) throw fail(403, 'Tài khoản không còn trong văn phòng', 'NOT_IN_OFFICE')
    require('../../utils/desktop_cloud').registerLan().catch((err) => request.log.warn({ err: err.message || err }, 'Chưa báo được chứng chỉ máy chính'))
    return session(user, claims)
  })

  // Thông tin văn phòng của máy (màn Tài khoản, dải trạng thái).
  fastify.get('/desktop-office', { onRequest: [fastify.authenticate] }, async () => {
    const office = await officeInfo()
    return office ? { office_id: office.office_id, name: office.name } : null
  })
}

desktopTicketRoutes.machineId = machineId
// Dùng lại ở lan_device.routes.js (ghép máy nhân viên bằng vé).
desktopTicketRoutes.verifyTicket = verifyTicket
desktopTicketRoutes.parseKeys = (publicKeyPem) => String(publicKeyPem).match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g).map((pem) => {
  const clean = normalizePem(pem)
  return { kid: keyId(clean), publicKey: crypto.createPublicKey(clean) }
})
desktopTicketRoutes.officeInfo = officeInfo
module.exports = desktopTicketRoutes
