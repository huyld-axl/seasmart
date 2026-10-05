const waitlistService = require('../../services/waitlist.service')

async function waitlistRoutes(fastify) {
  const onlySeafarer = async (request, reply) => {
    await fastify.authenticate(request, reply)
    if (request.user.role !== 'seafarer') {
      return reply.code(403).send({ error: 'Chỉ dành cho thuyền viên' })
    }
  }

  // POST /api/v1/waitlist/:id/confirm — seafarer xác nhận từ email link (TASK-C2)
  fastify.post('/:id/confirm', { onRequest: [onlySeafarer] }, async (request, reply) => {
    const waitlistId = parseInt(request.params.id)
    const seafarerId = request.user.linked_entity_id
    if (!seafarerId) return reply.code(403).send({ error: 'Chưa liên kết hồ sơ thuyền viên' })
    try {
      const result = await waitlistService.confirmWaitlist(waitlistId, seafarerId)
      return result
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/waitlist/:id — seafarer tự hủy khỏi waitlist (TASK-C2)
  fastify.delete('/:id', { onRequest: [onlySeafarer] }, async (request, reply) => {
    const waitlistId = parseInt(request.params.id)
    const seafarerId = request.user.linked_entity_id
    if (!seafarerId) return reply.code(403).send({ error: 'Chưa liên kết hồ sơ thuyền viên' })
    try {
      await waitlistService.cancelWaitlist(waitlistId, seafarerId)
      return reply.code(204).send()
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })
}

module.exports = waitlistRoutes
