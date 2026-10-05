const deploymentService = require('../../services/deployment.service')
const deploymentDocumentService = require('../../services/deployment_document.service')
const pool = require('../../config/db')

const ADMIN_ROLES = ['admin', 'operator', 'accountant']

function adminAuth(fastify) {
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
    },
  }
}

async function deploymentRoutes(fastify) {
  // GET /api/v1/seafarers/:seafarerId/deployments
  fastify.get('/', adminAuth(fastify), async (request, reply) => {
    try {
      const seafarerId = parseInt(request.params.seafarerId)
      const data = await deploymentService.list(seafarerId)
      return { data }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // POST /api/v1/seafarers/:seafarerId/deployments
  fastify.post('/', adminAuth(fastify), async (request, reply) => {
    try {
      const seafarerId = parseInt(request.params.seafarerId)
      const dep = await deploymentService.create(seafarerId, request.body)
      return reply.code(201).send(dep)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/deployments/:id
  // PUT /api/v1/deployments/:id
  // PUT /api/v1/deployments/:id/status
  // DELETE /api/v1/deployments/:id
  // GET /api/v1/deployments/:id/checklist
  // PUT /api/v1/deployments/:id/checklist/:key
}

async function deploymentCRUDRoutes(fastify) {
  const auth = adminAuth(fastify)

  // GET /api/v1/deployments/stats
  fastify.get('/stats', auth, async (request, reply) => {
    try {
      const [rows] = await pool.query(
        'SELECT status, COUNT(*) AS cnt FROM seafarer_deployment GROUP BY status'
      )
      const result = {}
      rows.forEach((r) => {
        result[r.status] = Number(r.cnt)
      })
      return result
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/deployments
  fastify.get('/', auth, async (request, reply) => {
    try {
      const data = await deploymentService.listAll(request.query || {})
      return { data }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/deployments/:id
  fastify.get('/:id', auth, async (request, reply) => {
    try {
      return await deploymentService.getById(parseInt(request.params.id))
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // PUT /api/v1/deployments/:id
  fastify.put('/:id', auth, async (request, reply) => {
    try {
      return await deploymentService.update(parseInt(request.params.id), request.body)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // PUT /api/v1/deployments/:id/status
  fastify.put('/:id/status', auth, async (request, reply) => {
    try {
      const { status, options } = request.body
      if (!status) return reply.code(400).send({ error: 'Thiếu trường status' })
      const deploymentId = parseInt(request.params.id)
      const warnings = await deploymentService.evaluateSoftWarnings(deploymentId, status, options)
      const data = await deploymentService.changeStatus(deploymentId, status, options || {})
      return { data, warnings }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/deployments/:id
  fastify.delete('/:id', auth, async (request, reply) => {
    try {
      if (!['admin', 'operator'].includes(request.user.role))
        return reply.code(403).send({ error: 'Không có quyền xóa điều động' })
      return await deploymentService.delete(parseInt(request.params.id))
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/deployments/bulk
  fastify.delete('/bulk', auth, async (request, reply) => {
    try {
      if (!['admin', 'operator'].includes(request.user.role))
        return reply.code(403).send({ error: 'Không có quyền xóa điều động' })
      const { ids } = request.body || {}
      if (!Array.isArray(ids) || ids.length === 0)
        return reply.code(400).send({ error: 'Danh sách id không hợp lệ' })
      const results = await Promise.allSettled(
        ids.map((id) => deploymentService.delete(parseInt(id)))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { deleted: ids.length - failed, failed }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/deployments/:id/checklist
  fastify.get('/:id/checklist', auth, async (request, reply) => {
    try {
      const data = await deploymentService.getChecklist(parseInt(request.params.id))
      return { data }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // PUT /api/v1/deployments/:id/checklist/:key
  fastify.put('/:id/checklist/:key', auth, async (request, reply) => {
    try {
      const { is_checked, notes } = request.body
      return await deploymentService.updateChecklistItem(
        parseInt(request.params.id),
        request.params.key,
        !!is_checked,
        notes
      )
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // POST /api/v1/deployments/:id/checklist/:key/attachment
  fastify.post('/:id/checklist/:key/attachment', auth, async (request, reply) => {
    try {
      const file = await request.file()
      const data = await deploymentService.uploadChecklistAttachment(
        parseInt(request.params.id),
        request.params.key,
        file,
        request.user?.id || null
      )
      return reply.code(201).send(data)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/deployments/:id/checklist/:key/attachment
  fastify.delete('/:id/checklist/:key/attachment', auth, async (request, reply) => {
    try {
      return await deploymentService.deleteChecklistAttachment(
        parseInt(request.params.id),
        request.params.key
      )
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/deployments/:id/documents/:type
  fastify.get('/:id/documents/:type', auth, async (request, reply) => {
    try {
      const deploymentId = parseInt(request.params.id)
      const { type } = request.params

      const TYPES = {
        bb_giao_nhan: {
          fn: () => deploymentDocumentService.generateBBGiaoNhan(deploymentId),
          filename: 'BB_Giao_Nhan_Giay_To_TV.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        hop_dong_dan_su: {
          fn: () => deploymentDocumentService.generateHopDongDanSu(deploymentId),
          filename: 'Hop_Dong_Dan_Su.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        hop_dong_mlc: {
          fn: () => deploymentDocumentService.generateHopDongMLC(deploymentId),
          filename: 'Mau_Hop_Dong_MLC.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        quyet_dinh_dieu_dong: {
          fn: () => deploymentDocumentService.generateQuyetDinhDieuDong(deploymentId),
          filename: 'Quyet_Dinh_Dieu_Dong.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      }

      const config = TYPES[type]
      if (!config) return reply.code(400).send({ error: 'Loại tài liệu không hợp lệ' })

      const buffer = await config.fn()
      reply
        .header('Content-Type', config.mime)
        .header('Content-Disposition', `attachment; filename="${config.filename}"`)
      return reply.send(buffer)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })
}

module.exports = { deploymentRoutes, deploymentCRUDRoutes }
