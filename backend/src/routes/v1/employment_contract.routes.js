const employmentContractService = require('../../services/employment_contract.service')

const ADMIN_ROLES = ['admin', 'operator']

function adminAuth(fastify) {
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
    },
  }
}

async function employmentContractRoutes(fastify) {
  // GET /api/v1/employment-contracts?seafarer_id=
  fastify.get('/', adminAuth(fastify), async (request) => {
    const seafarerId = parseInt(request.query.seafarer_id)
    if (!seafarerId) return { data: [], total: 0, page: 1, limit: 20 }
    return employmentContractService.list(seafarerId, {
      page: parseInt(request.query.page) || 1,
      limit: Math.min(parseInt(request.query.limit) || 50, 200),
    })
  })

  // GET /api/v1/employment-contracts/:id
  fastify.get('/:id', adminAuth(fastify), async (request, reply) => {
    try {
      return await employmentContractService.getById(parseInt(request.params.id))
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // POST /api/v1/employment-contracts
  fastify.post(
    '/',
    {
      ...adminAuth(fastify),
      schema: {
        body: {
          type: 'object',
          required: ['seafarer_id'],
          properties: {
            seafarer_id: { type: 'integer' },
            vessel_id: { type: 'integer' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            salary: { type: 'number' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const contract = await employmentContractService.create(request.body, request.user.id)
        return reply.code(201).send(contract)
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )

  // PUT /api/v1/employment-contracts/:id
  fastify.put('/:id', adminAuth(fastify), async (request, reply) => {
    try {
      return await employmentContractService.update(
        parseInt(request.params.id),
        request.body,
        request.user.id
      )
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/employment-contracts/:id
  fastify.delete('/:id', adminAuth(fastify), async (request, reply) => {
    try {
      await employmentContractService.softDelete(parseInt(request.params.id), request.user.id)
      return reply.code(204).send()
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })
}

module.exports = employmentContractRoutes
