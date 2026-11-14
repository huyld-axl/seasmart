// Máy nhân viên gọi qua cổng mạng của máy chính (desktop/src/lan-server.js, docs/mcah-ke-hoach-desktop-gd3.md 3.3).
// lan-server gắn x-mcah-lan = MCAH_LAN_SECRET; có header đó thì bắt buộc mã thiết bị (x-mcah-device) còn hiệu lực,
// trừ các bước ghép máy. Sai mã / máy đã bị Gỡ → 401 DEVICE_REMOVED, máy nhân viên về màn ghép. Không có header: request
// từ chính máy chính (giao diện của máy này), chạy như cũ.
const fp = require('fastify-plugin')
const crypto = require('crypto')
const pool = require('../config/db')

const OPEN = new Set(['/api/v1/lan/hello', '/api/v1/lan/pair', '/api/v1/lan/pair/status'])
const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex')
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
const SEEN_MS = 60 * 1000

module.exports = fp(async function (fastify) {
  const secret = process.env.MCAH_LAN_SECRET || ''
  const seen = new Map()

  fastify.addHook('onRequest', async (request, reply) => {
    const via = request.headers['x-mcah-lan']
    if (via === undefined) return
    if (!secret || !same(String(via), secret)) return reply.code(403).send({ error: 'Không được phép' })
    request.lan = { ip: String(request.headers['x-mcah-lan-ip'] || '') }
    if (OPEN.has(request.url.split('?')[0])) return
    const token = String(request.headers['x-mcah-device'] || '')
    const [[device]] = token ? await pool.query('SELECT id, status FROM office_device WHERE token_hash = ? AND status = \'active\'', [sha256(token)]) : [[]]
    if (!device) return reply.code(401).send({ error: 'Máy này đã bị gỡ khỏi văn phòng hoặc chưa ghép', code: 'DEVICE_REMOVED' })
    request.device = device
  })

  // Lần cuối nối, người dùng gần nhất: ghi tối đa mỗi phút một lần cho mỗi máy.
  fastify.addHook('onResponse', async (request) => {
    if (!request.device) return
    const last = seen.get(request.device.id) || 0
    if (Date.now() - last < SEEN_MS) return
    seen.set(request.device.id, Date.now())
    await pool.query('UPDATE office_device SET last_seen_at = NOW(), last_ip = ?, last_user_id = COALESCE(?, last_user_id) WHERE id = ?', [request.lan.ip, request.user?.id || null, request.device.id]).catch(() => {})
  })
})

module.exports.sha256 = sha256
