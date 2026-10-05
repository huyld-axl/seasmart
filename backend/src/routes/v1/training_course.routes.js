const trainingCourseService = require('../../services/training_course.service')

const MAX_LIST_LIMIT = 100

async function trainingCourseRoutes(fastify) {
  // GET /api/v1/training-courses
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
            training_center_id: { type: 'integer' },
            status: { type: 'string' },
            course_type_id: { type: 'integer' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const { page, limit, training_center_id, status, course_type_id, search } = request.query
      const safePage = Math.max(parseInt(page) || 1, 1)
      const safeLimit = Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT)
      return trainingCourseService.list({
        page: safePage,
        limit: safeLimit,
        training_center_id: parseInt(training_center_id) || null,
        status,
        course_type_id: parseInt(course_type_id) || null,
        search,
        requestUser: request.user,
      })
    }
  )

  // GET /api/v1/training-courses/:id
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const course = await trainingCourseService.getById(parseInt(request.params.id))
      if (request.user.role === 'training_center' && course && course.training_center_id != null) {
        if (Number(course.training_center_id) !== Number(request.user.linked_entity_id)) {
          return reply.code(403).send({ error: 'Không có quyền xem khóa học này' })
        }
      }
      return course
    }
  )

  // POST /api/v1/training-courses
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'training_center_id'],
          properties: {
            course_code: { type: 'string' },
            course_type_id: { type: 'integer' },
            training_center_id: { type: 'integer' },
            name: { type: 'string' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            location: { type: 'string' },
            max_students: { type: 'integer' },
            fee_vnd: { type: 'number' },
            fee_usd: { type: 'number' },
            instructor: { type: 'string' },
            status: { type: 'string', enum: ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator', 'training_center'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
      const course = await trainingCourseService.create(request.body, request.user.id)
      return reply.code(201).send(course)
    }
  )

  // PUT /api/v1/training-courses/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator', 'training_center'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
      return trainingCourseService.update(
        parseInt(request.params.id),
        request.body,
        request.user.id
      )
    }
  )

  // DELETE /api/v1/training-courses/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
      return trainingCourseService.softDelete(parseInt(request.params.id), request.user.id)
    }
  )
}

module.exports = trainingCourseRoutes
