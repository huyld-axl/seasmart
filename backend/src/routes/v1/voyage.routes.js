const pool = require('../../config/db')
const { voyageService } = require('../../services/voyage.service')
const { VOYAGE_DISPLAY_STATUSES } = require('../../constants/voyage_contract')
const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')

const NOT_FOUND = 'Không tìm thấy chuyến tàu'

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const listQuery = {
  type: 'object',
  properties: {
    tab: { type: 'string', enum: ['all', ...VOYAGE_DISPLAY_STATUSES] },
    search: { type: 'string', maxLength: 100 },
    ship_owner_id: { type: 'integer', minimum: 1 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const nullableDate = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const nullableInt = { type: ['integer', 'null'], minimum: 1 }
const money = { type: 'number', minimum: 0, maximum: 9999999999 }
const voyageBody = {
  type: 'object',
  required: ['vessel_id', 'ship_owner_id', 'planned_embark_date', 'planned_disembark_date', 'positions'],
  properties: {
    vessel_id: { type: 'integer', minimum: 1 },
    ship_owner_id: { type: 'integer', minimum: 1 },
    embark_port_id: nullableInt,
    disembark_port_id: nullableInt,
    planned_embark_date: date,
    planned_disembark_date: date,
    actual_embark_date: nullableDate,
    actual_disembark_date: nullableDate,
    notes: { type: ['string', 'null'], maxLength: 2000 },
    positions: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['rank_id', 'budget_total_usd', 'budget_monthly_usd'],
        properties: {
          id: { type: 'integer', minimum: 1 },
          rank_id: { type: 'integer', minimum: 1 },
          budget_total_usd: money,
          budget_monthly_usd: money,
        },
      },
    },
  },
}
const startBody = {
  type: 'object',
  required: ['actual_embark_date', 'embark_port_id'],
  properties: { actual_embark_date: date, embark_port_id: { type: 'integer', minimum: 1 } },
}
const endBody = {
  type: 'object',
  required: ['actual_disembark_date', 'disembark_port_id'],
  properties: { actual_disembark_date: date, disembark_port_id: { type: 'integer', minimum: 1 } },
}

async function voyageRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`voyage.${action}`)] })
  const inScope = (request) => assertRecordInScope(request, 'voyage', request.params.id, NOT_FOUND)

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    voyageService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'voyage') }))
  fastify.get('/:id', { ...can('view'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return voyageService.get(pool, request.params.id)
  })
  fastify.post('/', { ...can('create'), schema: { body: voyageBody } }, async (request, reply) => {
    const row = await voyageService.create(pool, request.body, request.user.id)
    return reply.code(201).send(row)
  })
  fastify.put('/:id', { ...can('update'), schema: { params: idParams, body: voyageBody } }, async (request) => {
    await inScope(request)
    return voyageService.update(pool, request.params.id, request.body, request.user.id)
  })
  fastify.delete('/:id', { ...can('delete'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return voyageService.softDelete(pool, request.params.id)
  })
  fastify.post('/:id/start', { ...can('run'), schema: { params: idParams, body: startBody } }, async (request) => {
    await inScope(request)
    return voyageService.transition(pool, request.params.id, 'start', request.body, request.user.id)
  })
  fastify.post('/:id/end', { ...can('run'), schema: { params: idParams, body: endBody } }, async (request) => {
    await inScope(request)
    return voyageService.transition(pool, request.params.id, 'end', request.body, request.user.id)
  })
}

module.exports = voyageRoutes
