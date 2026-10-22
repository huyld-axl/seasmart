const pool = require('../../config/db')
const { contractBillService } = require('../../services/contract_bill.service')
const { BILL_DISPLAY_STATUSES } = require('../../constants/voyage_contract')
const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')

const NOT_FOUND = 'Không tìm thấy yêu cầu thanh toán'

const id = { type: 'integer', minimum: 1 }
const idParams = { type: 'object', required: ['id'], properties: { id } }
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const listQuery = {
  type: 'object',
  properties: {
    tab: { type: 'string', enum: ['all', ...BILL_DISPLAY_STATUSES] },
    search: { type: 'string', maxLength: 100 },
    ship_owner_id: id,
    voyage_id: id,
    contract_id: id,
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const updateBody = {
  type: 'object',
  required: ['items'],
  properties: {
    note: { type: ['string', 'null'], maxLength: 2000 },
    due_date: date,
    items: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        required: ['amount_usd'],
        properties: {
          id,
          name: { type: ['string', 'null'], maxLength: 100 },
          amount_usd: { type: 'number', minimum: -9999999999, maximum: 9999999999 },
        },
      },
    },
  },
}
const collectBody = { type: 'object', properties: { paid_date: date } }

async function contractBillRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`bill.${action}`)] })
  const inScope = (request) => assertRecordInScope(request, 'bill', request.params.id, NOT_FOUND)

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    contractBillService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'bill') }))
  fastify.get('/:id', { ...can('view'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return contractBillService.get(pool, request.params.id)
  })
  fastify.put('/:id', { ...can('update'), schema: { params: idParams, body: updateBody } }, async (request) => {
    await inScope(request)
    return contractBillService.update(pool, request.params.id, request.body, request.user.id)
  })
  const perm = { send: 'send', unsend: 'send', collect: 'collect', uncollect: 'collect' }
  for (const action of Object.keys(perm)) {
    const schema = action === 'collect' ? { body: collectBody } : {}
    fastify.post(`/:id/${action}`, { ...can(perm[action]), schema: { params: idParams, ...schema } }, async (request) => {
      await inScope(request)
      return contractBillService.transition(pool, request.params.id, action, request.body || {}, request.user.id)
    })
  }
}

module.exports = contractBillRoutes
