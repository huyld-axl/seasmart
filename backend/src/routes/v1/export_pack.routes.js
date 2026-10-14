const pool = require('../../config/db')
const { exportPackService } = require('../../services/export_pack.service')
const { TEMPLATE_KEYS, EXPORT_FORMATS } = require('../../constants/pack_templates')

const CREATE_ROLES = ['admin', 'operator']
const REVIEW_ROLES = ['admin', 'operator', 'reviewer']

const requireRole = (roles) => async (request, reply) => {
  if (!roles.includes(request.user?.role)) return reply.code(403).send({ error: 'Không có quyền' })
}
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
  const read = { onRequest: [fastify.authenticate, requireRole(REVIEW_ROLES)] }

  fastify.get('/templates', read, async () => exportPackService.templates())

  fastify.get('/', {
    ...read,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 100 },
          seafarer_id: { type: 'integer', minimum: 1 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request) => exportPackService.list(pool, request.query))

  fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => exportPackService.get(pool, request.params.id))

  fastify.post('/', {
    onRequest: [fastify.authenticate, requireRole(CREATE_ROLES)],
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
    onRequest: [fastify.authenticate, requireRole(CREATE_ROLES)],
    schema: { params: idParams, body: { type: 'object', additionalProperties: false, properties: { inputs: inputsSchema, edits: packEditsSchema } } },
  }, async (request) => exportPackService.update(pool, request.params.id, request.body))

  // Cả bộ trong một .zip (giải nén ra một thư mục): PDF, Excel, hoặc cả hai.
  fastify.get('/:id/download', {
    ...read,
    schema: { params: idParams, querystring: { type: 'object', properties: { format: { type: 'string', enum: [...EXPORT_FORMATS, 'all'], default: 'all' }, gridlines } } },
  }, async (request, reply) => {
    const { buffer, filename } = await exportPackService.buildZip(pool, request.params.id, request.query.format, request.query.gridlines)
    return sendFile(reply, { buffer, filename, contentType: 'application/zip' })
  })

  // Một giấy của bộ: PDF hoặc Excel.
  fastify.get('/:id/docs/:key/download', {
    ...read,
    schema: {
      params: { type: 'object', required: ['id', 'key'], properties: { id: { type: 'integer', minimum: 1 }, key: { type: 'string', enum: TEMPLATE_KEYS } } },
      querystring: { type: 'object', properties: { format: { type: 'string', enum: EXPORT_FORMATS, default: 'pdf' }, gridlines } },
    },
  }, async (request, reply) => sendFile(reply, await exportPackService.buildDoc(pool, request.params.id, request.params.key, request.query.format, request.query.gridlines)))
}

module.exports = { exportPackRoutes }
