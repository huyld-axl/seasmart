const certificateService = require('../../services/certificate.service')

async function certificateRoutes(fastify) {
  // GET /api/v1/seafarers/:seafarerId/certificates
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
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
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['certificate_type_id'],
          properties: {
            certificate_type_id: { type: 'integer' },
            certificate_number: { type: 'string' },
            issued_date: { type: 'string', format: 'date' },
            expiry_date: { type: 'string', format: 'date' },
            issued_by: { type: 'string' },
            issued_at_country_id: { type: 'integer' },
            status: { type: 'string', enum: ['VALID', 'EXPIRED', 'REVOKED', 'PENDING'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
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
      onRequest: [fastify.authenticate],
    },
    async (request) => {
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
      onRequest: [fastify.authenticate],
    },
    async (request) => {
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
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
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
