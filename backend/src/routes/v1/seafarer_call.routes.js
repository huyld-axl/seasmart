const seafarerCallService = require('../../services/seafarer_call.service')

async function seafarerCallRoutes(fastify) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const seafarerId = parseInt(request.params.seafarerId)
    const { page, limit } = request.query
    return seafarerCallService.list(seafarerId, {
      page: Math.max(parseInt(page) || 1, 1),
      limit: Math.min(parseInt(limit) || 20, 100),
    })
  })

  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            note: { type: 'string', maxLength: 500 },
            called_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const seafarerId = parseInt(request.params.seafarerId)
      const result = await seafarerCallService.create(
        seafarerId,
        request.body || {},
        request.user.id
      )
      reply.code(201)
      return result
    }
  )

  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request) => {
    const seafarerId = parseInt(request.params.seafarerId)
    const id = parseInt(request.params.id)
    await seafarerCallService.delete(id, seafarerId)
    return { success: true }
  })
}

module.exports = seafarerCallRoutes
