// Mã yêu cầu chống tạo trùng (docs/mcah-ke-hoach-desktop-gd3.md 3.4). Form thêm mới gửi header Idempotency-Key
// (một mã cho mỗi lần mở form). Lần đầu: giữ chỗ, chạy bình thường, lưu kết quả. Gửi lại cùng mã (bấm lại sau khi
// mạng đứt giữa chừng): trả đúng kết quả đã lưu, không tạo bản ghi thứ hai.
const fp = require('fastify-plugin')
const pool = require('../config/db')

const KEY_RE = /^[A-Za-z0-9-]{16,64}$/

module.exports = fp(async function (fastify) {
  fastify.addHook('preHandler', async (request, reply) => {
    const key = request.headers['idempotency-key']
    if (request.method !== 'POST' || !key || !request.user?.id) return
    if (!KEY_RE.test(key)) return reply.code(400).send({ error: 'Mã yêu cầu không hợp lệ' })
    const path = request.routeOptions.url || request.url
    const [{ affectedRows }] = await pool.query(
      'INSERT INTO idempotency_key (key, user_id, method, path) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
      [key, request.user.id, request.method, path]
    )
    if (affectedRows) {
      request.idempotencyKey = key
      return
    }
    const [[saved]] = await pool.query('SELECT path, status_code, body FROM idempotency_key WHERE user_id = ? AND key = ?', [request.user.id, key])
    if (!saved || saved.path !== path) return reply.code(422).send({ error: 'Mã yêu cầu đã dùng cho việc khác' })
    if (saved.status_code === null) return reply.code(409).send({ error: 'Yêu cầu này đang được xử lý, đợi một chút', code: 'IN_PROGRESS' })
    reply.header('Idempotent-Replay', 'true')
    return reply.code(saved.status_code).type('application/json; charset=utf-8').send(saved.body)
  })

  fastify.addHook('onSend', async (request, reply, payload) => {
    const key = request.idempotencyKey
    if (!key) return payload
    // Lỗi: bỏ giữ chỗ để bấm lại chạy lại từ đầu. Thành công (JSON): lưu để trả lại.
    if (reply.statusCode >= 400 || typeof payload !== 'string') {
      await pool.query('DELETE FROM idempotency_key WHERE user_id = ? AND key = ?', [request.user.id, key])
    } else {
      await pool.query('UPDATE idempotency_key SET status_code = ?, body = ? WHERE user_id = ? AND key = ?', [reply.statusCode, payload, request.user.id, key])
    }
    return payload
  })
})
