const notificationService = require('../../services/notification.service')

async function notificationRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /api/v1/notifications?is_read=false&limit=10
  fastify.get('/', auth, async (request) => {
    const userId = request.user.id
    const is_read = request.query.is_read
    const limit = request.query.limit
    const list = await notificationService.list(userId, { is_read, limit })
    return { data: list }
  })

  // GET /api/v1/notifications/unread-count
  fastify.get('/unread-count', auth, async (request) => {
    const count = await notificationService.getUnreadCount(request.user.id)
    return { count }
  })

  // PATCH /api/v1/notifications/read-all (must be before /:id/read)
  fastify.patch('/read-all', auth, async (request) => {
    const count = await notificationService.markAllRead(request.user.id)
    return { count }
  })

  // PATCH /api/v1/notifications/:id/read
  fastify.patch('/:id/read', auth, async (request, reply) => {
    const ok = await notificationService.markRead(request.user.id, parseInt(request.params.id))
    if (!ok) return reply.code(404).send({ error: 'Không tìm thấy thông báo' })
    return { success: true }
  })
}

module.exports = notificationRoutes
