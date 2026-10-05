require('dotenv').config()
const Fastify = require('fastify')
const config = require('./src/config')
const plugins = require('./src/plugins')
const v1Routes = require('./src/routes/v1')
const { startJobs } = require('./src/jobs')

const fastify = Fastify({ logger: true })

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
  })
})

async function start() {
  await fastify.register(plugins)
  await fastify.register(v1Routes, { prefix: '/api/v1' })

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }))

  await fastify.listen({ port: config.port, host: config.host })
  startJobs(fastify.log)
}

start().catch((err) => {
  fastify.log.error(err)
  process.exit(1)
})
