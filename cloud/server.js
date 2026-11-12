// Máy chủ dịch vụ MCAH (docs/mcah-ke-hoach-desktop-gd2.md mục 3): tài khoản, OAuth cho app, văn phòng, lời mời,
// chuyển tiếp AI và tra tàu. Không giữ dữ liệu nghiệp vụ của khách. Chạy sau HTTPS (Caddy) ở máy chủ thật.
const Fastify = require('fastify')
const config = require('./src/config')

function build(opts = {}) {
  const fastify = Fastify({ logger: opts.logger ?? { level: 'info' }, trustProxy: true, bodyLimit: 30 * 1024 * 1024 })

  fastify.register(require('@fastify/cookie'), { secret: config.cookieSecret })
  fastify.register(require('@fastify/formbody'))
  fastify.register(require('@fastify/rate-limit'), { max: 300, timeWindow: '1 minute' })

  // Trang web không chạy script nào; cấm nhúng khung; không cache trang có mã.
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Frame-Options', 'DENY')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Cache-Control', 'no-store')
    if (String(reply.getHeader('content-type') || '').startsWith('text/html')) {
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
    }
    return payload
  })

  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500
    // 503 / 502 / 504 do mình ném kèm câu báo (dịch vụ chưa sẵn sàng, nguồn ngoài lỗi): giữ câu báo cho người dùng.
    if (statusCode >= 500 && !(error instanceof Error) && error.message) {
      return reply.code(statusCode).send({ error: 'unavailable', message: error.message })
    }
    if (statusCode >= 500) {
      request.log.error({ err: error, url: request.url }, 'Lỗi máy chủ')
      return reply.code(500).send({ error: 'server_error', message: 'Máy chủ dịch vụ gặp lỗi, thử lại sau ít phút' })
    }
    return reply.code(statusCode).send({ error: error.error || 'bad_request', message: error.message || 'Yêu cầu không hợp lệ' })
  })

  fastify.get('/health', async () => ({ status: 'ok' }))
  fastify.register(require('./src/routes/web'))
  fastify.register(require('./src/routes/api'))
  fastify.register(require('./src/routes/admin'))
  return fastify
}

if (require.main === module) {
  const fastify = build()
  fastify.listen({ port: config.port, host: config.host }).catch((error) => {
    fastify.log.error(error)
    process.exit(1)
  })
}

module.exports = { build }
