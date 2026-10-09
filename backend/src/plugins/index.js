const fp = require('fastify-plugin')
const path = require('path')
const cors = require('@fastify/cors')
const jwt = require('@fastify/jwt')
const multipart = require('@fastify/multipart')
const staticFiles = require('@fastify/static')
const rateLimit = require('@fastify/rate-limit')
const config = require('../config')

module.exports = fp(async function (fastify) {
  // Rate limiting (global default — routes can override)
  await fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  })

  // CORS
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173']

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`Origin ${origin} not allowed by CORS`), false)
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    exposedHeaders: ['Content-Disposition'], // để frontend đọc tên file khi tải
  })

  // JWT
  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  })

  // Multipart (file upload)
  await fastify.register(multipart, {
    limits: { fileSize: config.upload.maxFileSize },
  })

  // Static files
  await fastify.register(staticFiles, {
    root: path.join(__dirname, '../../public'),
    prefix: '/public/',
  })

  // Auth decorator
  fastify.decorate('authenticate', async function (request, reply) {
    if (request.mcahAuthenticated) return
    try {
      await request.jwtVerify()
      const pool = require('../config/db')
      const [[instance]] = await pool.query('SELECT product FROM mcah_instance WHERE id = 1')
      if (instance?.product !== 'MCAH') return reply.code(503).send({ error: 'MCAH database is not initialized' })
      const [users] = await pool.query('SELECT role, is_active FROM `user` WHERE id = ? AND deleted_at IS NULL', [request.user.id])
      if (!users[0] || !users[0].is_active) return reply.code(401).send({ error: 'Unauthorized' })
      request.user.role = users[0].role
      request.mcahAuthenticated = true
    } catch (err) {
      if (!err.code?.startsWith('FST_JWT') && err.code !== 'FAST_JWT_MISSING_SIGNATURE') throw err
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0]
    if (!url.startsWith('/api/v1/') || url.startsWith('/api/v1/auth/') || url.startsWith('/api/v1/public/sign/')) return
    await fastify.authenticate(request, reply)
    if (reply.sent) return
    if (!require('../constants/mcah_permissions').allowed(request.user.role, request.method, request.url)) {
      return reply.code(403).send({ error: 'Không có quyền MCAH' })
    }
  })
})
