const trainingCenterService = require('../../services/training_center.service')

const MAX_LIST_LIMIT = 100

async function trainingCenterRoutes(fastify) {
  // GET /api/v1/training-centers
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_LIMIT, default: 20 },
            search: { type: 'string' },
            is_active: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    async (request) => {
      const { page, limit, search, is_active } = request.query
      return trainingCenterService.list({
        page: Math.max(parseInt(page) || 1, 1),
        limit: Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT),
        search,
        is_active,
      })
    }
  )

  // GET /api/v1/training-centers/:id
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return trainingCenterService.getById(parseInt(request.params.id))
    }
  )

  // POST /api/v1/training-centers
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['name_vi'],
          properties: {
            code: { type: 'string' },
            name_vi: { type: 'string' },
            name_en: { type: 'string' },
            country_id: { type: 'integer' },
            license_number: { type: 'string' },
            license_expiry: { type: 'string', format: 'date' },
            accredited_by: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            contact_person: { type: 'string' },
            is_active: { type: 'boolean' },
            notes: { type: 'string' },
            user_id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
      const center = await trainingCenterService.create(request.body, request.user.id)
      return reply.code(201).send(center)
    }
  )

  // PUT /api/v1/training-centers/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator', 'training_center'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
      return trainingCenterService.update(
        parseInt(request.params.id),
        request.body,
        request.user.id,
        request.user
      )
    }
  )

  // DELETE /api/v1/training-centers/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Chỉ admin mới có quyền xóa' })
      }
      return trainingCenterService.softDelete(parseInt(request.params.id), request.user.id)
    }
  )
}

module.exports = trainingCenterRoutes
