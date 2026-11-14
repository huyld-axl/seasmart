// Ghép máy nhân viên và danh sách máy trong văn phòng (docs/mcah-ke-hoach-desktop-gd3.md 3.2, wireframe màn 1, 2).
// Chỉ đăng ký ở app máy tính có khoá kiểm vé. /hello, /pair, /pair/status đi qua cổng mạng (plugins/lan_device.js);
// /devices dành cho quản trị trên mọi máy.
const crypto = require('crypto')
const pool = require('../../config/db')
const notificationService = require('../../services/notification.service')
const { verifyTicket, parseKeys, machineId, officeInfo } = require('./desktop_ticket.routes')
const { sha256 } = require('../../plugins/lan_device')

const fail = (statusCode, message, code) => ({ statusCode, message, ...(code ? { code } : {}) })
const newToken = () => crypto.randomBytes(32).toString('base64url')
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
const lanOnly = async (request) => {
  if (!request.lan) throw fail(404, 'Không có')
}

async function adminIds() {
  const [rows] = await pool.query('SELECT u.id FROM "user" u JOIN role r ON r.id = u.role_id WHERE r.code = \'admin\' AND u.is_active = 1 AND u.deleted_at IS NULL')
  return rows.map((r) => r.id)
}

async function lanDeviceRoutes(fastify, { publicKeyPem }) {
  const keys = parseKeys(publicKeyPem)

  fastify.get('/hello', { onRequest: [lanOnly] }, async () => {
    const office = await officeInfo()
    if (!office) throw fail(404, 'Máy này chưa có văn phòng')
    return { app: 'mcah', office_id: office.office_id, office_name: office.name }
  })

  // Ghép: vé đăng nhập của nhân viên (thuộc văn phòng này, vé chỉ đúng máy chính) + install_id + pair_secret.
  // Máy mới → cấp mã thiết bị ngay. Máy đã bị Gỡ / từ chối → chờ quản trị duyệt; hỏi lại bằng /pair/status.
  fastify.post('/pair', {
    onRequest: [lanOnly],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['ticket', 'install_id', 'pair_secret', 'name'],
        properties: {
          ticket: { type: 'string', maxLength: 8192 },
          install_id: { type: 'string', pattern: UUID },
          pair_secret: { type: 'string', minLength: 32, maxLength: 128 },
          name: { type: 'string', minLength: 1, maxLength: 63 },
          os: { type: 'string', maxLength: 80 },
          app_version: { type: 'string', maxLength: 30 },
        },
      },
    },
  }, async (request) => {
    const body = request.body
    let claims = null
    try {
      claims = verifyTicket(body.ticket, keys)
    } catch {}
    if (!claims) throw fail(401, 'Vé đăng nhập không hợp lệ hoặc đã hết hạn', 'TICKET_INVALID')
    const office = await officeInfo()
    if (!office || claims.office !== office.office_id || claims.machine !== machineId(office.machine_public_key)) {
      throw fail(403, 'Tài khoản không thuộc văn phòng của máy chính này', 'NOT_IN_OFFICE')
    }
    const [[user]] = await pool.query('SELECT id, is_active FROM "user" WHERE (cloud_account_id = ? OR lower(email) = lower(?)) AND deleted_at IS NULL ORDER BY cloud_account_id IS NULL LIMIT 1', [claims.sub, claims.email])
    if (!user) throw fail(403, 'Tài khoản chưa được mời vào văn phòng này. Nhờ quản trị mời bạn.', 'NOT_IN_OFFICE')
    if (!user.is_active) throw fail(403, 'Tài khoản đã bị khoá', 'USER_LOCKED')

    const info = [body.name, body.os || null, body.app_version || null, sha256(body.pair_secret), user.id]
    const [[existing]] = await pool.query('SELECT id, status FROM office_device WHERE install_id = ?', [body.install_id])
    if (!existing || existing.status === 'active') {
      const token = newToken()
      if (existing) {
        await pool.query('UPDATE office_device SET name = ?, os = ?, app_version = ?, pair_secret_hash = ?, requested_by = ?, token_hash = ? WHERE id = ?', [...info, sha256(token), existing.id])
      } else {
        await pool.query('INSERT INTO office_device (install_id, name, os, app_version, pair_secret_hash, requested_by, token_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, \'active\')', [body.install_id, ...info, sha256(token)])
      }
      return { status: 'active', token }
    }
    // Máy đã bị Gỡ (hoặc bị từ chối) xin vào lại: chờ duyệt, báo quản trị một lần.
    await pool.query('UPDATE office_device SET name = ?, os = ?, app_version = ?, pair_secret_hash = ?, requested_by = ?, status = \'pending\', token_hash = NULL WHERE id = ?', [...info, existing.id])
    if (existing.status !== 'pending') {
      for (const adminId of await adminIds()) {
        await notificationService.create({ user_id: adminId, type: 'DEVICE_REQUEST', ref_table: 'office_device', ref_id: existing.id, title: 'Máy xin vào lại văn phòng', body: `Máy ${body.name} (${claims.email}) xin vào lại. Duyệt ở Quản trị → Máy trong văn phòng.` })
      }
    }
    return { status: 'pending' }
  })

  // Máy đang chờ duyệt hỏi lại (bằng pair_secret đã gửi lúc xin). Được duyệt → cấp mã thiết bị đúng một lần.
  fastify.post('/pair/status', {
    onRequest: [lanOnly],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['install_id', 'pair_secret'], properties: { install_id: { type: 'string', pattern: UUID }, pair_secret: { type: 'string', minLength: 32, maxLength: 128 } } } },
  }, async (request) => {
    const [[device]] = await pool.query('SELECT id, status, token_hash, pair_secret_hash FROM office_device WHERE install_id = ?', [request.body.install_id])
    if (!device || device.pair_secret_hash !== sha256(request.body.pair_secret)) throw fail(404, 'Không có yêu cầu ghép nào của máy này')
    if (device.status === 'rejected') return { status: 'rejected' }
    if (device.status !== 'active' || device.token_hash) return { status: device.status === 'active' ? 'used' : device.status }
    const token = newToken()
    await pool.query('UPDATE office_device SET token_hash = ?, pair_secret_hash = NULL WHERE id = ?', [sha256(token), device.id])
    return { status: 'active', token }
  })

  // Bộ cài cho máy nhân viên: chỉ kiểm thiết bị (plugins/lan_device.js); tiến trình chính máy chính gửi tệp.
  fastify.get('/installer/:name', async (request) => {
    if (!request.device) throw fail(404, 'Không có')
    return { ok: true }
  })

  const admin = [fastify.authenticate, fastify.can('account.update')]

  fastify.get('/devices', { onRequest: [fastify.authenticate, fastify.can('account.view')] }, async () => {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.os, d.app_version, d.status, d.last_seen_at, d.created_at, d.removed_at,
         COALESCE(lu.full_name, lu.email) AS last_user, COALESCE(ru.full_name, ru.email) AS requested_by
       FROM office_device d LEFT JOIN "user" lu ON lu.id = d.last_user_id LEFT JOIN "user" ru ON ru.id = d.requested_by
       WHERE d.status <> 'removed' OR d.removed_at > NOW() - INTERVAL '30 days'
       ORDER BY d.status = 'pending' DESC, d.last_seen_at DESC NULLS LAST, d.id DESC`
    )
    return rows
  })

  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
  const change = (from, to, extra = '') => async (request) => {
    const [r] = await pool.query(`UPDATE office_device SET status = ?, token_hash = CASE WHEN ? = 'removed' OR ? = 'rejected' THEN NULL ELSE token_hash END${extra} WHERE id = ? AND status = ?`, [to, to, to, request.params.id, from])
    if (!r.affectedRows) throw fail(404, 'Không tìm thấy máy hoặc máy đã đổi trạng thái')
    return { ok: true }
  }
  // Gỡ: mã thiết bị mất ngay, lệnh kế tiếp của máy đó bị từ chối.
  fastify.post('/devices/:id/remove', { onRequest: admin, schema: { params: idParams } }, async (request) => {
    await pool.query('UPDATE office_device SET status = \'removed\', token_hash = NULL, removed_at = NOW(), removed_by = ? WHERE id = ? AND status <> \'removed\'', [request.user.id, request.params.id])
    return { ok: true }
  })
  fastify.post('/devices/:id/approve', { onRequest: admin, schema: { params: idParams } }, change('pending', 'active', ', removed_at = NULL'))
  fastify.post('/devices/:id/reject', { onRequest: admin, schema: { params: idParams } }, change('pending', 'rejected'))
}

module.exports = lanDeviceRoutes
