const pool = require('../../config/db')
const { exportPackService } = require('../../services/export_pack.service')
const { TEMPLATE_KEYS, EXPORT_FORMATS } = require('../../constants/pack_templates')

const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')

const NOT_FOUND = 'Không tìm thấy bộ giấy'
const inputsSchema = { type: 'object', additionalProperties: { type: 'string', maxLength: 200 } }
// Ô sửa tay của một giấy: { 'B7': 'nội dung mới' }, hoặc mảng đoạn có định dạng [{ text, bold, italic, underline }]
const runSchema = {
  type: 'object', required: ['text'], additionalProperties: false,
  properties: { text: { type: 'string', maxLength: 2000 }, bold: { type: 'boolean' }, italic: { type: 'boolean' }, underline: { type: 'boolean' } },
}
const cellEditsSchema = {
  type: 'object', maxProperties: 200,
  additionalProperties: { anyOf: [{ type: 'array', maxItems: 50, items: runSchema }, { type: 'string', maxLength: 2000 }] },
}
// gridlines: file tải về có đường lưới ô hay không.
const gridlines = { type: 'boolean', default: false }
const packEditsSchema = { type: 'object', maxProperties: TEMPLATE_KEYS.length, additionalProperties: cellEditsSchema }
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const sendFile = (reply, { buffer, filename, contentType }) => reply
  .header('Content-Type', contentType)
  .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  .send(buffer)

// Bộ giấy tờ xuất: /api/v1/exports
async function exportPackRoutes(fastify) {
  const read = { onRequest: [fastify.authenticate, fastify.can('export.view')] }
  const write = { onRequest: [fastify.authenticate, fastify.can('export.create')] }
  const download = { onRequest: [fastify.authenticate, fastify.can('export.view', 'export.download')] }

  fastify.get('/templates', read, async () => exportPackService.templates())

  fastify.get('/', {
    ...read,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 100 },
          seafarer_id: { type: 'integer', minimum: 1 },
          ship_owner_id: { type: 'integer', minimum: 1 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request) => exportPackService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'export') }))

  fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => {
    await assertRecordInScope(request, 'export', request.params.id, NOT_FOUND)
    return exportPackService.get(pool, request.params.id)
  })

  fastify.post('/', {
    ...write,
    schema: {
      body: {
        type: 'object',
        required: ['seafarer_id', 'docs'],
        additionalProperties: false,
        properties: {
          seafarer_id: { type: 'integer', minimum: 1 },
          ship_owner_id: { type: ['integer', 'null'], minimum: 1 },
          docs: { type: 'array', minItems: 1, maxItems: TEMPLATE_KEYS.length, items: { type: 'string', enum: TEMPLATE_KEYS } },
          inputs: inputsSchema,
          edits: packEditsSchema,
        },
      },
    },
  }, async (request, reply) => reply.code(201).send(await exportPackService.create(pool, request.body, request.user)))

  // Xem trước chỉ dựng ra nội dung, không ghi gì; màn chi tiết bộ giấy (export.view) cũng dùng.
  fastify.post('/preview', {
    ...read,
    schema: {
      body: {
        type: 'object',
        required: ['template_key'],
        additionalProperties: false,
        properties: {
          seafarer_id: { type: ['integer', 'null'], minimum: 1 },
          ship_owner_id: { type: ['integer', 'null'], minimum: 1 },
          template_key: { type: 'string', enum: TEMPLATE_KEYS },
          inputs: inputsSchema,
          edits: cellEditsSchema,
        },
      },
    },
  }, async (request) => exportPackService.preview(request.body))

  fastify.put('/:id', {
    ...write,
    schema: { params: idParams, body: { type: 'object', additionalProperties: false, properties: { inputs: inputsSchema, edits: packEditsSchema } } },
  }, async (request) => {
    await assertRecordInScope(request, 'export', request.params.id, NOT_FOUND)
    return exportPackService.update(pool, request.params.id, request.body)
  })

  // Cả bộ trong một .zip (giải nén ra một thư mục): PDF, Excel, hoặc cả hai.
  fastify.get('/:id/download', {
    ...download,
    schema: { params: idParams, querystring: { type: 'object', properties: { format: { type: 'string', enum: [...EXPORT_FORMATS, 'all'], default: 'all' }, gridlines } } },
  }, async (request, reply) => {
    await assertRecordInScope(request, 'export', request.params.id, NOT_FOUND)
    const { buffer, filename } = await exportPackService.buildZip(pool, request.params.id, request.query.format, request.query.gridlines)
    return sendFile(reply, { buffer, filename, contentType: 'application/zip' })
  })

  // Một giấy của bộ: PDF hoặc Excel.
  fastify.get('/:id/docs/:key/download', {
    ...download,
    schema: {
      params: { type: 'object', required: ['id', 'key'], properties: { id: { type: 'integer', minimum: 1 }, key: { type: 'string', enum: TEMPLATE_KEYS } } },
      querystring: { type: 'object', properties: { format: { type: 'string', enum: EXPORT_FORMATS, default: 'pdf' }, gridlines } },
    },
  }, async (request, reply) => {
    await assertRecordInScope(request, 'export', request.params.id, NOT_FOUND)
    return sendFile(reply, await exportPackService.buildDoc(pool, request.params.id, request.params.key, request.query.format, request.query.gridlines))
  })
}

module.exports = { exportPackRoutes }
