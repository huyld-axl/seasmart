const pool = require('../../config/db')
const { seafarerContractService } = require('../../services/seafarer_contract.service')
const {
  CONTRACT_STATUSES, CLOSING_DAYS, PAY_DAYS, PAY_MONTH_OFFSETS, HOLIDAY_RULES,
} = require('../../constants/voyage_contract')
const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')

const NOT_FOUND = 'Không tìm thấy hợp đồng'

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
const approveBody = { type: ['object', 'null'], properties: {} }

async function seafarerContractRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`contract.${action}`)] })
  const inScope = (request) => assertRecordInScope(request, 'contract', request.params.id, NOT_FOUND)

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    seafarerContractService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'contract') }))
  fastify.get('/:id', { ...can('view'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return seafarerContractService.get(pool, request.params.id)
  })
  // Giai đoạn 1: khoá tạo hợp đồng mới tới khi hợp đồng gắn với chuyến (giai đoạn 2). Giữ service create để làm tiếp.
  fastify.post('/', { ...can('create'), schema: { body: createBody } }, async () => {
    throw { statusCode: 409, message: 'Tạm khoá tạo hợp đồng mới. Hợp đồng sẽ gắn với chuyến ở giai đoạn 2.' }
  })
  fastify.put('/:id', { ...can('update'), schema: { params: idParams, body: updateBody } }, async (request) => {
    await inScope(request)
    return seafarerContractService.update(pool, request.params.id, request.body, request.user.id)
  })
  fastify.delete('/:id', { ...can('delete'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return seafarerContractService.softDelete(pool, request.params.id)
  })
  const transitionPerm = { submit: 'submit', withdraw: 'submit', reject: 'approve', approve: 'approve' }
  for (const [action, schema] of [['submit', {}], ['withdraw', {}], ['reject', { body: rejectBody }], ['approve', { body: approveBody }]]) {
    fastify.post(`/:id/${action}`, { ...can(transitionPerm[action]), schema: { params: idParams, ...schema } }, async (request) => {
      await inScope(request)
      return seafarerContractService.transition(pool, request.params.id, action, request.body || {}, request.user.id)
    })
  }
}

module.exports = seafarerContractRoutes
