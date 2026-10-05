const certificateService = require('../../services/certificate.service')
const aiService = require('../../services/ai.service')
const pool = require('../../config/db')
const { invalidateCache } = require('../../utils/lookup-cache')

const CERT_ALLOWED = [
  'certificate_number',
  'issued_date',
  'expiry_date',
  'issued_by',
  'place_of_issue',
  'issued_at_country_id',
  'status',
  'notes',
]

async function certificateRoutes(fastify) {
  // GET /api/v1/seafarers/:seafarerId/certificates
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      const { page, limit, certificate_type_id } = request.query
      return certificateService.list(parseInt(request.params.seafarerId), {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 9999,
        certificate_type_id: certificate_type_id ? parseInt(certificate_type_id) : undefined,
      })
    }
  )

  // POST /api/v1/seafarers/:seafarerId/certificates
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            certificate_type_id: { type: 'integer' },
            certificate_type_name: { type: 'string' },
            certificate_number: { type: 'string' },
            issued_date: { type: ['string', 'null'], format: 'date' },
            expiry_date: { type: ['string', 'null'], format: 'date' },
            issued_by: { type: 'string' },
            place_of_issue: { type: 'string' },
            issued_at_country_id: { type: 'integer' },
            status: { type: 'string', enum: ['VALID', 'EXPIRED', 'REVOKED', 'PENDING'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      let { certificate_type_id, certificate_type_name, ...rawRest } = request.body
      const rest = Object.fromEntries(
        Object.entries(rawRest).filter(([k]) => CERT_ALLOWED.includes(k))
      )

      if (!certificate_type_id && certificate_type_name) {
        const trimmed = certificate_type_name.trim()
        let resolved = null

        // 1. Exact match name_vi
        const [[byVi]] = await pool.query(
          'SELECT id FROM certificate_type WHERE name_vi = ? LIMIT 1',
          [trimmed]
        )
        if (byVi) resolved = byVi

        // 2. Exact match name_en
        if (!resolved) {
          const [[byEn]] = await pool.query(
            'SELECT id FROM certificate_type WHERE name_en = ? LIMIT 1',
            [trimmed]
          )
          if (byEn) resolved = byEn
        }

        // 3. Fuzzy substring match — chỉ trên types có code (canonical)
        if (!resolved && trimmed.length >= 5) {
          const [allTypes] = await pool.query(
            'SELECT id, name_vi, name_en FROM certificate_type WHERE code IS NOT NULL'
          )
          const lower = trimmed.toLowerCase()
          let best = null
          let bestScore = 0
          for (const ct of allTypes) {
            const vi = (ct.name_vi || '').toLowerCase()
            const en = (ct.name_en || '').toLowerCase()
            let score = 0
            if (vi && lower.includes(vi)) score = Math.max(score, vi.length)
            if (vi && vi.includes(lower)) score = Math.max(score, lower.length)
            if (en && lower.includes(en)) score = Math.max(score, en.length)
            if (en && en.includes(lower)) score = Math.max(score, lower.length)
            if (score > bestScore) {
              bestScore = score
              best = ct
            }
          }
          if (bestScore >= 5) resolved = best
        }

        if (resolved) {
          certificate_type_id = resolved.id
        } else {
          const [result] = await pool.query('INSERT INTO certificate_type (name_vi) VALUES (?)', [
            trimmed,
          ])
          certificate_type_id = result.insertId
          invalidateCache('certificate_type')
        }
      }

      if (!certificate_type_id) {
        return reply.code(400).send({ error: 'Cần certificate_type_id hoặc certificate_type_name' })
      }

      const cert = await certificateService.create(
        parseInt(request.params.seafarerId),
        { certificate_type_id, ...rest },
        request.user.id
      )
      return reply.code(201).send(cert)
    }
  )

  // PUT /api/v1/seafarers/:seafarerId/certificates/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      const data = Object.fromEntries(
        Object.entries(request.body).filter(([k]) => CERT_ALLOWED.includes(k))
      )
      return certificateService.update(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        data,
        request.user.id
      )
    }
  )

  // DELETE /api/v1/seafarers/:seafarerId/certificates/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return certificateService.softDelete(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        request.user.id
      )
    }
  )

  // POST /api/v1/seafarers/:seafarerId/certificates/extract
  fastify.post(
    '/extract',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const file = await request.file()
      if (!file) return reply.code(400).send({ error: 'Không có file được gửi lên' })

      const fileBuffer = await file.toBuffer()

      const MAX_AI_FILE_SIZE = 5 * 1024 * 1024
      if (fileBuffer.length > MAX_AI_FILE_SIZE) {
        return reply.code(400).send({ error: 'File quá lớn để trích xuất (tối đa 5MB)' })
      }

      const magic = fileBuffer.slice(0, 12)
      const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46
      const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff
      const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47
      const isWebp =
        magic[0] === 0x52 &&
        magic[1] === 0x49 &&
        magic[2] === 0x46 &&
        magic[3] === 0x46 &&
        magic[8] === 0x57 &&
        magic[9] === 0x45 &&
        magic[10] === 0x42 &&
        magic[11] === 0x50
      const isBmp = magic[0] === 0x42 && magic[1] === 0x4d
      const isTiff =
        (magic[0] === 0x49 && magic[1] === 0x49 && magic[2] === 0x2a && magic[3] === 0x00) ||
        (magic[0] === 0x4d && magic[1] === 0x4d && magic[2] === 0x00 && magic[3] === 0x2a)
      const isGif = magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x38

      if (!isPdf && !isJpeg && !isPng && !isWebp && !isBmp && !isTiff && !isGif) {
        return reply.code(400).send({
          error: 'Nội dung file không hợp lệ (chỉ hỗ trợ PDF, JPG, PNG, WebP, BMP, TIFF, GIF)',
        })
      }

      let mimeType
      if (isPdf) mimeType = 'application/pdf'
      else if (isJpeg) mimeType = 'image/jpeg'
      else if (isPng) mimeType = 'image/png'
      else if (isWebp) mimeType = 'image/webp'
      else if (isBmp) mimeType = 'image/bmp'
      else if (isTiff) mimeType = 'image/tiff'
      else mimeType = 'image/gif'

      if (isBmp || isTiff) {
        return reply.code(400).send({
          error: 'File BMP/TIFF không hỗ trợ đọc AI. Hãy chụp lại hoặc chuyển sang JPG/PNG/WebP.',
        })
      }

      const [certTypes] = await pool.query(
        'SELECT id, code, name_vi, name_en, abbreviation FROM certificate_type ORDER BY name_vi'
      )

      const result = await aiService.extractCertificateInfo(fileBuffer, mimeType, certTypes)

      if (
        result.suggested_certificate_type_id !== null &&
        !certTypes.find((c) => c.id === result.suggested_certificate_type_id)
      ) {
        result.suggested_certificate_type_id = null
      }

      return result
    }
  )

  // DELETE /api/v1/seafarers/:seafarerId/certificates/:id/file
  fastify.delete(
    '/:id/file',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return certificateService.deleteFile(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        request.user.id
      )
    }
  )

  // POST /api/v1/seafarers/:seafarerId/certificates/:id/upload
  fastify.post(
    '/:id/upload',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const file = await request.file()
      if (!file) return reply.code(400).send({ error: 'Không có file được gửi lên' })

      return certificateService.uploadFile(
        parseInt(request.params.id),
        parseInt(request.params.seafarerId),
        file,
        request.user.id
      )
    }
  )
}

module.exports = certificateRoutes
