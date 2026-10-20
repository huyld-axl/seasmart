const authService = require('../../services/auth.service')
const config = require('../../config')

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
      const token = fastify.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: config.jwt.expiresIn || '7d' }
      )
      return { user, token }
    }
  )

  // GET /api/v1/auth/me
  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return { user: request.user }
    }
  )
}

module.exports = authRoutes
