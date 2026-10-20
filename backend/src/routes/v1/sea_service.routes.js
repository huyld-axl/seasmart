const seaServiceService = require('../../services/sea_service.service')

const { assertSeafarerInScope, assertChildInScope } = require('../../utils/scope')

const text = (max) => ({ type: ['string', 'null'], maxLength: max })
const date = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }

const tripProperties = {
  vessel_name_raw: text(150),
  vessel_type_raw: text(100),
  flag_raw: text(100),
  gross_tonnage_raw: text(50),
  engine_power_raw: text(50),
  owner_raw: text(200),
  vessel_id: { type: ['integer', 'null'], minimum: 1 },
  vessel_match_status: { type: 'string', enum: ['NOT_CHECKED', 'MATCHED', 'NOT_FOUND'] },
  rank_raw: text(100),
  rank_id: { type: ['integer', 'null'], minimum: 1 },
  coc_number: text(100),
  sign_on_date: date,
  sign_on_port: text(150),
  sign_off_date: date,
  sign_off_port: text(150),
  notes: text(2000),
}

// Lịch sử đi tàu của một thuyền viên: /api/v1/seafarers/:seafarerId/sea-services
async function seafarerSeaServiceRoutes(fastify) {
  fastify.get('/', {
    onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    schema: { params: { type: 'object', required: ['seafarerId'], properties: { seafarerId: { type: 'integer', minimum: 1 } } } },
  }, async (request) => {
    await assertSeafarerInScope(request, request.params.seafarerId)
    return { data: await seaServiceService.list(request.params.seafarerId) }
  })

  fastify.post('/', {
    onRequest: [fastify.authenticate, fastify.can('seafarer.sea')],
    schema: {
      params: { type: 'object', required: ['seafarerId'], properties: { seafarerId: { type: 'integer', minimum: 1 } } },
      body: { type: 'object', additionalProperties: false, properties: tripProperties },
    },
  }, async (request, reply) => {
    await assertSeafarerInScope(request, request.params.seafarerId)
    const row = await seaServiceService.create(request.params.seafarerId, request.body, request.user.id)
    return reply.code(201).send(row)
  })
}

// Sửa, xoá một chuyến: /api/v1/sea-services/:id (bắt buộc lý do, ghi vào lịch sử hồ sơ)
async function seaServiceRoutes(fastify) {
  const guard = { onRequest: [fastify.authenticate, fastify.can('seafarer.sea')] }

  fastify.put('/:id', {
    ...guard,
    schema: {
      params: idParams,
      body: {
        type: 'object',
        required: ['reason'],
        additionalProperties: false,
        properties: { ...tripProperties, reason: { type: 'string', minLength: 1, maxLength: 500 } },
      },
    },
  }, async (request) => {
    await assertChildInScope(request, 'sea_service', request.params.id)
    const { reason, ...data } = request.body
    return seaServiceService.update(request.params.id, data, reason, request.user.id)
  })

  fastify.delete('/:id', {
    ...guard,
    schema: {
      params: idParams,
      body: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 1, maxLength: 500 } } },
    },
  }, async (request) => {
    await assertChildInScope(request, 'sea_service', request.params.id)
    return seaServiceService.remove(request.params.id, request.body.reason, request.user.id)
  })
}

module.exports = { seafarerSeaServiceRoutes, seaServiceRoutes }
