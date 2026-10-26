const pool = require('../../config/db')
const { opportunityService } = require('../../services/opportunity.service')
const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')

const NOT_FOUND = 'Không tìm thấy cơ hội'

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const rankParams = { type: 'object', required: ['rankId'], properties: { rankId: { type: 'integer', minimum: 1 } } }
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const id = { type: 'integer', minimum: 1 }
const nullableId = { type: ['integer', 'null'], minimum: 1 }
const money = { type: ['number', 'null'], minimum: 0, maximum: 9999999999 }
const listQuery = {
  type: 'object',
  properties: {
    tab: { type: 'string', enum: ['open', 'won', 'lost', 'cancelled', 'all'] },
    search: { type: 'string', maxLength: 100 },
    vessel_id: id,
    ship_owner_id: id,
    rank_id: id,
    owner_user_id: id,
    deadline_before: date,
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const requirement = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: ['CERTIFICATE', 'EXPERIENCE', 'TEMPLATE'] },
    certificate_type_id: nullableId,
    rank_id: nullableId,
    vessel_type_id: nullableId,
    min_months: { type: ['integer', 'null'], minimum: 1, maximum: 600 },
    min_trips: { type: ['integer', 'null'], minimum: 1, maximum: 200 },
    template_key: { type: ['string', 'null'], maxLength: 20 },
    level: { type: 'string', enum: ['REQUIRED', 'PREFERRED'] },
    valid_until: { type: 'string', enum: ['JOIN', 'LEAVE', 'LEAVE_PLUS', 'ANY'] },
    plus_months: { type: ['integer', 'null'], minimum: 1, maximum: 60 },
  },
}
const requirements = { type: 'array', maxItems: 60, items: requirement }
const opportunityProps = {
  ship_owner_id: id,
  vessel_id: nullableId,
  rank_id: id,
  budget_monthly_usd: money,
  budget_total_usd: money,
  planned_join_date: date,
  planned_join_port_id: nullableId,
  planned_leave_date: date,
  planned_leave_port_id: nullableId,
  deadline: date,
  owner_user_id: nullableId,
  notes: { type: ['string', 'null'], maxLength: 2000 },
  requirements,
}
const createBody = {
  type: 'object',
  required: ['ship_owner_id', 'rank_id', 'planned_join_date', 'planned_leave_date', 'deadline'],
  anyOf: [{ required: ['budget_monthly_usd'] }, { required: ['budget_total_usd'] }],
  properties: opportunityProps,
}
const updateBody = { type: 'object', properties: opportunityProps }
const closeBody = {
  type: 'object',
  required: ['outcome'],
  properties: { outcome: { type: 'string', enum: ['LOST', 'CANCELLED'] }, reason: { type: ['string', 'null'], maxLength: 1000 } },
}

async function opportunityRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`opportunity.${action}`)] })
  const inScope = (request) => assertRecordInScope(request, 'opportunity', request.params.id, NOT_FOUND)

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    opportunityService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'opportunity') }))

  // Hồ sơ yêu cầu điền sẵn theo tàu + chức danh, và lưu mẫu theo chức danh.
  fastify.get('/requirement-presets', {
    ...can('create'),
    schema: { querystring: { type: 'object', properties: { vessel_id: id, rank_id: id } } },
  }, async (request) => opportunityService.presets(pool, request.query))
  fastify.put('/requirement-presets/:rankId', {
    ...can('update'),
    schema: { params: rankParams, body: { type: 'object', required: ['requirements'], properties: { requirements } } },
  }, async (request) => opportunityService.savePreset(pool, request.params.rankId, request.body))

  fastify.get('/:id', { ...can('view'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return opportunityService.get(pool, request.params.id)
  })
  fastify.post('/', { ...can('create'), schema: { body: createBody } }, async (request, reply) => {
    const row = await opportunityService.create(pool, request.body, request.user.id)
    return reply.code(201).send(row)
  })
  fastify.put('/:id', { ...can('update'), schema: { params: idParams, body: updateBody } }, async (request) => {
    await inScope(request)
    return opportunityService.update(pool, request.params.id, request.body, request.user.id)
  })
  fastify.post('/:id/duplicate', {
    ...can('create'),
    schema: { params: idParams, body: { type: ['object', 'null'], properties: { rank_id: id } } },
  }, async (request, reply) => {
    await inScope(request)
    const row = await opportunityService.duplicate(pool, request.params.id, request.body, request.user.id)
    return reply.code(201).send(row)
  })
  fastify.post('/:id/close', { ...can('close'), schema: { params: idParams, body: closeBody } }, async (request) => {
    await inScope(request)
    return opportunityService.close(pool, request.params.id, request.body, request.user.id)
  })
  fastify.post('/:id/reopen', { ...can('close'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return opportunityService.reopen(pool, request.params.id, request.user.id)
  })
  fastify.delete('/:id', { ...can('close'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return opportunityService.remove(pool, request.params.id)
  })
}

module.exports = opportunityRoutes
