require('dotenv').config({ quiet: true })
const Fastify = require('fastify')
const config = require('./src/config')
const plugins = require('./src/plugins')
const v1Routes = require('./src/routes/v1')
const { startJobs } = require('./src/jobs')
const { documentService } = require('./src/services/document.service')

// App máy tính: không ghi log từng request (đường dẫn có thể chứa tên, số giấy tờ trong ô tìm kiếm).
const fastify = Fastify({ logger: config.desktop ? { level: 'warn' } : true })

// Error handler — phân biệt lỗi user-facing vs internal
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500

  if (statusCode >= 500) {
    // Log chi tiết server-side, không lộ ra client
    fastify.log.error(
      { err: error, url: request.url, method: request.method },
      'Internal server error'
    )
    return reply.code(500).send({ error: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau' })
  }

  // 4xx: lỗi do client, trả về message an toàn
  return reply.code(statusCode).send({
    error: error.message || 'Yêu cầu không hợp lệ',
    ...(error.code && /^[A-Z_]+$/.test(error.code) ? { code: error.code } : {}),
    ...(error.blocked_bills ? { blocked_bills: error.blocked_bills } : {}),
    ...(error.conflict ? { conflict: error.conflict } : {}),
  })
})

async function start() {
  await fastify.register(plugins)
  await fastify.register(v1Routes, { prefix: '/api/v1' })

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }))

  await fastify.listen({ port: config.port, host: config.host })
  startJobs(fastify.log)
  // Upload và giấy đang đọc dở từ lần chạy trước (máy chủ tắt giữa chừng) được đưa vào chạy lại.
  documentService.recoverStalled()
    .then((queued) => fastify.log.info(queued, 'Khôi phục giấy tờ đang đọc dở'))
    .catch((err) => fastify.log.error({ err }, 'Không khôi phục được giấy tờ đang đọc dở'))
}

start().catch((err) => {
  fastify.log.error(err)
  process.exit(1)
})
