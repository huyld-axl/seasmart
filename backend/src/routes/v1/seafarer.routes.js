const seafarerService = require('../../services/seafarer.service')
const formExportService = require('../../services/form_export.service')

const ADMIN_ROLES = ['admin', 'operator']
const MAX_LIST_LIMIT = 100

async function seafarerRoutes(fastify) {
  // GET /api/v1/seafarers/forms — list available form templates
  fastify.get(
    '/forms',
    {
      onRequest: [fastify.authenticate],
    },
    async () => {
      return formExportService.listForms()
    }
  )

  // GET /api/v1/seafarers/:id/export-form/:formKey — fill and download a form
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

  // GET /api/v1/seafarers/export  ← phải trước /:id
  fastify.get(
    '/export',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { search, status, rank_id } = request.query
      const buffer = await seafarerService.exportExcel({ search, status, rank_id })
      const filename = `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(buffer)
    }
  )

  // GET /api/v1/seafarers (TASK-B5: training_center thấy pool giới hạn field + ?available_for_training=true)
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
            search: { type: 'string' },
            status: { type: 'string' },
            rank_id: { type: 'integer' },
            available_for_training: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const { page, limit, search, status, rank_id, available_for_training } = request.query
      const safePage = Math.max(parseInt(page) || 1, 1)
      const safeLimit = Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT)
      return seafarerService.list(
        {
          page: safePage,
          limit: safeLimit,
          search,
          status,
          rank_id: parseInt(rank_id) || null,
          available_for_training: available_for_training || null,
        },
        request.user.role
      )
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
            national_id: { type: 'string' },
            passport_number: { type: 'string' },
            seaman_book_number: { type: 'string' },
            gender: { type: 'string', enum: ['M', 'F'] },
            phone_primary: { type: 'string' },
            email: { type: 'string' },
            status: { type: 'string' },
            current_rank_id: { type: 'integer' },
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
            national_id: { type: 'string' },
            phone_primary: { type: 'string' },
            phone_secondary: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            occupation: { type: 'string' },
            workplace: { type: 'string' },
            guarantor_id_number: { type: 'string' },
            guarantor_id_issued_date: { type: 'string', format: 'date' },
            guarantor_id_issued_place: { type: 'string' },
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
}

module.exports = seafarerRoutes
module.exports.seafarerContactRoutes = seafarerContactRoutes
