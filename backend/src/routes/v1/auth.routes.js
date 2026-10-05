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
    async (request, reply) => {
      const user = await authService.login(request.body)
      const token = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          linked_entity_id: user.linked_entity_id || null,
          linked_entity_type: user.linked_entity_type || null,
        },
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

  // POST /api/v1/auth/verify/request
  fastify.post(
    '/verify/request',
    {
      onRequest: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '5 minutes' } },
    },
    async (request) => {
      return authService.requestVerify(request.user.id, request.user.email)
    }
  )

  // POST /api/v1/auth/verify/confirm
  fastify.post(
    '/verify/confirm',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['otp'],
          properties: {
            otp: { type: 'string', minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request) => {
      return authService.confirmVerify(request.user.id, request.body.otp)
    }
  )
}

module.exports = authRoutes
