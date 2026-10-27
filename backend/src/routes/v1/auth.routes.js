const authService = require('../../services/auth.service')
const userService = require('../../services/user.service')
const { inviteQuerySchema, setPasswordSchema } = require('../../schemas/userSchemas')
const config = require('../../config')
const { loadAccess, toClientUser } = require('../../plugins/access')

async function authRoutes(fastify) {
  // POST /api/v1/auth/login
  fastify.post(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const user = await authService.login(request.body)
      const access = await loadAccess(user.id)
      const token = fastify.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: config.jwt.expiresIn || '7d' }
      )
      return { user: toClientUser(access), token }
    }
  )

  // GET /api/v1/auth/invite?token=: trang đặt mật khẩu lấy email của lời mời
  fastify.get(
    '/invite',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: inviteQuerySchema },
    async (request) => ({ data: await userService.getInviteByToken(request.query.token) })
  )

  // POST /api/v1/auth/set-password: đặt mật khẩu lần đầu bằng mã trong thư mời
  fastify.post(
    '/set-password',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: setPasswordSchema },
    async (request, reply) => {
      await userService.setPasswordByToken(request.body)
      return reply.code(204).send()
    }
  )

  // GET /api/v1/auth/me
  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return { user: toClientUser(request.access) }
    }
  )
}

module.exports = authRoutes
