const Fastify = require('fastify')
const config = require('./src/config')
const plugins = require('./src/plugins')
const v1Routes = require('./src/routes/v1')
const { startJobs } = require('./src/jobs')

function buildApp(options = {}) {
  const fastify = Fastify({ logger: true, ...options })

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

  fastify.register(plugins)
  fastify.register(v1Routes, { prefix: '/api/v1' })
  fastify.get('/health', async () => ({ status: 'ok', product: 'MCAH' }))
  fastify.get('/ready', async (_request, reply) => {
    const checks = { database: false, migrations: false, storage: false, ai: require('./src/services/document_reader.service').isConfigured() ? 'configured_unverified' : 'not_configured' }
    try {
      const pool = require('./src/config/db')
      const [[marker]] = await pool.query('SELECT product FROM mcah_instance WHERE id = 1')
      checks.database = marker?.product === 'MCAH'
      checks.migrations = await require('./src/config/migrations').migrationStatus(pool)
    } catch (_err) { /* report unavailable without credentials or SQL details */ }
    try {
      const fs = require('fs')
      fs.mkdirSync(config.upload.dir, { recursive: true, mode: 0o700 })
      const probe = require('path').join(config.upload.dir, `.ready-${require('crypto').randomUUID()}`)
      fs.writeFileSync(probe, '', { flag: 'wx', mode: 0o600 })
      fs.unlinkSync(probe)
      checks.storage = true
    } catch (_err) { /* genuine write probe failed */ }
    const ready = checks.database && checks.migrations && checks.storage
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not_ready', checks })
  })
  return fastify
}

async function start() {
  const fastify = buildApp()
  await fastify.listen({ port: config.port, host: config.host })
  if (process.env.ENABLE_LEGACY_JOBS === 'true') startJobs(fastify.log)
}

if (require.main === module) start().catch(err => { console.error(err.message); process.exitCode = 1 })
module.exports = { buildApp }
