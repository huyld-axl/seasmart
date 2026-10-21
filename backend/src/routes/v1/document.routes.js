const { documentService } = require('../../services/document.service')
const documentReader = require('../../services/document_reader.service')
const documentScan = require('../../services/document_scan.service')
const ai = require('../../services/ai')
const { MAX_FILE_BYTES } = require('../../constants/document_types')

const { assertSeafarerInScope, assertChildInScope, assertDocumentsInScope } = require('../../utils/scope')
const fs = require('fs')
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const seafarerParams = { type: 'object', required: ['seafarerId'], properties: { seafarerId: { type: 'integer', minimum: 1 } } }

// Giấy tờ AI đọc (A3): /api/v1/documents
async function documentRoutes(fastify) {
  const guard = { onRequest: [fastify.authenticate, fastify.can('seafarer.view', 'seafarer.docs')] }

  fastify.get('/status', { onRequest: [fastify.authenticate] }, async () => ({ ai_configured: documentReader.isConfigured(), ai: ai.describe() }))

  fastify.get('/seafarer/:seafarerId', { ...guard, schema: { params: seafarerParams } }, async (request) => {
    await assertSeafarerInScope(request, request.params.seafarerId)
    return {
      ai_configured: documentReader.isConfigured(),
      ai: ai.describe(),
      uploads: await documentService.listUploads(request.params.seafarerId),
      data: await documentService.list(request.params.seafarerId),
    }
  })

  // Quét nhanh một tệp để điền form: multipart gồm `file` và `kind` (auto | cccd | passport | seaman_book | diploma). Không lưu gì.
  fastify.post('/scan', guard, async (request) => {
    const part = await request.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } })
    if (!part) throw { statusCode: 400, message: 'Chưa chọn tệp' }
    const kind = part.fields?.kind?.value || 'auto'
    return documentScan.scan(part, kind)
  })

  fastify.post('/seafarer/:seafarerId', { ...guard, schema: { params: seafarerParams } }, async (request, reply) => {
    await assertSeafarerInScope(request, request.params.seafarerId)
    const file = await request.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } })
    if (!file) throw { statusCode: 400, message: 'Chưa chọn tệp' }
    const upload = await documentService.upload(request.params.seafarerId, file, request.user.id)
    return reply.code(upload.duplicate ? 200 : 201).send(upload)
  })

  fastify.get('/uploads/:id/file', { ...guard, schema: { params: idParams } }, async (request, reply) => {
    await assertChildInScope(request, 'upload', request.params.id)
    const upload = await documentService.uploadFile(request.params.id)
    reply.header('Content-Type', upload.mime_type)
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(upload.file_name)}`)
    return reply.send(fs.createReadStream(upload.storage_path))
  })

  fastify.get('/uploads/:id/pages/:pageNo/image', {
    ...guard,
    schema: {
      params: { type: 'object', required: ['id', 'pageNo'], properties: { id: { type: 'integer', minimum: 1 }, pageNo: { type: 'integer', minimum: 1 } } },
      querystring: { type: 'object', properties: { size: { type: 'string', enum: ['thumb', 'full'], default: 'full' } } },
    },
  }, async (request, reply) => {
    await assertChildInScope(request, 'upload', request.params.id)
    const file = await documentService.pageImage(request.params.id, request.params.pageNo, request.query.size)
    reply.header('Content-Type', 'image/jpeg')
    reply.header('Cache-Control', 'private, max-age=3600')
    return reply.send(fs.createReadStream(file))
  })

  fastify.post('/uploads/:id/regroup', {
    ...guard,
    schema: {
      params: idParams,
      body: {
        type: 'object',
        required: ['parts'],
        additionalProperties: false,
        properties: {
          parts: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['pageFrom', 'pageTo'],
              additionalProperties: false,
              properties: {
                pageFrom: { type: 'integer', minimum: 1 },
                pageTo: { type: 'integer', minimum: 1 },
                docType: { type: 'string', maxLength: 40 },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    await assertChildInScope(request, 'upload', request.params.id)
    return documentService.regroup(request.params.id, request.body.parts)
  })

  fastify.post('/uploads/:id/retry', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'upload', request.params.id)
    return documentService.retryUpload(request.params.id)
  })

  fastify.delete('/uploads/:id', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'upload', request.params.id)
    return documentService.removeUpload(request.params.id)
  })

  fastify.post('/seafarer/:seafarerId/publish', { ...guard, schema: { params: seafarerParams } }, async (request) => {
    await assertSeafarerInScope(request, request.params.seafarerId)
    return documentService.publish(request.params.seafarerId, request.user.id)
  })

  fastify.post('/certificates/confirm', {
    ...guard,
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        additionalProperties: false,
        properties: { ids: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'integer', minimum: 1 } } },
      },
    },
  }, async (request) => {
    await assertDocumentsInScope(request, request.body.ids)
    return documentService.confirmCertificates(request.body.ids, request.user.id)
  })

  fastify.get('/:id', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.get(request.params.id)
  })

  fastify.get('/:id/file', { ...guard, schema: { params: idParams } }, async (request, reply) => {
    await assertChildInScope(request, 'document', request.params.id)
    const doc = await documentService.fileOf(request.params.id)
    reply.header('Content-Type', doc.mime_type)
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`)
    return reply.send(fs.createReadStream(doc.storage_path))
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
  }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.decide(request.params.id, request.params.key, request.body.action, request.body.value, request.user.id)
  })

  fastify.put('/:id/type', {
    ...guard,
    schema: {
      params: idParams,
      body: { type: 'object', required: ['docType'], additionalProperties: false, properties: { docType: { type: 'string', maxLength: 40 } } },
    },
  }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.retype(request.params.id, request.body.docType)
  })

  fastify.post('/:id/accept-clear', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.acceptClear(request.params.id, request.user.id)
  })

  fastify.put('/:id/vessel', {
    ...guard,
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          vesselId: { type: ['integer', 'null'], minimum: 1 },
          status: { type: 'string', enum: ['NOT_CHECKED', 'MATCHED', 'NOT_FOUND'] },
        },
      },
    },
  }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.setVessel(request.params.id, request.body)
  })

  fastify.post('/:id/confirm-owner', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.confirmOwner(request.params.id, request.user.id)
  })

  fastify.post('/:id/retry', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.retry(request.params.id)
  })

  fastify.delete('/:id', { ...guard, schema: { params: idParams } }, async (request) => {
    await assertChildInScope(request, 'document', request.params.id)
    return documentService.remove(request.params.id)
  })
}

module.exports = documentRoutes
