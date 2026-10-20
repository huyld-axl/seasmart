const userService = require('../../services/user.service')
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require('../../schemas/userSchemas')

function guard(fastify, perm) {
  return { onRequest: [fastify.authenticate, fastify.can(perm)] }
}

async function usersRoutes(fastify) {
  // GET /api/v1/users/search?q=... — ô chọn người nhận tin nhắn
  fastify.get('/search', guard(fastify, 'message.view'), async (request) => {
    const list = await userService.searchUsers(request.query.q || '')
    return { data: list }
  })

  // GET /api/v1/users
  fastify.get('/', { ...guard(fastify, 'account.view'), schema: listUsersQuerySchema }, async (request) => {
    const { role_id, is_active, email, page, limit } = request.query
    const result = await userService.listUsers({ role_id, is_active, email }, { page, limit })
    return { data: result.rows, total: result.total, page: result.page, limit: result.limit }
  })

  // GET /api/v1/users/:id
  fastify.get('/:id', guard(fastify, 'account.view'), async (request, reply) => {
    const user = await userService.getUserById(request.params.id)
    if (!user) return reply.code(404).send({ error: 'Không tìm thấy user' })
    return { data: user }
  })

  // POST /api/v1/users
  fastify.post('/', { ...guard(fastify, 'account.update'), schema: createUserSchema }, async (request, reply) => {
    const user = await userService.createUser(request.body, request.access)
    return reply.code(201).send({ data: user })
  })

  // PATCH /api/v1/users/:id
  fastify.patch('/:id', { ...guard(fastify, 'account.update'), schema: updateUserSchema }, async (request) => {
    const user = await userService.updateUser(request.params.id, request.body, request.access)
    return { data: user }
  })

  // DELETE /api/v1/users/:id
  fastify.delete('/:id', guard(fastify, 'account.delete'), async (request, reply) => {
    await userService.softDeleteUser(request.params.id, request.access)
    return reply.code(204).send()
  })

  // PATCH /api/v1/users/:id/toggle-active
  fastify.patch('/:id/toggle-active', guard(fastify, 'account.update'), async (request) => {
    const user = await userService.toggleActive(request.params.id, request.access)
    return { data: user }
  })
}

module.exports = usersRoutes
