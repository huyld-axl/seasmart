// Bộ nhận vé thử của app máy tính (giai đoạn 0, bước 0.5). Chỉ đăng ký khi có DESKTOP_TICKET_PUBLIC_KEY.
// Vé do máy chủ dịch vụ ký Ed25519; máy chính kiểm bằng khoá công khai, không cần internet.
// Phiên cấp ra không sống quá exp của vé (mốc hết hạn offline).
const crypto = require('crypto')
const pool = require('../../config/db')
const { loadAccess, toClientUser } = require('../../plugins/access')

const AUDIENCE = 'mcah-office'

function verifyTicket(ticket, publicKey) {
  const parts = String(ticket || '').split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  if (JSON.parse(Buffer.from(header, 'base64url')).alg !== 'EdDSA') return null
  const ok = crypto.verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))
  if (!ok) return null
  const claims = JSON.parse(Buffer.from(payload, 'base64url'))
  if (claims.aud !== AUDIENCE || !claims.email || claims.exp <= Math.floor(Date.now() / 1000)) return null
  return claims
}

async function desktopTicketRoutes(fastify, { publicKeyPem }) {
  const publicKey = crypto.createPublicKey(publicKeyPem)

  fastify.post(
    '/desktop-ticket',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { body: { type: 'object', required: ['ticket'], properties: { ticket: { type: 'string', maxLength: 4096 } } } },
    },
    async (request) => {
      let claims = null
      try {
        claims = verifyTicket(request.body.ticket, publicKey)
      } catch {}
      if (!claims) throw { statusCode: 401, message: 'Vé đăng nhập không hợp lệ hoặc đã hết hạn' }
      const [[user]] = await pool.query(
        'SELECT id, email, is_active, activated_at FROM "user" WHERE lower(email) = lower(?) AND deleted_at IS NULL',
        [claims.email]
      )
      if (!user) throw { statusCode: 403, message: 'Tài khoản chưa thuộc văn phòng này' }
      if (!user.is_active || !user.activated_at) throw { statusCode: 403, message: 'Tài khoản đã bị khóa hoặc chưa kích hoạt' }
      await pool.query('UPDATE "user" SET last_login_at = NOW() WHERE id = ?', [user.id])
      const access = await loadAccess(user.id)
      const secondsLeft = claims.exp - Math.floor(Date.now() / 1000)
      const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: secondsLeft })
      return { user: toClientUser(access), token, offline_until: new Date(claims.exp * 1000).toISOString() }
    }
  )
}

module.exports = desktopTicketRoutes
