const fs = require('fs')
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

  // GET /api/v1/seafarers/:seafarerId/certificates/bundle?ids=1,2&photo=1 — tải cả bộ giấy tờ (.zip)
  fastify.get(
    '/bundle',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
      schema: {
        querystring: {
          type: 'object',
          properties: { ids: { type: 'string', pattern: '^[0-9]+(,[0-9]+)*$' }, photo: { type: 'boolean', default: true } },
        },
      },
    },
    async (request, reply) => {
      const seafarerId = parseInt(request.params.seafarerId)
      await assertSeafarerInScope(request, seafarerId)
      const ids = request.query.ids ? request.query.ids.split(',').map(Number) : null
      const { buffer, filename } = await certificateService.bundle(seafarerId, { ids, photo: request.query.photo })
      reply.header('Content-Type', 'application/zip')
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      return reply.send(buffer)
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

  // GET /api/v1/seafarers/:seafarerId/certificates/:id/file — tải file chứng chỉ nhập tay
  fastify.get(
    '/:id/file',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request, reply) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      const file = await certificateService.manualFile(parseInt(request.params.id), parseInt(request.params.seafarerId))
      reply.header('Content-Type', file.mime)
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      return reply.send(fs.createReadStream(file.path))
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
