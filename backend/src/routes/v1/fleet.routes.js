const pool = require('../../config/db')
const { fleetService } = require('../../services/fleet.service')

const EDITOR_ROLES = ['admin', 'operator']

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const listQuery = {
  type: 'object',
  properties: { search: { type: 'string', maxLength: 100 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } },
}
const nullableInt = { type: ['integer', 'null'], minimum: 1 }
const nullableText = (maxLength) => ({ type: ['string', 'null'], maxLength })
const vesselBody = {
  type: 'object',
  properties: {
    vessel_name: { type: 'string', minLength: 1, maxLength: 150 },
    imo_number: { type: ['string', 'null'], pattern: '^(\\d{7})?$' },
    vessel_type_id: nullableInt,
    flag_country_id: nullableInt,
    ship_owner_id: nullableInt,
    gross_tonnage: { type: ['number', 'null'], minimum: 0 },
    deadweight: { type: ['number', 'null'], minimum: 0 },
    year_built: { type: ['integer', 'null'], minimum: 1900, maximum: 2100 },
    notes: nullableText(2000),
  },
}
const ownerBody = {
  type: 'object',
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 30 },
    company_name: { type: 'string', minLength: 1, maxLength: 200 },
    company_name_en: nullableText(200),
    country_id: nullableInt,
    address: nullableText(500),
    contact_person: nullableText(150),
    contact_phone: nullableText(30),
    contact_email: nullableText(150),
    notes: nullableText(2000),
  },
}

async function requireEditor(request, reply) {
  if (!EDITOR_ROLES.includes(request.user?.role)) {
    return reply.code(403).send({ error: 'Không có quyền' })
  }
}

// Một bộ CRUD có xoá mềm và khôi phục cho tàu hoặc chủ tàu
function crudRoutes({ table, list, get, create, update }) {
  return async function (fastify) {
    const read = { onRequest: [fastify.authenticate] }
    const write = { onRequest: [fastify.authenticate, requireEditor] }

    fastify.get('/', { ...read, schema: { querystring: listQuery } }, async (request) => list(pool, request.query))
    fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => get(pool, request.params.id))
    fastify.post('/', { ...write, schema: { body: { ...create.schema, required: create.required } } }, async (request, reply) => {
      const row = await create.fn(pool, request.body)
      return reply.code(201).send(row)
    })
    fastify.put('/:id', { ...write, schema: { params: idParams, body: update.schema } }, async (request) => update.fn(pool, request.params.id, request.body))
    fastify.delete('/:id', { ...write, schema: { params: idParams } }, async (request) => fleetService.softDelete(pool, table, request.params.id))
    fastify.post('/:id/restore', { ...write, schema: { params: idParams } }, async (request) => fleetService.restore(pool, table, request.params.id))
  }
}

async function fleetRoutes(fastify) {
  fastify.register(
    crudRoutes({
      table: 'vessel',
      list: (db, query) => fleetService.listVessels(db, query),
      get: (db, id) => fleetService.getVessel(db, id),
      create: { schema: vesselBody, required: ['vessel_name'], fn: (db, body) => fleetService.createVessel(db, body) },
      update: { schema: vesselBody, fn: (db, id, body) => fleetService.updateVessel(db, id, body) },
    }),
    { prefix: '/vessels' }
  )
  fastify.register(
    crudRoutes({
      table: 'ship_owner',
      list: (db, query) => fleetService.listOwners(db, query),
      get: (db, id) => fleetService.getOwner(db, id),
      create: { schema: ownerBody, required: ['code', 'company_name'], fn: (db, body) => fleetService.createOwner(db, body) },
      update: { schema: ownerBody, fn: (db, id, body) => fleetService.updateOwner(db, id, body) },
    }),
    { prefix: '/ship-owners' }
  )
}

module.exports = fleetRoutes
