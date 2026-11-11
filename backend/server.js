require('dotenv').config({ quiet: true })
const Fastify = require('fastify')
const config = require('./src/config')
const plugins = require('./src/plugins')
const v1Routes = require('./src/routes/v1')
const { startJobs } = require('./src/jobs')
const { documentService } = require('./src/services/document.service')

const fastify = Fastify({ logger: true })

const { errorHandler } = require('./src/utils/error_handler')
fastify.setErrorHandler(errorHandler)

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
