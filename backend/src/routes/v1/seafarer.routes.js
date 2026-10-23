const seafarerService = require('../../services/seafarer.service')
const formExportService = require('../../services/form_export.service')
const config = require('../../config')
const fs = require('fs')
const { ownerIdFor, assertSeafarerInScope } = require('../../utils/scope')
const { assertInScope } = require('../../plugins/access')

const MAX_LIST_LIMIT = 100

async function seafarerRoutes(fastify) {
  // GET /api/v1/seafarers/forms — list available form templates
  fastify.get(
    '/forms',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async () => {
      return formExportService.listForms()
    }
  )

  // GET /api/v1/seafarers/:id/export-form/:formKey — fill and download a form
  fastify.get(
    '/:id/export-form/:formKey',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request, reply) => {
      const { id, formKey } = request.params
      await assertSeafarerInScope(request, parseInt(id))
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
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request, reply) => {
      const { search, status, rank_id } = request.query
      const buffer = await seafarerService.exportExcel({
        search,
        status,
        rank_id,
        ownerId: ownerIdFor(request, 'seafarer'),
      })
      const filename = `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(buffer)
    }
  )

  // GET /api/v1/seafarers
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_LIMIT, default: 20 },
            search: { type: 'string' },
            status: { type: 'string' },
            rank_id: { type: 'integer' },
            tab: { type: 'string', enum: ['all', 'onboard', 'standby', 'inactive'] },
            sort: { type: 'string', enum: ['newest', 'name_asc', 'name_desc'] },
            // Bộ lọc nâng cao: danh sách id cách nhau bằng dấu phẩy.
            rank_ids: { type: 'string', pattern: '^[0-9,]*$' },
            vessel_ids: { type: 'string', pattern: '^[0-9,]*$' },
            certificate_type_ids: { type: 'string', pattern: '^[0-9,]*$' },
            age_min: { type: 'integer', minimum: 0, maximum: 120 },
            age_max: { type: 'integer', minimum: 0, maximum: 120 },
          },
        },
      },
    },
    async (request) => {
      const { page, limit, search, status, rank_id, tab, age_min, age_max } = request.query
      const ids = (text) => [...new Set((text || '').split(',').map((n) => parseInt(n)).filter((n) => n > 0))].slice(0, 50)
      const safePage = Math.max(parseInt(page) || 1, 1)
      const safeLimit = Math.min(parseInt(limit) || 20, MAX_LIST_LIMIT)
      return seafarerService.list(
        {
          page: safePage,
          limit: safeLimit,
          search,
          status,
          rank_id: parseInt(rank_id) || null,
          tab: tab || null,
          ownerId: ownerIdFor(request, 'seafarer'),
          rankIds: ids(request.query.rank_ids),
          vesselIds: ids(request.query.vessel_ids),
          certTypeIds: ids(request.query.certificate_type_ids),
          ageMin: age_min ?? null,
          ageMax: age_max ?? null,
          sort: request.query.sort || null,
        }
      )
    }
  )

  // GET /api/v1/seafarers/:id
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request) => {
      const seafarer = await seafarerService.getById(parseInt(request.params.id))
      assertInScope(request, 'seafarer', seafarer, 'Không tìm thấy thuyền viên')
      return seafarer
    }
  )

  // POST /api/v1/seafarers
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.create')],
      schema: {
        body: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: { type: 'string', minLength: 1 },
            date_of_birth: { type: 'string', format: 'date' },
            nationality_id: { type: 'integer' },
            seafarer_code: { type: 'string' },
            national_id: { type: 'string' },
            passport_number: { type: 'string' },
            seaman_book_number: { type: 'string' },
            gender: { type: 'string', enum: ['M', 'F', 'O'] },
            phone_primary: { type: 'string' },
            zalo: { type: ['string', 'null'], maxLength: 300 },
            email: { type: 'string' },
            status: { type: 'string' },
            current_rank_id: { type: 'integer' },
            bank_accounts: { type: 'array', maxItems: 20, items: { type: 'object' } },
            contacts: { type: 'array', maxItems: 30, items: { type: 'object' } },
          },
        },
      },
    },
    async (request, reply) => {
      const seafarer = await seafarerService.create(request.body, request.user.id)
      return reply.code(201).send(seafarer)
    }
  )

  // PUT /api/v1/seafarers/:id
  fastify.put(
    '/:id',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.id))
      const { reason, ...data } = request.body || {}
      return seafarerService.update(parseInt(request.params.id), data, request.user.id, reason)
    }
  )

  // Ảnh chân dung 4x6: GET trả ảnh, POST (multipart, field "file") thay ảnh, DELETE gỡ ảnh.
  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }

  fastify.get('/:id/photo', {
    onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    schema: { params: idParams, querystring: { type: 'object', properties: { size: { type: 'string', enum: ['thumb', 'full'], default: 'full' } } } },
  }, async (request, reply) => {
    await assertSeafarerInScope(request, request.params.id)
    const photo = await seafarerService.getPhoto(request.params.id, request.query.size)
    reply.header('Content-Type', photo.mime)
    reply.header('Cache-Control', 'private, no-cache')
    return reply.send(fs.createReadStream(photo.path))
  })

  fastify.post('/:id/photo', { onRequest: [fastify.authenticate, fastify.can('seafarer.update')], schema: { params: idParams } }, async (request) => {
    await assertSeafarerInScope(request, request.params.id)
    const file = await request.file({ limits: { fileSize: config.upload.maxFileSize, files: 1 } })
    if (!file) throw { statusCode: 400, message: 'Chưa chọn ảnh' }
    return seafarerService.savePhoto(request.params.id, file, request.user.id)
  })

  fastify.delete('/:id/photo', { onRequest: [fastify.authenticate, fastify.can('seafarer.update')], schema: { params: idParams } }, async (request) => {
    await assertSeafarerInScope(request, request.params.id)
    return seafarerService.removePhoto(request.params.id, request.user.id)
  })

  // Tạm ngưng / kích hoạt lại thuyền viên (INACTIVE <-> AVAILABLE).
  for (const [path, active] of [['deactivate', false], ['activate', true]]) {
    fastify.post(`/:id/${path}`, { onRequest: [fastify.authenticate, fastify.can('seafarer.update')], schema: { params: idParams } }, async (request) => {
      await assertSeafarerInScope(request, request.params.id)
      return seafarerService.setActive(request.params.id, active, request.user.id)
    })
  }

  // GET /api/v1/seafarers/:id/revisions — lịch sử sửa hồ sơ
  fastify.get(
    '/:id/revisions',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } },
    },
    async (request) => {
      await assertSeafarerInScope(request, request.params.id)
      return seafarerService.revisions(request.params.id)
    }
  )

  // DELETE /api/v1/seafarers/:id
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.delete')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.id))
      return seafarerService.softDelete(parseInt(request.params.id), request.user.id)
    }
  )
}

async function seafarerContactRoutes(fastify) {
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.view')],
    },
    async (request) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
      return seafarerService.getContacts(parseInt(request.params.seafarerId))
    }
  )

  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
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
            zalo: { type: ['string', 'null'], maxLength: 300 },
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
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
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
      onRequest: [fastify.authenticate, fastify.can('seafarer.update')],
    },
    async (request, reply) => {
      await assertSeafarerInScope(request, parseInt(request.params.seafarerId))
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
