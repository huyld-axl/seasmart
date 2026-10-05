const fp = require('fastify-plugin')
const path = require('path')
const cors = require('@fastify/cors')
const jwt = require('@fastify/jwt')
const multipart = require('@fastify/multipart')
const staticFiles = require('@fastify/static')
const rateLimit = require('@fastify/rate-limit')
const config = require('../config')

module.exports = fp(async function (fastify) {
  // Rate limiting (global default - routes can override)
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
    exposedHeaders: ['Content-Disposition'],
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

  // Uploaded files (certificates, avatars, ...)
  await fastify.register(staticFiles, {
    root: path.resolve(process.cwd(), config.upload.dir),
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Auth decorator
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })
})
