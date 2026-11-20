const pool = require('../../config/db')
const { payoutService } = require('../../services/payout.service')
const { DEFAULT_ITEMS } = require('../../constants/voyage_contract')
const { ownerIdFor } = require('../../utils/scope')

const id = { type: 'integer', minimum: 1 }
const money = { type: 'number', minimum: 0, maximum: 9999999999 }
const listQuery = {
  type: 'object',
  required: ['month'],
  properties: {
    month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
    tab: { type: 'string', enum: ['all', 'UNPAID', 'PAID'] },
    search: { type: 'string', maxLength: 100 },
    ship_owner_id: id,
  },
}
const payBody = {
  type: 'object',
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        required: ['bill_id', 'amounts'],
        properties: {
          bill_id: id,
          version: { type: ['integer', 'null'] },
          amounts: {
            type: 'object',
            required: DEFAULT_ITEMS.map((item) => item.code),
            additionalProperties: false,
            properties: Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, money])),
          },
        },
      },
    },
  },
}
const unpayBody = { type: ['object', 'null'], properties: { version: { type: ['integer', 'null'] } } }

// Trả lương thuyền viên (docs/mcah-ke-hoach-tra-luong.md phần B). Phạm vi dữ liệu theo người tạo bill gốc.
async function payoutRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`payout.${action}`)] })

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    payoutService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'payout') }))
  fastify.post('/pay', { ...can('pay'), schema: { body: payBody } }, async (request) =>
    payoutService.pay(pool, request.body.rows, request.user.id, ownerIdFor(request, 'payout')))
  fastify.post('/:id/unpay', { ...can('pay'), schema: { params: { type: 'object', required: ['id'], properties: { id } }, body: unpayBody } }, async (request) =>
    payoutService.unpay(pool, request.params.id, request.body?.version, request.user.id, ownerIdFor(request, 'payout')))
}

module.exports = payoutRoutes
