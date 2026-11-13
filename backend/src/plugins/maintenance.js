// Máy chính đang cập nhật có đổi dữ liệu (docs/mcah-ke-hoach-desktop-gd4.md 3.5): tiến trình chính tạo tệp
// MCAH_MAINTENANCE_FILE; có tệp thì mọi lệnh ghi trả 503 MAINTENANCE (đọc vẫn được), máy nhân viên giữ nguyên form.
const fp = require('fastify-plugin')
const fs = require('fs')

module.exports = fp(async function (fastify) {
  const file = process.env.MCAH_MAINTENANCE_FILE
  if (!file) return
  fastify.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !fs.existsSync(file)) return
    return reply.code(503).send({ error: 'Máy chính đang cập nhật, chưa lưu được. Nội dung đang nhập vẫn còn, thử lại sau ít phút.', code: 'MAINTENANCE' })
  })
})
