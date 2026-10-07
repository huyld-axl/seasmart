const { documentService } = require('../../services/document.service')
const documentReader = require('../../services/document_reader.service')
const { MAX_FILE_BYTES } = require('../../constants/document_types')

const ROLES = ['admin', 'operator', 'reviewer']

const requireRole = (roles) => async (request, reply) => {
  if (!roles.includes(request.user?.role)) return reply.code(403).send({ error: 'Không có quyền' })
}
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const seafarerParams = { type: 'object', required: ['seafarerId'], properties: { seafarerId: { type: 'integer', minimum: 1 } } }

// Giấy tờ AI đọc (A3): /api/v1/documents
async function documentRoutes(fastify) {
  const guard = { onRequest: [fastify.authenticate, requireRole(ROLES)] }

  fastify.get('/status', guard, async () => ({ ai_configured: documentReader.isConfigured() }))

  fastify.get('/seafarer/:seafarerId', { ...guard, schema: { params: seafarerParams } }, async (request) => ({
    ai_configured: documentReader.isConfigured(),
    data: await documentService.list(request.params.seafarerId),
  }))

  fastify.post('/seafarer/:seafarerId', { ...guard, schema: { params: seafarerParams } }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } })
    if (!file) throw { statusCode: 400, message: 'Chưa chọn tệp' }
    const doc = await documentService.upload(request.params.seafarerId, file, request.user.id)
    return reply.code(201).send(doc)
  })

  fastify.post('/seafarer/:seafarerId/publish', { ...guard, schema: { params: seafarerParams } }, async (request) =>
    documentService.publish(request.params.seafarerId, request.user.id))

  fastify.get('/:id', { ...guard, schema: { params: idParams } }, async (request) => documentService.get(request.params.id))

  fastify.get('/:id/file', { ...guard, schema: { params: idParams } }, async (request, reply) => {
    const doc = await documentService.fileOf(request.params.id)
    reply.header('Content-Type', doc.mime_type)
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`)
    return reply.send(require('fs').createReadStream(doc.storage_path))
  })

  fastify.put('/:id/fields/:key', {
    ...guard,
    schema: {
      params: { type: 'object', required: ['id', 'key'], properties: { id: { type: 'integer', minimum: 1 }, key: { type: 'string', maxLength: 40 } } },
      body: {
        type: 'object',
        required: ['action'],
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['accept', 'edit', 'reject', 'keepUnknown', 'undo'] },
          value: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request) => documentService.decide(request.params.id, request.params.key, request.body.action, request.body.value, request.user.id))

  fastify.post('/:id/retry', { ...guard, schema: { params: idParams } }, async (request) => documentService.retry(request.params.id))

  fastify.delete('/:id', { ...guard, schema: { params: idParams } }, async (request) => documentService.remove(request.params.id))
}

module.exports = documentRoutes
