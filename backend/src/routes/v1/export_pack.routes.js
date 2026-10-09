const pool = require('../../config/db')
const { exportPackService } = require('../../services/export_pack.service')
const { smsService } = require('../../services/sms.service')
const { TEMPLATE_KEYS, PACK_STATUS } = require('../../constants/pack_templates')

const CREATE_ROLES = ['admin', 'operator']
const REVIEW_ROLES = ['admin', 'operator', 'reviewer']
const approve = (fastify) => ({ onRequest: [fastify.authenticate, requireRole(['admin', 'reviewer'])] })

const requireRole = (roles) => async (request, reply) => {
  if (!roles.includes(request.user?.role)) return reply.code(403).send({ error: 'Không có quyền' })
}
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }

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
          status: { type: 'string', enum: PACK_STATUS },
          search: { type: 'string', maxLength: 100 },
          seafarer_id: { type: 'integer', minimum: 1 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request) => exportPackService.list(pool, request.query))

  fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => exportPackService.get(pool, request.params.id, request.user))

  fastify.post('/', {
    onRequest: [fastify.authenticate, requireRole(CREATE_ROLES)],
    schema: {
      body: {
        type: 'object',
        required: ['seafarer_id', 'docs'],
        additionalProperties: false,
        properties: {
          seafarer_id: { type: 'integer', minimum: 1 },
          docs: { type: 'array', minItems: 1, maxItems: TEMPLATE_KEYS.length, items: { type: 'string', enum: TEMPLATE_KEYS } },
          inputs: { type: 'object', additionalProperties: { type: 'string', maxLength: 200 } },
        },
      },
    },
  }, async (request, reply) => reply.code(201).send(await exportPackService.create(pool, request.body, request.user)))

  fastify.post('/:id/approve', { ...approve(fastify), schema: { params: idParams } }, async (request) => exportPackService.approve(pool, request.params.id, request.user))

  fastify.post('/:id/reject', {
    ...approve(fastify),
    schema: { params: idParams, body: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 1, maxLength: 500 } } } },
  }, async (request) => exportPackService.reject(pool, request.params.id, request.body.reason, request.user))

  fastify.post('/:id/sign', {
    ...read,
    schema: { params: idParams, body: { type: 'object', required: ['signer'], additionalProperties: false, properties: { signer: { type: 'string', minLength: 1, maxLength: 50 } } } },
  }, async (request) => exportPackService.signInApp(pool, request.params.id, request.body.signer, request.user))

  fastify.get('/sms', read, async () => ({ configured: smsService.isConfigured() }))

  fastify.post('/:id/sms', {
    ...read,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: { params: idParams },
  }, async (request) => exportPackService.sendSignSms(pool, request.params.id))

  fastify.get('/:id/download', { ...read, schema: { params: idParams } }, async (request, reply) => {
    const { buffer, filename } = await exportPackService.buildZip(pool, request.params.id)
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(buffer)
  })
}

// Link ký của thuyền viên: không đăng nhập, khoá bằng token 64 ký tự, giới hạn số lần gọi.
async function publicSignRoutes(fastify) {
  const tokenParams = { type: 'object', required: ['token'], properties: { token: { type: 'string', pattern: '^[a-f0-9]{64}$' } } }
  fastify.get('/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { params: tokenParams } },
    async (request) => exportPackService.getByToken(pool, request.params.token))
  fastify.post('/:token', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    bodyLimit: 600 * 1024,
    schema: {
      params: tokenParams,
      body: { type: 'object', required: ['image', 'agreed'], additionalProperties: false, properties: { image: { type: 'string', maxLength: 450000 }, agreed: { type: 'boolean' } } },
    },
  }, async (request) => exportPackService.signByToken(pool, request.params.token, request.body, request.ip))
}

module.exports = { exportPackRoutes, publicSignRoutes }
