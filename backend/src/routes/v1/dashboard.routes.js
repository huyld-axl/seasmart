const dashboardService = require('../../services/dashboard.service')
const kpiService = require('../../services/kpi.service')
const { ownerIdFor } = require('../../utils/scope')

const ATTENTION_PERMS = ['opportunity.view', 'seafarer.view', 'voyage.view', 'contract.view', 'bill.view']

async function dashboardRoutes(fastify) {
  // GET /api/v1/dashboard/kpi?month=YYYY-MM — có kpi.view_all thì số cả công ty, không thì số của chính mình.
  const kpiQuery = { type: 'object', properties: { month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' } } }
  fastify.get('/kpi', { onRequest: [fastify.authenticate, fastify.can('contract.view')], schema: { querystring: kpiQuery } }, async (request) => {
    const view = request.access.permissions.has('kpi.view_all') ? 'company' : 'own'
    return { data: await kpiService.kpi({ view, userId: request.user.id, month: request.query.month || null }) }
  })

  // GET /api/v1/dashboard/attention — khối Cần chú ý. Chỉ tab có quyền; không có kpi.view_all thì chỉ việc của mình.
  // Cần ít nhất một quyền xem trong ATTENTION_PERMS.
  fastify.get('/attention', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const perms = request.access.permissions
    if (!ATTENTION_PERMS.some((p) => perms.has(p))) return reply.code(403).send({ error: 'Không có quyền' })
    const scopes = Object.fromEntries(['opportunity', 'seafarer', 'voyage', 'contract', 'bill'].map((m) => [m, ownerIdFor(request, m)]))
    return { data: await dashboardService.attention({ userId: request.user.id, mine: !perms.has('kpi.view_all'), perms, scopes }) }
  })
}

module.exports = dashboardRoutes
