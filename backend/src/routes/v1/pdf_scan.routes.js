const pdfScanService = require('../../services/pdf_scan.service')

async function pdfScanRoutes(fastify) {
  fastify.post(
    '/:seafarerId/scan-seaman-book',
    {
      onRequest: [fastify.authenticate],
    },
    async (req) => {
      const data = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } })
      if (!data) throw { statusCode: 400, message: 'Thiếu file PDF' }
      if (data.mimetype !== 'application/pdf')
        throw { statusCode: 400, message: 'Chỉ chấp nhận file PDF' }
      const buffer = await data.toBuffer()
      const jobId = await pdfScanService.createJob(req.params.seafarerId, buffer)
      return { jobId }
    }
  )

  // Không cần authenticate — jobId UUID là implicit auth (chỉ user đã POST mới có jobId)
  fastify.get('/:seafarerId/scan-seaman-book/:jobId/stream', async (req, reply) => {
    // @fastify/cors hook chạy sau flushHeaders() nên phải set CORS header thủ công
    const origin = req.headers.origin
    if (origin) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin)
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    return pdfScanService.streamJob(req.params.jobId, reply)
  })
}

module.exports = pdfScanRoutes
