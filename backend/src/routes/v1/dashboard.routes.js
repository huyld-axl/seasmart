const dashboardService = require('../../services/dashboard.service')
const { ownerIdFor } = require('../../utils/scope')

async function dashboardRoutes(fastify) {
  // GET /api/v1/dashboard/certificate-alerts
  fastify.get('/certificate-alerts', { onRequest: [fastify.authenticate, fastify.can('seafarer.view')] }, async (request) => {
    return { data: await dashboardService.certificateAlerts({ ownerId: ownerIdFor(request, 'seafarer') }) }
  })
}

module.exports = dashboardRoutes
