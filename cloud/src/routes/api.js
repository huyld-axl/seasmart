// API cho app và máy chính (docs/mcah-ke-hoach-desktop-gd2.md 3.4).
// - Bằng vé (Authorization: Bearer <vé>): tạo văn phòng (người tạo chưa có văn phòng).
// - Bằng chữ ký máy chính (kiểm ở preHandler, sau khi đã đọc thân): X-MCAH-Office, X-MCAH-Time (ms), X-MCAH-Signature = Ed25519 của
//   "<METHOD>\n<path>\n<time>\n<sha256 hex của thân>" bằng khoá máy chính đã đăng ký; lệch giờ ≤ 5 phút.
const crypto = require('crypto')
const tickets = require('../services/tickets')
const offices = require('../services/offices')

const SKEW_MS = 5 * 60 * 1000
const fail = (statusCode, message, error) => ({ statusCode, message, error })

// Chuỗi đem ký, dùng chung cho máy chính (desktop/src/signer.js) và máy chủ.
const signingInput = (method, path, time, body) => `${method.toUpperCase()}\n${path}\n${time}\n${crypto.createHash('sha256').update(body || '').digest('hex')}`

async function apiRoutes(fastify) {
  // Giữ thân request dạng chuỗi để kiểm chữ ký đúng từng byte.
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    request.rawBody = body
    try {
      done(null, body ? JSON.parse(body) : {})
    } catch {
      done(fail(400, 'JSON không hợp lệ'))
    }
  })

  const byTicket = async (request) => {
    const claims = tickets.verify(String(request.headers.authorization || '').replace(/^Bearer /, ''))
    if (!claims) throw fail(401, 'Vé đăng nhập không hợp lệ hoặc đã hết hạn', 'unauthorized')
    request.claims = claims
  }

  const byMachine = async (request) => {
    const officeId = String(request.headers['x-mcah-office'] || '')
    const time = Number(request.headers['x-mcah-time'])
    const signature = String(request.headers['x-mcah-signature'] || '')
    if (!/^[0-9a-f-]{36}$/.test(officeId) || !Number.isFinite(time) || Math.abs(Date.now() - time) > SKEW_MS) throw fail(401, 'Chữ ký máy chính không hợp lệ (kiểm giờ máy)', 'unauthorized')
    const office = await offices.get(officeId)
    const key = office && (await offices.machineKey(officeId))
    if (!key) throw fail(401, 'Máy chính chưa đăng ký', 'unauthorized')
    const path = request.raw.url.split('?')[0]
    const input = Buffer.from(signingInput(request.method, path, time, request.rawBody))
    const ok = crypto.verify(null, input, crypto.createPublicKey(key), Buffer.from(signature, 'base64'))
    if (!ok) {
      // Máy chính cũ sau khi văn phòng chuyển máy: báo riêng để máy đó hiện "Văn phòng đã chuyển sang máy chính khác".
      const { rows } = await require('../db').query('SELECT public_key FROM office_machine WHERE office_id = $1 AND revoked_at IS NOT NULL', [officeId])
      if (rows.some((r) => { try { return crypto.verify(null, input, crypto.createPublicKey(r.public_key), Buffer.from(signature, 'base64')) } catch { return false } })) {
        throw fail(409, 'Văn phòng đã chuyển sang máy chính khác', 'machine_replaced')
      }
      throw fail(401, 'Chữ ký máy chính không hợp lệ', 'unauthorized')
    }
    if (office.locked_at) throw fail(403, 'Văn phòng đang bị khoá, liên hệ MCAH', 'office_locked')
    request.office = office
  }

  fastify.post('/api/offices', { onRequest: byTicket, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { name, machine_public_key: machinePublicKey } = request.body || {}
    const office = await offices.create({ accountId: request.claims.sub, name, machinePublicKey, ip: request.ip })
    return { id: office.id, name: office.name }
  })

  // Chuyển máy chính (docs/mcah-ke-hoach-desktop-gd4.md 3.4): vé của quản trị vừa đăng nhập lại (auth_time ≤ 10 phút).
  fastify.post('/api/offices/:id/machine', { onRequest: byTicket, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request) => {
    if (!(request.claims.auth_time > Date.now() / 1000 - 600)) throw fail(401, 'Đăng nhập lại để xác nhận chuyển máy chính', 'reauth_required')
    return offices.replaceMachine({ officeId: request.params.id, accountId: request.claims.sub, machinePublicKey: request.body?.machine_public_key, ip: request.ip })
  })

  // Máy chính hỏi trạng thái của mình lúc mở app (máy cũ sau khi chuyển máy nhận 409 machine_replaced từ byMachine).
  fastify.get('/api/office/machine/status', { preHandler: byMachine }, async () => ({ ok: true }))

  fastify.post('/api/office/invites', { preHandler: byMachine }, async (request) => {
    const { email, full_name: fullName, role, invited_by_email: by } = request.body || {}
    const inviter = by ? await require('../services/accounts').findByEmail(String(by).toLowerCase()) : null
    return offices.invite({ officeId: request.office.id, email, fullName, role, invitedBy: inviter?.id })
  })

  fastify.post('/api/office/invites/revoke', { preHandler: byMachine }, async (request) => {
    await offices.revokeInvite({ officeId: request.office.id, email: request.body?.email })
    return { ok: true }
  })

  fastify.post('/api/office/members/remove', { preHandler: byMachine }, async (request) =>
    offices.removeMember({ officeId: request.office.id, email: request.body?.email }))

  fastify.post('/api/office/members/restore', { preHandler: byMachine }, async (request) =>
    offices.restoreMember({ officeId: request.office.id, email: request.body?.email }))

  // Máy chính báo dấu vân tay chứng chỉ HTTPS trong mạng văn phòng, tên máy, cổng (docs/mcah-ke-hoach-desktop-gd3.md 3.1).
  // Vé của thành viên mang các giá trị này để máy nhân viên ghim đúng máy chính.
  fastify.post('/api/office/machine/lan', { preHandler: byMachine }, async (request) => {
    const { fingerprint, name, port } = request.body || {}
    if (!/^[0-9a-f]{64}$/.test(String(fingerprint)) || !/^[A-Za-z0-9._-]{1,63}$/.test(String(name)) || !(Number.isInteger(port) && port > 0 && port < 65536)) {
      throw fail(400, 'Thông tin máy chính không hợp lệ')
    }
    await offices.setMachineLan({ officeId: request.office.id, fingerprint, name, port })
    return { ok: true }
  })

  fastify.decorate('byMachine', byMachine)
  fastify.register(require('./services'))
}

apiRoutes.signingInput = signingInput
module.exports = apiRoutes
