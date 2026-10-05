const seafarerService = require('../../services/seafarer.service')
const seafarerCallService = require('../../services/seafarer_call.service')
const formExportService = require('../../services/form_export.service')
const cvExportService = require('../../services/cv_export.service')
const cvEngExportService = require('../../services/cv_eng_export.service')
const seafarerDispatchDecisionService = require('../../services/seafarer_dispatch_decision.service')
const pool = require('../../config/db')

const ADMIN_ROLES = ['admin', 'operator', 'accountant']
const MAX_LIST_LIMIT = 100

async function seafarerRoutes(fastify) {
  // GET /api/v1/seafarers/stats - count by status + certificates expiring soon
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async () => {
    const [rows] = await pool.query(
      'SELECT status, COUNT(*) AS cnt FROM seafarer WHERE deleted_at IS NULL GROUP BY status'
    )
    const result = {}
    rows.forEach((r) => {
      result[r.status] = Number(r.cnt)
    })
    const [[{ expiring }]] = await pool.query(
      `SELECT COUNT(*) AS expiring FROM seafarer_certificate
       WHERE deleted_at IS NULL
         AND (status IS NULL OR status != 'REVOKED')
         AND expiry_date IS NOT NULL
         AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)`
    )
    result.certificates_expiring_soon = Number(expiring)
    return result
  })

  // GET /api/v1/seafarers/certs-expiring?days=90
  fastify.get('/certs-expiring', { onRequest: [fastify.authenticate] }, async (request) => {
    const days = Math.min(parseInt(request.query.days) || 90, 365)
    const [rows] = await pool.query(
      `SELECT
        s.id AS seafarer_id,
        s.full_name AS seafarer_name,
        s.seafarer_code,
        COALESCE(ct.name_vi, ct.name_en, 'Chứng chỉ') AS cert_type_name,
        sc.expiry_date,
        DATEDIFF(sc.expiry_date, CURDATE()) AS days_left,
        CASE
          WHEN sc.expiry_date < CURDATE() THEN 'EXPIRED'
          ELSE 'EXPIRING'
        END AS expiry_status
       FROM seafarer_certificate sc
       JOIN seafarer s ON s.id = sc.seafarer_id
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       WHERE sc.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND (sc.status IS NULL OR sc.status != 'REVOKED')
         AND sc.expiry_date IS NOT NULL
         AND sc.expiry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND sc.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY sc.expiry_date ASC
       LIMIT 50`,
      [days, days]
    )
    return rows
  })

  // GET /api/v1/seafarers/forms - list available form templates
  fastify.get(
    '/forms',
    {
      onRequest: [fastify.authenticate],
    },
    async () => {
      return formExportService.listForms()
    }
  )

  // GET /api/v1/seafarers/:id/export-cv - generate CV Excel (mẫu tàu Trung Quốc)
  fastify.get('/:id/export-cv', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { buffer, filename } = await cvExportService.buildCV(parseInt(request.params.id))
    const encoded = encodeURIComponent(filename)
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`)
    return reply.send(buffer)
  })

  // GET /api/v1/seafarers/:id/export-cv-eng - mẫu `CV eng.xlsx` (CREW BIOGRAPHICAL DATA)
  fastify.get(
    '/:id/export-cv-eng',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { buffer, filename } = await cvEngExportService.buildCVEng(parseInt(request.params.id))
      const encoded = encodeURIComponent(filename)
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`)
      return reply.send(buffer)
    }
  )

  // GET /api/v1/seafarers/:id/export-form/:formKey - fill and download a form
  fastify.get(
    '/:id/export-form/:formKey',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id, formKey } = request.params
      const { buffer, filename } = await formExportService.exportForm(parseInt(id), formKey)
      const encoded = encodeURIComponent(filename)
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`)
      return reply.send(buffer)
    }
  )

  // GET /api/v1/seafarers/:id/preview-form/:formKey - return filled data as JSON for review
  fastify.get(
    '/:id/preview-form/:formKey',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id, formKey } = request.params
      const meta = formExportService.FORM_META.find((f) => f.key === formKey)
      if (!meta) return reply.code(400).send({ error: `Form không hợp lệ: ${formKey}` })

      const seafarer = await formExportService.getSeafarerData(parseInt(id))
      const owner = await formExportService.getOwnerByVessel(seafarer.vessel_name_raw)
      const data = formExportService.buildSeafarerRow(seafarer, owner)

      return { formKey, label: meta.label, seafarerName: seafarer.full_name, data }
    }
  )

  // GET /api/v1/seafarers/export  ← phải trước /:id
  fastify.get(
    '/export',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { search, status, rank_id, rank_ids } = request.query
      const parsedRankIds = String(rank_ids || '')
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => Number.isInteger(v) && v > 0)
      const buffer = await seafarerService.exportExcel({
        search,
        status,
        rank_id,
        rank_ids: parsedRankIds,
      })
      const filename = `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(buffer)
    }
  )

  // GET /api/v1/seafarers (TASK-B5: training_center thấy pool giới hạn field + ?available_for_training=true)
  fastify.post(
    '/dispatch-decision-selection',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              minItems: 1,
              items: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request) => {
      return seafarerDispatchDecisionService.getSelection(request.body.ids)
    }
  )

  fastify.post(
    '/export-dispatch-decision',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              minItems: 1,
              items: { type: 'integer' },
            },
            vessel_name: { type: 'string' },
            embark_date_from: { type: 'string', format: 'date' },
            embark_date_to: { type: 'string', format: 'date' },
            embark_location: { type: 'string' },
            actual_embark_date: { type: 'string', format: 'date' },
            decision_number: { type: 'string' },
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  seafarer_id: { type: 'integer' },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { buffer, filename } = await seafarerDispatchDecisionService.exportDecision(
        request.body
      )
      const encoded = encodeURIComponent(filename)
      reply
        .header('Content-Type', seafarerDispatchDecisionService.DOCX_MIME)
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`)
      return reply.send(buffer)
    }
  )

  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, default: 20 },
            search: { type: 'string' },
            status: { type: 'string' },
            vessel_name: { type: 'string' },
            rank_id: { type: 'integer' },
            rank_ids: { type: 'string' },
            sort_by: { type: 'string' },
            sort_order: { type: 'string' },
            available_for_training: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const {
        page,
        limit,
        search,
        status,
        vessel_name,
        rank_id,
        rank_ids,
        sort_by,
        sort_order,
        available_for_training,
      } = request.query
      const parsedRankIds = String(rank_ids || '')
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => Number.isInteger(v) && v > 0)
      const safePage = Math.max(parseInt(page) || 1, 1)
      const safeLimit = Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT)
      return seafarerService
        .list(
          {
            page: safePage,
            limit: safeLimit,
            search,
            status,
            vessel_name,
            rank_id: parseInt(rank_id) || null,
            rank_ids: parsedRankIds,
            sort_by: sort_by || 'updated_at',
            sort_order: sort_order || 'desc',
            // sort_by: sort_by || 'rank',
            // sort_order: sort_order || 'asc',
            available_for_training: available_for_training || null,
          },
          request.user.role
        )
        .then(async (result) => {
          const ids = result.data.map((r) => r.id)
          const callSummary = await seafarerCallService.getSummary(ids)
          result.data = result.data.map((r) => ({
            ...r,
            call_count: callSummary[r.id]?.call_count || 0,
            first_call_at: callSummary[r.id]?.first_call_at || null,
            last_call_at: callSummary[r.id]?.last_call_at || null,
            last_call_note: callSummary[r.id]?.last_call_note || null,
          }))
          return result
        })
    }
  )

  // GET /api/v1/seafarers/:id (TASK-B5: training_center chỉ thấy field được phép + certificates rút gọn)
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return seafarerService.getById(parseInt(request.params.id), request.user.role)
    }
  )

  // POST /api/v1/seafarers
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['full_name', 'date_of_birth', 'nationality_id'],
          properties: {
            full_name: { type: 'string' },
            date_of_birth: { type: 'string', format: 'date' },
            nationality_id: { type: 'integer' },
            seafarer_code: { type: 'string' },
            shoe_size: { type: 'string' },
            protective_size: { type: 'string' },
            phone_primary: { type: 'string' },
            status: { type: 'string' },
            current_rank_id: { type: 'integer' },
            personal_bank_account_number: { type: 'string' },
            salary_bank_account_number: { type: 'string' },
            permanent_ward: { type: 'string' },
            permanent_district: { type: 'string' },
            permanent_province: { type: 'string' },
            permanent_address: { type: 'string' },
            height_cm: { type: 'number' },
            weight_kg: { type: 'number' },
            avatar_url: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      const seafarer = await seafarerService.create(request.body, request.user.id)
      return reply.code(201).send(seafarer)
    }
  )

  // PUT /api/v1/seafarers/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      return seafarerService.update(parseInt(request.params.id), request.body, request.user.id)
    }
  )

  // POST /api/v1/seafarers/:id/avatar
  fastify.post(
    '/:id/avatar',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      const file = await request.file()
      if (!file) return reply.code(400).send({ error: 'Không có file được gửi lên' })
      return seafarerService.uploadAvatar(parseInt(request.params.id), file, request.user.id)
    }
  )

  // GET /api/v1/seafarers/:id/educations
  fastify.get(
    '/:id/educations',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return seafarerService.getEducations(parseInt(request.params.id))
    }
  )

  // PUT /api/v1/seafarers/:id/educations
  fastify.put(
    '/:id/educations',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'array',
          items: {
            type: 'object',
            required: ['school_name'],
            properties: {
              graduation_level: { type: 'string' },
              degree_rating: { type: 'string' },
              school_name: { type: 'string' },
              major: { type: 'string' },
              graduation_year: { type: 'integer' },
              enrollment_year: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      return seafarerService.replaceEducations(
        parseInt(request.params.id),
        request.body,
        request.user.id
      )
    }
  )

  // DELETE /api/v1/seafarers/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      return seafarerService.softDelete(parseInt(request.params.id), request.user.id)
    }
  )
}

async function seafarerContactRoutes(fastify) {
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
    },
    async (request) => {
      return seafarerService.getContacts(parseInt(request.params.seafarerId))
    }
  )

  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['full_name', 'relationship'],
          properties: {
            full_name: { type: 'string' },
            relationship: { type: 'string' },
            is_emergency_contact: { type: 'integer' },
            is_guarantor: { type: 'integer' },
            date_of_birth: { type: 'string', format: 'date' },
            address: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const contact = await seafarerService.createContact(
        parseInt(request.params.seafarerId),
        request.body
      )
      return reply.code(201).send(contact)
    }
  )

  fastify.delete(
    '/:contactId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        return await seafarerService.deleteContact(
          parseInt(request.params.seafarerId),
          parseInt(request.params.contactId)
        )
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )

  fastify.put(
    '/:contactId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            full_name: { type: 'string' },
            relationship: { type: 'string' },
            is_emergency_contact: { type: 'integer' },
            is_guarantor: { type: 'integer' },
            date_of_birth: { type: 'string', format: 'date' },
            address: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return await seafarerService.updateContact(
          parseInt(request.params.seafarerId),
          parseInt(request.params.contactId),
          request.body
        )
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )
}

module.exports = seafarerRoutes
module.exports.seafarerContactRoutes = seafarerContactRoutes
