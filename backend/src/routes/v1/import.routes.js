const path = require('path')
const fs = require('fs')
const { importExcel } = require('../../services/import.service')
const config = require('../../config')

async function importRoutes(fastify) {
  // POST /api/v1/import/excel — upload file
  fastify.post(
    '/excel',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const data = await request.file()
      if (!data) return reply.code(400).send({ error: 'Không có file' })

      const ext = path.extname(data.filename).toLowerCase()
      if (!['.xlsx', '.xls'].includes(ext)) {
        return reply.code(400).send({ error: 'Chỉ chấp nhận file .xlsx hoặc .xls' })
      }

      // Giới hạn kích thước file import (5MB)
      const MAX_IMPORT_SIZE = 5 * 1024 * 1024
      const tmpPath = path.join(
        config.upload.dir,
        `import_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
      )
      fs.mkdirSync(config.upload.dir, { recursive: true })

      let bytesWritten = 0
      const writeStream = fs.createWriteStream(tmpPath)
      let sizeExceeded = false

      data.file.on('data', (chunk) => {
        bytesWritten += chunk.length
        if (bytesWritten > MAX_IMPORT_SIZE) {
          sizeExceeded = true
          data.file.destroy()
          writeStream.destroy()
        }
      })

      try {
        await require('stream/promises').pipeline(data.file, writeStream)
      } catch (err) {
        // sizeExceeded sẽ xử lý bên dưới với message cụ thể
        if (!sizeExceeded) {
          try {
            fs.unlinkSync(tmpPath)
          } catch (_) {}
          request.log?.error?.({ err }, 'Upload pipeline failed')
          return reply.code(400).send({ error: 'Upload file thất bại' })
        }
      }

      if (sizeExceeded) {
        try {
          fs.unlinkSync(tmpPath)
        } catch (_) {}
        return reply.code(400).send({ error: 'File quá lớn, tối đa 5MB' })
      }

      try {
        const result = await importExcel(tmpPath, request.user.id)
        return { message: 'Import hoàn tất', ...result }
      } finally {
        fs.unlinkSync(tmpPath)
      }
    }
  )

  // POST /api/v1/import/excel/sample — import file mẫu HD-Hong.xlsx
  fastify.post(
    '/excel/sample',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      const samplePath = path.resolve(__dirname, '../../../../sample data/HD - Hong.xlsx')
      const result = await importExcel(samplePath, request.user.id, 'data')
      return { message: 'Import file mẫu hoàn tất', ...result }
    }
  )
  // GET /api/v1/import/excel/template — tải file template
  fastify.get(
    '/excel/template',
    {
      onRequest: [fastify.authenticate],
    },
    async (req, reply) => {
      return reply.sendFile('templates/seafarer_template.xlsx')
    }
  )
}

module.exports = importRoutes
