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
  // GET /api/v1/users
  fastify.get('/', { ...guard(fastify, 'account.view'), schema: listUsersQuerySchema }, async (request) => {
    const { role_id, is_active, email, status, page, limit } = request.query
    const result = await userService.listUsers({ role_id, is_active, email, status }, { page, limit })
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

  // POST /api/v1/users/:id/resend-invite
  // Mỗi tài khoản chỉ gửi lại 1 thư / phút để bấm liên tục không gửi nhiều thư.
  const resendLimit = {
    rateLimit: {
      max: 1,
      timeWindow: '1 minute',
      keyGenerator: (request) => `resend-invite:${request.params.id}`,
      errorResponseBuilder: () => ({ statusCode: 429, message: 'Vừa gửi lời mời cho tài khoản này, thử lại sau 1 phút' }),
    },
  }
  fastify.post('/:id/resend-invite', { ...guard(fastify, 'account.update'), config: resendLimit }, async (request, reply) => {
    const user = await userService.resendInvite(request.params.id)
    // App máy tính: trả mã đặt mật khẩu để mở trang đặt mật khẩu ngay trên máy.
    if (user.invite_token) return { invite_token: user.invite_token }
    return reply.code(204).send()
  })

  // PATCH /api/v1/users/:id
  fastify.patch('/:id', { ...guard(fastify, 'account.update'), schema: updateUserSchema }, async (request) => {
    const user = await userService.updateUser(request.params.id, request.body, request.access)
    return { data: user }
  })

  // DELETE /api/v1/users/:id
  fastify.delete('/:id', guard(fastify, 'account.delete'), async (request, reply) => {
    const result = await userService.softDeleteUser(request.params.id, request.access)
    // App máy tính: chưa báo được máy chủ dịch vụ thì trả cảnh báo để giao diện nhắc.
    if (result?.cloud_warning) return result
    return reply.code(204).send()
  })

  // PATCH /api/v1/users/:id/toggle-active
  fastify.patch('/:id/toggle-active', guard(fastify, 'account.update'), async (request) => {
    const user = await userService.toggleActive(request.params.id, request.access)
    return { data: user }
  })
}

module.exports = usersRoutes
