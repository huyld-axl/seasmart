const seafarerPortalService = require('../../services/seafarer_portal.service')
const certificateService = require('../../services/certificate.service')

async function seafarerPortalRoutes(fastify) {
  // Middleware kiểm tra role seafarer
  const onlySeafarer = async (request, reply) => {
    await fastify.authenticate(request, reply)
    if (request.user.role !== 'seafarer') {
      return reply.code(403).send({ error: 'Chỉ dành cho thuyền viên' })
    }
  }

  // GET /api/v1/portal/seafarer/profile
  fastify.get('/profile', { onRequest: [onlySeafarer] }, async (request) => {
    return seafarerPortalService.getProfile(request.user.id)
  })

  // PUT /api/v1/portal/seafarer/profile
  fastify.put('/profile', { onRequest: [onlySeafarer] }, async (request) => {
    return seafarerPortalService.updateProfile(request.user.id, request.body)
  })

  // GET /api/v1/portal/seafarer/certificates
  fastify.get('/certificates', { onRequest: [onlySeafarer] }, async (request) => {
    const { page, limit } = request.query
    return seafarerPortalService.getCertificates(request.user.id, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100),
    })
  })

  // GET /api/v1/portal/seafarer/contracts
  fastify.get('/contracts', { onRequest: [onlySeafarer] }, async (request) => {
    const { page, limit } = request.query
    return seafarerPortalService.getContracts(request.user.id, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
    })
  })

  // GET /api/v1/portal/seafarer/courses — khóa học đang mở đăng ký (TASK-B2)
  fastify.get('/courses', { onRequest: [onlySeafarer] }, async (request) => {
    const { page, limit } = request.query
    return seafarerPortalService.listOpenCourses(request.user.id, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100),
    })
  })

  // GET /api/v1/portal/seafarer/enrollments
  fastify.get('/enrollments', { onRequest: [onlySeafarer] }, async (request) => {
    const { page, limit } = request.query
    return seafarerPortalService.getEnrollments(request.user.id, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
    })
  })

  // POST /api/v1/portal/seafarer/enrollments
  fastify.post(
    '/enrollments',
    {
      onRequest: [onlySeafarer],
      schema: {
        body: {
          type: 'object',
          required: ['course_id'],
          properties: {
            course_id: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await seafarerPortalService.enroll(request.user.id, request.body.course_id)
      return reply.code(201).send(result)
    }
  )

  // DELETE /api/v1/portal/seafarer/enrollments/:id
  fastify.delete('/enrollments/:id', { onRequest: [onlySeafarer] }, async (request, reply) => {
    try {
      await seafarerPortalService.cancelEnrollment(request.user.id, parseInt(request.params.id))
      return reply.code(204).send()
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // POST /api/v1/portal/seafarer/certificates — multipart: fields + optional file, or JSON body
  fastify.post('/certificates', { onRequest: [onlySeafarer] }, async (request, reply) => {
    try {
      const profile = await seafarerPortalService.getProfile(request.user.id)
      let certData = {
        certificate_type_id: null,
        certificate_number: null,
        issued_date: null,
        expiry_date: null,
      }
      let filePart = null

      const contentType = request.headers['content-type'] || ''
      if (contentType.includes('multipart/form-data')) {
        const parts = request.parts()
        for await (const part of parts) {
          if (part.type === 'field') {
            const v = part.value
            if (part.fieldname === 'certificate_type_id') certData.certificate_type_id = v
            else if (part.fieldname === 'certificate_number') certData.certificate_number = v
            else if (part.fieldname === 'issued_date') certData.issued_date = v
            else if (part.fieldname === 'expiry_date') certData.expiry_date = v
          } else if (part.type === 'file' && part.fieldname === 'file') {
            filePart = part
          }
        }
      } else {
        const b = request.body || {}
        certData = {
          certificate_type_id: b.certificate_type_id,
          certificate_number: b.certificate_number,
          issued_date: b.issued_date,
          expiry_date: b.expiry_date,
        }
      }

      const certificate_type_id = certData.certificate_type_id
        ? parseInt(certData.certificate_type_id)
        : null
      if (!certificate_type_id) {
        return reply.code(400).send({ error: 'Thiếu loại chứng chỉ (certificate_type_id)' })
      }
      const payload = {
        certificate_type_id,
        certificate_number: certData.certificate_number || undefined,
        issued_date: certData.issued_date || undefined,
        expiry_date: certData.expiry_date || undefined,
      }
      const cert = await certificateService.create(profile.id, payload, request.user.id)
      if (filePart) {
        await certificateService.uploadFile(cert.id, profile.id, filePart, request.user.id)
      }
      const updated = await certificateService.getById(cert.id, profile.id)
      return reply.code(201).send(updated)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // DELETE /api/v1/portal/seafarer/certificates/:id — chỉ xóa chứng chỉ do mình tạo (created_by = user)
  fastify.delete('/certificates/:id', { onRequest: [onlySeafarer] }, async (request, reply) => {
    try {
      const profile = await seafarerPortalService.getProfile(request.user.id)
      const certId = parseInt(request.params.id)
      const cert = await certificateService.getById(certId, profile.id)
      if (Number(cert.created_by) !== Number(request.user.id)) {
        return reply.code(403).send({ error: 'Chỉ được xóa chứng chỉ do bạn tự thêm' })
      }
      await certificateService.softDelete(certId, profile.id, request.user.id)
      return reply.code(204).send()
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })
}

module.exports = seafarerPortalRoutes
