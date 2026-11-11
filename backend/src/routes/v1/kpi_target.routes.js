const kpiService = require('../../services/kpi.service')

const month = { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }
const listQuery = { type: 'object', required: ['month'], properties: { month } }
const saveBody = {
  type: 'object',
  required: ['month', 'rows'],
  additionalProperties: false,
  properties: {
    month,
    rows: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        required: ['user_id'],
        additionalProperties: false,
        properties: {
          user_id: { type: 'integer', minimum: 1 },
          contracts: { type: ['integer', 'null'], minimum: 1, maximum: 1000 },
          revenue_usd: { type: ['number', 'null'], minimum: 1, maximum: 9999999999 },
        },
      },
    },
  },
}
const copyBody = { type: 'object', required: ['from', 'to'], additionalProperties: false, properties: { from: month, to: month } }

// Mục tiêu tháng của từng môi giới viên (Quản trị → Mục tiêu tháng).
async function kpiTargetRoutes(fastify) {
  const guard = { onRequest: [fastify.authenticate, fastify.can('kpi.manage')] }

  // GET /api/v1/kpi-targets?month=YYYY-MM
  fastify.get('/', { ...guard, schema: { querystring: listQuery } }, async (request) => {
    return { data: await kpiService.listTargets(request.query.month) }
  })

  // PUT /api/v1/kpi-targets
  fastify.put('/', { ...guard, schema: { body: saveBody } }, async (request) => {
    return { data: await kpiService.saveTargets(request.body, request.user.id) }
  })

  // POST /api/v1/kpi-targets/copy
  fastify.post('/copy', { ...guard, schema: { body: copyBody } }, async (request) => {
    return { data: await kpiService.copyTargets(request.body, request.user.id) }
  })
}

module.exports = kpiTargetRoutes
