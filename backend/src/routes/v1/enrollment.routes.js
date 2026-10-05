const enrollmentService = require('../../services/enrollment.service')
const {
  importEnrollments,
  getEnrollmentImportTemplateBuffer,
} = require('../../services/import.service')

const ADMIN_ROLES = ['admin', 'operator', 'training_center']
const MAX_LIST_LIMIT = 100

async function enrollmentRoutes(fastify) {
  // GET /api/v1/enrollments/import/template (TASK-B4) — phải trước /:id
  fastify.get(
    '/import/template',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      const buffer = getEnrollmentImportTemplateBuffer()
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      reply.header('Content-Disposition', 'attachment; filename="enrollment_import_template.xlsx"')
      return reply.send(buffer)
    }
  )

  // POST /api/v1/enrollments/import (TASK-B4) — multipart: course_id + file
  fastify.post(
    '/import',
    {
      onRequest: [fastify.authenticate],
      config: { bodyLimit: 5 * 1024 * 1024 },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      try {
        let courseId = null
        let buffer = null
        const parts = request.parts()
        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'course_id') courseId = parseInt(await part.value) || null
          } else if (part.type === 'file' && part.fieldname === 'file') {
            const chunks = []
            for await (const chunk of part.file) chunks.push(chunk)
            buffer = Buffer.concat(chunks)
          }
        }
        if (!courseId) return reply.code(400).send({ error: 'Thiếu course_id' })
        if (!buffer || buffer.length === 0)
          return reply.code(400).send({ error: 'Thiếu file Excel' })
        const result = await importEnrollments(
          courseId,
          buffer,
          request.user.id,
          request.user.role,
          request.user.linked_entity_id
        )
        return result
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )

  // GET /api/v1/enrollments
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_LIMIT, default: 20 },
            course_id: { type: 'integer' },
            seafarer_id: { type: 'integer' },
            training_center_id: { type: 'integer' },
            result: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const {
        page,
        limit,
        course_id,
        seafarer_id,
        result,
        status,
        training_center_id: qTcId,
      } = request.query
      // training_center role: force filter by own TC, ignore client param
      const training_center_id =
        request.user.role === 'training_center'
          ? (request.user.linked_entity_id ?? null)
          : parseInt(qTcId) || null

      const safePage = Math.max(parseInt(page) || 1, 1)
      const safeLimit = Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT)
      return enrollmentService.list({
        page: safePage,
        limit: safeLimit,
        course_id: parseInt(course_id) || null,
        seafarer_id: parseInt(seafarer_id) || null,
        training_center_id,
        result,
        status: status || null,
      })
    }
  )

  // GET /api/v1/enrollments/:seafarerId/training-history (TASK-B6) — phải trước /:id
  fastify.get(
    '/:seafarerId/training-history',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      const seafarerId = parseInt(request.params.seafarerId)
      const rows = await enrollmentService.getTrainingHistory(seafarerId, request.user.role)
      return rows
    }
  )

  // GET /api/v1/enrollments/:id
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const enrollment = await enrollmentService.getById(parseInt(request.params.id))
      if (request.user.role === 'training_center' && enrollment.training_center_id != null) {
        if (Number(enrollment.training_center_id) !== Number(request.user.linked_entity_id)) {
          return reply.code(403).send({ error: 'Không có quyền xem đăng ký này' })
        }
      }
      return enrollment
    }
  )

  // POST /api/v1/enrollments (TASK-B6: referred_by_center_id, warnings)
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['course_id', 'seafarer_id'],
          properties: {
            course_id: { type: 'integer' },
            seafarer_id: { type: 'integer' },
            enrollment_date: { type: 'string', format: 'date' },
            rank_at_enrollment: { type: 'string' },
            notes: { type: 'string' },
            referred_by_center_id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      const enrollment = await enrollmentService.create(request.body, request.user.id, {
        userRole: request.user.role,
        linkedEntityId: request.user.linked_entity_id,
      })
      return reply.code(201).send(enrollment)
    }
  )

  // PUT /api/v1/enrollments/:id/approve (TASK-B1)
  fastify.put(
    '/:id/approve',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: { notes: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      try {
        const out = await enrollmentService.approve(
          parseInt(request.params.id),
          request.user.id,
          request.body?.notes,
          request.user.role,
          request.user.linked_entity_id
        )
        return out
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )

  // PUT /api/v1/enrollments/:id/reject (TASK-B1)
  fastify.put(
    '/:id/reject',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      try {
        const out = await enrollmentService.reject(
          parseInt(request.params.id),
          request.user.id,
          request.body?.reason,
          request.user.role,
          request.user.linked_entity_id
        )
        return out
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message })
      }
    }
  )

  // PUT /api/v1/enrollments/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      return enrollmentService.update(parseInt(request.params.id), request.body, request.user.id)
    }
  )

  // POST /api/v1/enrollments/:id/scores
  fastify.post(
    '/:id/scores',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['scores'],
          properties: {
            scores: {
              type: 'array',
              items: {
                type: 'object',
                required: ['criteria_code', 'criteria_name', 'score'],
                properties: {
                  criteria_code: { type: 'string' },
                  criteria_name: { type: 'string' },
                  score: { type: 'number' },
                  max_score: { type: 'number' },
                  grade: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      return enrollmentService.addScores(
        parseInt(request.params.id),
        request.body.scores,
        request.user.id
      )
    }
  )

  // DELETE /api/v1/enrollments/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện thao tác này' })
      }
      return enrollmentService.softDelete(parseInt(request.params.id), request.user.id)
    }
  )
}

module.exports = enrollmentRoutes
