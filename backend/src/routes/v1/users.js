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
    const q = request.query.q || ''
    const list = await userService.searchUsers(q)
    return { data: list }
  })

  // GET /api/v1/users
  fastify.get(
    '/',
    {
      ...guard(fastify, 'account.view'),
      schema: listUsersQuerySchema,
    },
    async (request) => {
      const { role, is_active, email, page, limit } = request.query
      const result = await userService.listUsers({ role, is_active, email }, { page, limit })
      return { data: result.rows, total: result.total, page: result.page, limit: result.limit }
    }
  )

  // GET /api/v1/users/:id
  fastify.get('/:id', guard(fastify, 'account.view'), async (request, reply) => {
    const user = await userService.getUserById(request.params.id)
    if (!user) return reply.code(404).send({ message: 'Không tìm thấy user' })
    return { data: user }
  })

  // POST /api/v1/users
  fastify.post(
    '/',
    {
      ...guard(fastify, 'account.update'),
      schema: createUserSchema,
    },
    async (request, reply) => {
      try {
        const user = await userService.createUser(request.body)
        return reply.code(201).send({ data: user })
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ message: err.message })
      }
    }
  )

  // PATCH /api/v1/users/:id
  fastify.patch(
    '/:id',
    {
      ...guard(fastify, 'account.update'),
      schema: updateUserSchema,
    },
    async (request, reply) => {
      try {
        if (
          String(request.user.id) === String(request.params.id) &&
          request.body.is_active === false
        ) {
          return reply.code(403).send({ message: 'Không thể tự khóa tài khoản của chính mình' })
        }
        const target = await userService.getUserById(request.params.id)
        if (!target) return reply.code(404).send({ message: 'Không tìm thấy user' })
        if (target.role === 'admin' && request.body.is_active === false) {
          return reply.code(403).send({ message: 'Không thể khóa tài khoản admin' })
        }
        const user = await userService.updateUser(request.params.id, request.body)
        return { data: user }
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ message: err.message })
      }
    }
  )

  // DELETE /api/v1/users/:id
  fastify.delete('/:id', guard(fastify, 'account.delete'), async (request, reply) => {
    if (String(request.user.id) === String(request.params.id)) {
      return reply.code(403).send({ message: 'Không thể xóa tài khoản của chính mình' })
    }
    const user = await userService.getUserById(request.params.id)
    if (!user) return reply.code(404).send({ message: 'Không tìm thấy user' })
    if (user.role === 'admin') {
      return reply.code(403).send({ message: 'Không thể xóa tài khoản admin' })
    }
    await userService.softDeleteUser(request.params.id)
    return reply.code(204).send()
  })

  // PATCH /api/v1/users/:id/toggle-active
  fastify.patch('/:id/toggle-active', guard(fastify, 'account.update'), async (request, reply) => {
    if (String(request.user.id) === String(request.params.id)) {
      return reply.code(403).send({ message: 'Không thể tự khóa tài khoản của chính mình' })
    }
    const user = await userService.getUserById(request.params.id)
    if (!user) return reply.code(404).send({ message: 'Không tìm thấy user' })
    if (user.role === 'admin') {
      return reply.code(403).send({ message: 'Không thể khóa tài khoản admin' })
    }
    const updated = await userService.toggleActive(request.params.id)
    return { data: updated }
  })
}

module.exports = usersRoutes
