const pool = require('../../config/db')
const { seafarerContractService } = require('../../services/seafarer_contract.service')
const {
  CONTRACT_STATUSES, VOYAGE_EDITOR_ROLES, CLOSING_DAYS, PAY_DAYS, PAY_MONTH_OFFSETS, HOLIDAY_RULES,
} = require('../../constants/voyage_contract')

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const id = { type: 'integer', minimum: 1 }
const listQuery = {
  type: 'object',
  properties: {
    tab: { type: 'string', enum: ['all', ...CONTRACT_STATUSES] },
    search: { type: 'string', maxLength: 100 },
    ship_owner_id: id,
    voyage_id: id,
    seafarer_id: id,
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const amount = { type: ['number', 'null'], minimum: 0, maximum: 9999999999 }
const termSide = {
  type: 'object',
  properties: {
    closing_day: { type: 'integer', enum: CLOSING_DAYS },
    pay_day: { type: 'integer', enum: PAY_DAYS },
    pay_month_offset: { type: 'integer', enum: PAY_MONTH_OFFSETS },
    holiday_rule: { type: 'string', enum: HOLIDAY_RULES },
  },
}
const contractProps = {
  seafarer_id: id,
  start_date: date,
  end_date: date,
  notes: { type: ['string', 'null'], maxLength: 2000 },
  items: {
    type: 'array',
    maxItems: 40,
    items: {
      type: 'object',
      properties: {
        item_code: { type: ['string', 'null'], maxLength: 30 },
        custom_name: { type: ['string', 'null'], maxLength: 100 },
        kind: { type: 'string', enum: ['MONTHLY', 'ONE_TIME'] },
        receivable_usd: amount,
        payable_usd: amount,
      },
    },
  },
  terms: { type: 'object', properties: { RECEIVABLE: termSide, PAYABLE: termSide } },
}
const createBody = {
  type: 'object',
  required: ['voyage_position_id', 'seafarer_id', 'start_date', 'end_date'],
  properties: { voyage_position_id: id, ...contractProps },
}
const updateBody = { type: 'object', required: ['seafarer_id', 'start_date', 'end_date'], properties: contractProps }
const rejectBody = { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 1, maxLength: 1000 } } }
const approveBody = { type: 'object', properties: { move_onboard: { type: 'boolean' } } }

async function requireEditor(request, reply) {
  if (!VOYAGE_EDITOR_ROLES.includes(request.user?.role)) {
    return reply.code(403).send({ error: 'Không có quyền' })
  }
}

async function seafarerContractRoutes(fastify) {
  // Hợp đồng chứa số phải thu nội bộ: đọc cũng chỉ cho vai trò nội bộ.
  const read = { onRequest: [fastify.authenticate, requireEditor] }
  const write = { onRequest: [fastify.authenticate, requireEditor] }

  fastify.get('/', { ...read, schema: { querystring: listQuery } }, async (request) => seafarerContractService.list(pool, request.query))
  fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => seafarerContractService.get(pool, request.params.id))
  fastify.post('/', { ...write, schema: { body: createBody } }, async (request, reply) => {
    const row = await seafarerContractService.create(pool, request.body, request.user.id)
    return reply.code(201).send(row)
  })
  fastify.put('/:id', { ...write, schema: { params: idParams, body: updateBody } }, async (request) =>
    seafarerContractService.update(pool, request.params.id, request.body, request.user.id))
  fastify.delete('/:id', { ...write, schema: { params: idParams } }, async (request) => seafarerContractService.softDelete(pool, request.params.id))
  for (const [action, schema] of [['submit', {}], ['withdraw', {}], ['reject', { body: rejectBody }], ['approve', { body: approveBody }]]) {
    fastify.post(`/:id/${action}`, { ...write, schema: { params: idParams, ...schema } }, async (request) =>
      seafarerContractService.transition(pool, request.params.id, action, request.body || {}, request.user.id))
  }
}

module.exports = seafarerContractRoutes
