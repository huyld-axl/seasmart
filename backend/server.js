require('dotenv').config()
const Fastify = require('fastify')
const config = require('./src/config')
const plugins = require('./src/plugins')
const v1Routes = require('./src/routes/v1')
const { startJobs } = require('./src/jobs')

const fastify = Fastify({ logger: true })

// Error handler - phân biệt lỗi user-facing vs internal
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500

  if (statusCode >= 500) {
    fastify.log.error(
      { err: error, url: request.url, method: request.method },
      'Internal server error'
    )
    // DEBUG: tạm thời expose error để debug, sẽ remove sau
    return reply.code(500).send({
      error: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau',
      _debug: { code: error.code, message: error.message, sql: error.sql },
    })
  }

  // 4xx: lỗi do client, trả về message an toàn
  return reply.code(statusCode).send({
    error: error.message || 'Yêu cầu không hợp lệ',
  })
})

async function start() {
  await fastify.register(plugins)
  await fastify.register(v1Routes, { prefix: '/api/v1' })

  // fastify.addHook('onSend', async (request, reply) => {
  //   if (request.url.startsWith('/api/')) {
  //     reply.header('Cache-Control', 'no-store')
  //   }
  // })

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }))

  await fastify.listen({ port: config.port, host: config.host })
  startJobs(fastify.log)
}

start().catch((err) => {
  fastify.log.error(err)
  process.exit(1)
})
