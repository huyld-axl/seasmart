const authService = require('../../services/auth.service')
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
        // Tạm giữ `role` trong token cho các route chưa chuyển sang kiểm quyền; bỏ ở Bước 5.
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: config.jwt.expiresIn || '7d' }
      )
      return { user: toClientUser(access), token }
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
