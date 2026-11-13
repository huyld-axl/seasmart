const fp = require('fastify-plugin')
const cors = require('@fastify/cors')
const jwt = require('@fastify/jwt')
const multipart = require('@fastify/multipart')
const staticFiles = require('@fastify/static')
const rateLimit = require('@fastify/rate-limit')
const config = require('../config')
const { loadAccess, can } = require('./access')

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
    root: require('../config/paths').PUBLIC_DIR,
    prefix: '/public/',
  })

  // Auth decorator: quyền đọc từ DB mỗi request nên khoá tài khoản và đổi quyền có hiệu lực ngay.
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    // App máy tính: phiên không sống quá mốc offline của vé (7 ngày kể từ lần làm mới cuối với máy chủ dịch vụ).
    if (config.desktop && !(request.user.offline_until > Date.now() / 1000)) {
      return reply.code(401).send({ error: 'Đã quá 7 ngày không kết nối internet. Kết nối rồi đăng nhập lại.', code: 'OFFLINE_EXPIRED' })
    }
    const access = await loadAccess(request.user.id)
    if (!access) return reply.code(401).send({ error: 'Unauthorized' })
    request.access = access
  })

  // Dùng sau authenticate: { onRequest: [fastify.authenticate, fastify.can('voyage.update')] }
  fastify.decorate('can', can)

  // Dùng sau authenticate cho mọi API gửi ảnh cho AI đọc: chưa đồng ý thì 409 AI_CONSENT_REQUIRED, giao diện hỏi
  // (docs/mcah-ke-hoach-desktop-gd4.md 3.8) rồi gửi lại.
  fastify.decorate('requireAiConsent', async function (request, reply) {
    if (!request.access?.aiConsentAt) {
      return reply.code(409).send({ error: 'Cần đồng ý gửi ảnh cho AI đọc trước khi quét', code: 'AI_CONSENT_REQUIRED' })
    }
  })

  await fastify.register(require('./maintenance'))
  await fastify.register(require('./lan_device'))
  await fastify.register(require('./idempotency'))
})
