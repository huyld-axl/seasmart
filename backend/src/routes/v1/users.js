const userService = require('../../services/user.service')
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require('../../schemas/userSchemas')

function adminOnly(fastify) {
  const CRUD_ROLES = ['admin', 'operator', 'accountant']
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!CRUD_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ message: 'Không có quyền truy cập' })
      }
    },
  }
}

function authRequired(fastify) {
  return { onRequest: [fastify.authenticate] }
}

async function usersRoutes(fastify) {
  const PROTECTED_USER_ID = '1' // Bootstrap / super admin account
  // GET /api/v1/users/search?q=... - for messaging user picker (all roles)
  fastify.get('/search', authRequired(fastify), async (request) => {
    const q = request.query.q || ''
    const list = await userService.searchUsers(q)
    return { data: list }
  })

  // GET /api/v1/users
  fastify.get(
    '/',
    {
      ...adminOnly(fastify),
      schema: listUsersQuerySchema,
    },
    async (request) => {
      const { role, is_active, email, page, limit } = request.query
      const result = await userService.listUsers({ role, is_active, email }, { page, limit })
      return { data: result.rows, total: result.total, page: result.page, limit: result.limit }
    }
  )

  // GET /api/v1/users/:id
  fastify.get('/:id', adminOnly(fastify), async (request, reply) => {
    const user = await userService.getUserById(request.params.id)
    if (!user) return reply.code(404).send({ message: 'Không tìm thấy user' })
    return { data: user }
  })

  // POST /api/v1/users
  fastify.post(
    '/',
    {
      ...adminOnly(fastify),
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
      ...adminOnly(fastify),
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

        if (String(request.params.id) === PROTECTED_USER_ID) {
          if (request.body.email !== undefined && request.body.email !== target.email) {
            return reply.code(403).send({ message: 'Không thể sửa email tài khoản này' })
          }
          if (request.body.role !== undefined && request.body.role !== target.role) {
            return reply.code(403).send({ message: 'Không thể thay đổi role tài khoản này' })
          }
          if (request.body.is_active === false && !!target.is_active) {
            return reply.code(403).send({ message: 'Không thể khóa tài khoản này' })
          }
          // Allow password update for protected user.
        }

        const newPassword = request.body.password
        if (newPassword !== undefined && String(newPassword).trim().length > 0) {
          const oldPassword = request.body.password_old
          if (!oldPassword || String(oldPassword).trim().length === 0) {
            return reply.code(400).send({ message: 'Thiếu mật khẩu cũ' })
          }
          const ok = await userService.verifyUserPassword(request.params.id, oldPassword)
          if (!ok) {
            return reply.code(403).send({ message: 'Mật khẩu cũ không đúng' })
          }
        }

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
  fastify.delete('/:id', adminOnly(fastify), async (request, reply) => {
    if (String(request.params.id) === PROTECTED_USER_ID) {
      return reply.code(403).send({ message: 'Không thể xóa tài khoản này' })
    }
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
  fastify.patch('/:id/toggle-active', adminOnly(fastify), async (request, reply) => {
    if (String(request.params.id) === PROTECTED_USER_ID) {
      return reply.code(403).send({ message: 'Không thể thay đổi trạng thái tài khoản này' })
    }
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
