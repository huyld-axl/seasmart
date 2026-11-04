const dashboardService = require('../../services/dashboard.service')
const kpiService = require('../../services/kpi.service')
const { ownerIdFor } = require('../../utils/scope')

async function dashboardRoutes(fastify) {
  // GET /api/v1/dashboard/certificate-alerts
  fastify.get('/certificate-alerts', { onRequest: [fastify.authenticate, fastify.can('seafarer.view')] }, async (request) => {
    return { data: await dashboardService.certificateAlerts({ ownerId: ownerIdFor(request, 'seafarer') }) }
  })

  // GET /api/v1/dashboard/kpi?month=YYYY-MM — có kpi.view_all thì số cả công ty, không thì số của chính mình.
  const kpiQuery = { type: 'object', properties: { month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' } } }
  fastify.get('/kpi', { onRequest: [fastify.authenticate, fastify.can('contract.view')], schema: { querystring: kpiQuery } }, async (request) => {
    const view = request.access.permissions.has('kpi.view_all') ? 'company' : 'own'
    return { data: await kpiService.kpi({ view, userId: request.user.id, month: request.query.month || null }) }
  })
}

module.exports = dashboardRoutes
