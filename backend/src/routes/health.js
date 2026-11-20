const db = require('../config/db')

async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    try {
      await db.native.query({ text: 'SELECT 1', query_timeout: 3000 })
      return { status: 'ok' }
    } catch {
      return reply.code(503).send({ status: 'error' })
    }
  })
}

module.exports = healthRoutes
