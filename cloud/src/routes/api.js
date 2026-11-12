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
    const ok = crypto.verify(null, Buffer.from(signingInput(request.method, path, time, request.rawBody)), crypto.createPublicKey(key), Buffer.from(signature, 'base64'))
    if (!ok) throw fail(401, 'Chữ ký máy chính không hợp lệ', 'unauthorized')
    if (office.locked_at) throw fail(403, 'Văn phòng đang bị khoá, liên hệ MCAH', 'office_locked')
    request.office = office
  }

  fastify.post('/api/offices', { onRequest: byTicket, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { name, machine_public_key: machinePublicKey } = request.body || {}
    const office = await offices.create({ accountId: request.claims.sub, name, machinePublicKey, ip: request.ip })
    return { id: office.id, name: office.name }
  })

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

  fastify.decorate('byMachine', byMachine)
  fastify.register(require('./services'))
}

apiRoutes.signingInput = signingInput
module.exports = apiRoutes
