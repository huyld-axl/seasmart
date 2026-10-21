const certificateService = require('../../services/certificate.service')
const { assertSeafarerInScope } = require('../../utils/scope')

async function certificateRoutes(fastify) {
  // GET /api/v1/seafarers/:seafarerId/certificates
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      const { page, limit } = request.query
      return certificateService.list(parseInt(request.params.seafarerId), {
        page: parseInt(page) || 1,
        limit: Math.min(parseInt(limit) || 50, 200),
      })
    }
  )

  // POST /api/v1/seafarers/:seafarerId/certificates
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
      schema: {
        body: {
          type: 'object',
          required: ['certificate_type_id'],
          properties: {
            certificate_type_id: { type: 'integer' },
            certificate_number: { type: 'string' },
            issued_date: { type: 'string', format: 'date' },
            expiry_date: { type: 'string', format: 'date' },
            no_expiry: { type: 'boolean' },
            issued_by: { type: 'string' },
            issued_at_country_id: { type: 'integer' },
            status: { type: 'string', enum: ['VALID', 'EXPIRED', 'REVOKED', 'PENDING'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      const cert = await certificateService.create(
        parseInt(request.params.seafarerId),
        request.body,
        request.user.id
      )
      return reply.code(201).send(cert)
    }
  )

  // PUT /api/v1/seafarers/:seafarerId/certificates/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      return certificateService.update(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        request.body,
        request.user.id
      )
    }
  )

  // DELETE /api/v1/seafarers/:seafarerId/certificates/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      return certificateService.softDelete(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        request.user.id
      )
    }
  )

  // POST /api/v1/seafarers/:seafarerId/certificates/:id/upload
  fastify.post(
    '/:id/upload',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
    },
    async (request, reply) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      const file = await request.file()
      if (!file) return reply.code(400).send({ error: 'Không có file được gửi lên' })

      return certificateService.uploadFile(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        file,
        request.user.id
      )
    }
  )
}

module.exports = certificateRoutes
