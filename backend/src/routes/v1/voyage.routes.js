const pool = require('../../config/db')
const { voyageService } = require('../../services/voyage.service')
const { ownerIdFor, assertRecordInScope } = require('../../utils/scope')
const { MANUAL_REASONS, VOYAGE_SOURCES } = require('../../constants/opportunity_voyage')

const NOT_FOUND = 'Không tìm thấy chuyến tàu'

const id = { type: 'integer', minimum: 1 }
const nullableId = { type: ['integer', 'null'], minimum: 1 }
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const note = { type: ['string', 'null'], maxLength: 2000 }
const idParams = { type: 'object', required: ['id'], properties: { id } }
const rangeProps = { from: date, to: date, rank_id: id }
const listQuery = {
  type: 'object',
  properties: {
    tab: { type: 'string', enum: ['onboard', 'left', 'all'] },
    search: { type: 'string', maxLength: 100 },
    vessel_id: id,
    ship_owner_id: id,
    seafarer_id: id,
    source: { type: 'string', enum: VOYAGE_SOURCES },
    leaving_within: { type: 'integer', minimum: 0, maximum: 365 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    ...rangeProps,
  },
}
const createBody = {
  type: 'object',
  required: ['seafarer_id', 'rank_id', 'vessel_id', 'ship_owner_id', 'manual_reason', 'join_date', 'join_port_id', 'planned_leave_date'],
  properties: {
    seafarer_id: id,
    rank_id: id,
    vessel_id: id,
    ship_owner_id: id,
    manual_reason: { type: 'string', enum: MANUAL_REASONS },
    budget_monthly_usd: { type: ['number', 'null'], minimum: 0, maximum: 9999999999 },
    join_date: date,
    join_port_id: id,
    planned_leave_date: date,
    planned_leave_port_id: nullableId,
    notes: note,
    ended: { type: 'boolean' },
    leave_date: date,
    leave_port_id: id,
    leave_note: note,
  },
}
const datesBody = { type: 'object', minProperties: 1, properties: { join_date: date, join_port_id: id, leave_date: date, leave_port_id: id } }
const leavePlanBody = { type: 'object', required: ['planned_leave_date'], properties: { planned_leave_date: date, note } }
const leaveProps = { leave_date: date, leave_port_id: id, leave_note: note }
const leaveBody = { type: 'object', required: ['leave_date', 'leave_port_id'], properties: leaveProps }
const leaveManyBody = {
  type: 'object',
  required: ['voyage_ids', 'leave_date', 'leave_port_id'],
  properties: { voyage_ids: { type: 'array', minItems: 1, maxItems: 50, items: id }, ...leaveProps },
}
const deleteBody = { type: ['object', 'null'], properties: { note } }

async function voyageRoutes(fastify) {
  const can = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`voyage.${action}`)] })
  const inScope = (request) => assertRecordInScope(request, 'voyage', request.params.id, NOT_FOUND)

  fastify.get('/', { ...can('view'), schema: { querystring: listQuery } }, async (request) =>
    voyageService.list(pool, { ...request.query, ownerId: ownerIdFor(request, 'voyage') }))

  // Thẻ Đội ngũ trên trang tàu.
  fastify.get('/crew-timeline', {
    onRequest: [fastify.authenticate, fastify.can('voyage.view'), fastify.can('vessel.view')],
    schema: { querystring: { type: 'object', required: ['vessel_id'], properties: { vessel_id: id, ...rangeProps } } },
  }, async (request) => voyageService.crewTimeline(pool, { ...request.query, ownerId: ownerIdFor(request, 'voyage') }))

  // Ghi rời tàu nhiều chuyến một lần (mỗi chuyến phải trong phạm vi).
  fastify.post('/leave', { ...can('run'), schema: { body: leaveManyBody } }, async (request) => {
    for (const voyageId of request.body.voyage_ids) await assertRecordInScope(request, 'voyage', voyageId, NOT_FOUND)
    return voyageService.leaveMany(pool, request.body, request.user.id)
  })

  fastify.get('/:id', { ...can('view'), schema: { params: idParams } }, async (request) => {
    await inScope(request)
    return voyageService.get(pool, request.params.id)
  })
  fastify.post('/', { ...can('create'), schema: { body: createBody } }, async (request, reply) => {
    const row = await voyageService.create(pool, request.body, request.user.id)
    return reply.code(201).send(row)
  })
  fastify.patch('/:id/dates', { ...can('update'), schema: { params: idParams, body: datesBody } }, async (request) => {
    await inScope(request)
    return voyageService.editDates(pool, request.params.id, request.body, request.user.id)
  })
  fastify.post('/:id/leave-plan', { ...can('update'), schema: { params: idParams, body: leavePlanBody } }, async (request) => {
    await inScope(request)
    return voyageService.leavePlan(pool, request.params.id, request.body, request.user.id)
  })
  fastify.post('/:id/leave', { ...can('run'), schema: { params: idParams, body: leaveBody } }, async (request) => {
    await inScope(request)
    return voyageService.leave(pool, request.params.id, request.body, request.user.id)
  })
  fastify.delete('/:id', { ...can('delete'), schema: { params: idParams, body: deleteBody } }, async (request) => {
    await inScope(request)
    return voyageService.remove(pool, request.params.id, request.body, request.user.id)
  })
}

module.exports = voyageRoutes
