const fs = require('fs')
const config = require('../../config')
const pool = require('../../config/db')
const { fleetService, VESSEL_STATUSES } = require('../../services/fleet.service')

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const listQuery = {
  type: 'object',
  properties: {
    search: { type: 'string', maxLength: 100 },
    status: { type: 'string', enum: VESSEL_STATUSES },
    active: { type: 'string', enum: ['0', '1'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const nullableInt = { type: ['integer', 'null'], minimum: 1 }
const nullableText = (maxLength) => ({ type: ['string', 'null'], maxLength })
const nullableNumber = { type: ['number', 'null'], minimum: 0 }
const nullableCount = { type: ['integer', 'null'], minimum: 0 }
const flag = { type: 'integer', enum: [0, 1] }
const vesselBody = {
  type: 'object',
  properties: {
    vessel_name: { type: 'string', minLength: 1, maxLength: 150 },
    vessel_name_prev: nullableText(150),
    imo_number: { type: ['string', 'null'], pattern: '^(\\d{7})?$' },
    call_sign: nullableText(10),
    mmsi: { type: ['string', 'null'], pattern: '^(\\d{9})?$' },
    vessel_type_id: nullableInt,
    flag_country_id: nullableInt,
    year_built: { type: ['integer', 'null'], minimum: 1900, maximum: 2100 },
    port_of_registry_id: nullableInt,
    classification_society: nullableText(50),
    status: { type: 'string', enum: VESSEL_STATUSES },
    class_status: { type: ['string', 'null'], enum: ['IN_CLASS', 'SUSPENDED', 'WITHDRAWN', 'UNCLASSED', null] },
    gross_tonnage: nullableNumber,
    net_tonnage: nullableNumber,
    deadweight: nullableNumber,
    length_overall: nullableNumber,
    passenger_capacity: nullableCount,
    crew_capacity: nullableCount,
    engine_power_kw: nullableNumber,
    engine_type: nullableText(100),
    dp_class: { type: ['string', 'null'], enum: ['NONE', 'DP1', 'DP2', 'DP3', null] },
    has_boiler: flag,
    has_refrigeration: flag,
    ship_owner_id: nullableInt,
    technical_manager: nullableText(200),
    commercial_manager: nullableText(200),
    notes: nullableText(500),
  },
}
const ownerBody = {
  type: 'object',
  properties: {
    company_name: { type: 'string', minLength: 1, maxLength: 200 },
    company_name_en: nullableText(200),
    country_id: nullableInt,
    tax_id: nullableText(50),
    address: nullableText(500),
    phone: nullableText(30),
    fax: nullableText(30),
    email: nullableText(150),
    website: nullableText(200),
    contact_person: nullableText(150),
    contact_phone: nullableText(30),
    contact_email: nullableText(150),
    is_active: flag,
    notes: nullableText(2000),
  },
}

// Một bộ CRUD có xoá mềm và khôi phục cho tàu hoặc đối tác. `extra` thêm các route chỉ đọc riêng.
// `perm`: mục quyền (vessel | partner).
function crudRoutes({ table, perm, list, get, create, update, extra }) {
  return async function (fastify) {
    const read = { onRequest: [fastify.authenticate, fastify.can(`${perm}.view`)] }
    const onRequest = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`${perm}.${action}`)] })

    fastify.get('/', { ...read, schema: { querystring: listQuery } }, async (request) => list(pool, request.query))
    fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => get(pool, request.params.id))
    if (extra) extra(fastify, { read, idParams })
    fastify.post('/', { ...onRequest('create'), schema: { body: { ...create.schema, required: create.required } } }, async (request, reply) => {
      const row = await create.fn(pool, request.body)
      return reply.code(201).send(row)
    })
    fastify.put('/:id', { ...onRequest('update'), schema: { params: idParams, body: update.schema } }, async (request) => update.fn(pool, request.params.id, request.body))
    fastify.delete('/:id', { ...onRequest('delete'), schema: { params: idParams } }, async (request) => fleetService.softDelete(pool, table, request.params.id))
    fastify.post('/:id/restore', { ...onRequest('update'), schema: { params: idParams } }, async (request) => fleetService.restore(pool, table, request.params.id))
  }
}

async function fleetRoutes(fastify) {
  fastify.register(
    crudRoutes({
      table: 'vessel',
      perm: 'vessel',
      list: (db, query) => fleetService.listVessels(db, query),
      get: (db, id) => fleetService.getVesselDetail(db, id),
      create: { schema: vesselBody, required: ['vessel_name'], fn: (db, body) => fleetService.createVessel(db, body) },
      update: { schema: vesselBody, fn: (db, id, body) => fleetService.updateVessel(db, id, body) },
      extra: (app, { read, idParams: params }) => {
        app.get('/:id/service', { ...read, schema: { params } }, async (request) => fleetService.listVesselService(pool, request.params.id))
      },
    }),
    { prefix: '/vessels' }
  )
  fastify.register(
    crudRoutes({
      table: 'ship_owner',
      perm: 'partner',
      list: (db, query) => fleetService.listOwners(db, query),
      get: (db, id) => fleetService.getOwnerDetail(db, id),
      create: { schema: ownerBody, required: ['company_name'], fn: (db, body) => fleetService.createOwner(db, body) },
      update: { schema: ownerBody, fn: (db, id, body) => fleetService.updateOwner(db, id, body) },
      extra: (app, { read, idParams: params }) => {
        const write = { onRequest: [app.authenticate, app.can('partner.update')] }
        // Logo công ty: GET trả ảnh, POST (multipart, field "file") thay logo, DELETE gỡ logo.
        app.get('/:id/logo', { ...read, schema: { params } }, async (request, reply) => {
          const logo = await fleetService.getOwnerLogo(pool, request.params.id)
          reply.header('Content-Type', logo.mime)
          reply.header('Cache-Control', 'private, no-cache')
          return reply.send(fs.createReadStream(logo.path))
        })
        app.post('/:id/logo', { ...write, schema: { params } }, async (request) => {
          const file = await request.file({ limits: { fileSize: config.upload.maxFileSize, files: 1 } })
          if (!file) throw { statusCode: 400, message: 'Chưa chọn logo' }
          return fleetService.saveOwnerLogo(pool, request.params.id, file)
        })
        app.delete('/:id/logo', { ...write, schema: { params } }, async (request) => fleetService.removeOwnerLogo(pool, request.params.id))
      },
    }),
    { prefix: '/ship-owners' }
  )
}

module.exports = fleetRoutes
