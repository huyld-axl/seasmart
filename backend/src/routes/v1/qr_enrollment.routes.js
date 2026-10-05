const pool = require('../../config/db')
const crypto = require('crypto')
const enrollmentService = require('../../services/enrollment.service')

// TTL: 30 days
const QR_TTL_DAYS = 30

async function qrEnrollmentRoutes(fastify) {
  // POST /api/v1/qr-enrollment/generate - TC staff generates a QR link (TASK-B3: label, max_uses, expires_at)
  fastify.post(
    '/generate',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            course_id: { type: 'integer' },
            label: { type: 'string' },
            max_uses: { type: 'integer' },
            expires_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const { role, id: userId } = request.user
      if (!['admin', 'operator', 'accountant'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền tạo QR' })
      }

      let tcId = null
      const courseId = request.body.course_id || null
      if (role === 'accountant') {
        const [[tc]] = await pool.query(
          'SELECT id FROM training_center WHERE id = ? AND is_active = 1',
          [request.user.linked_entity_id]
        )
        if (!tc) return reply.code(400).send({ error: 'Không tìm thấy trung tâm đào tạo của bạn' })
        tcId = tc.id
      } else {
        if (courseId) {
          const [[course]] = await pool.query(
            'SELECT training_center_id FROM training_course WHERE id = ?',
            [courseId]
          )
          if (!course) return reply.code(404).send({ error: 'Không tìm thấy khóa học' })
          tcId = course.training_center_id
        } else {
          return reply.code(400).send({ error: 'Cần course_id' })
        }
      }

      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = request.body.expires_at
        ? new Date(request.body.expires_at)
        : new Date(Date.now() + QR_TTL_DAYS * 24 * 60 * 60 * 1000)
      const label = request.body.label || null
      const maxUses = request.body.max_uses != null ? parseInt(request.body.max_uses) : null

      await pool.query(
        `INSERT INTO qr_enrollment_link (token, training_center_id, course_id, created_by, expires_at, label, max_uses)
       VALUES (?,?,?,?,?,?,?)`,
        [
          token,
          tcId,
          courseId,
          userId,
          isNaN(expiresAt.getTime()) ? null : expiresAt,
          label,
          maxUses,
        ]
      )

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      return reply.code(201).send({
        token,
        qr_url: `${baseUrl}/enroll/${token}`,
        expires_at: expiresAt,
        label: label,
        max_uses: maxUses,
      })
    }
  )

  // GET /api/v1/qr-enrollment/:token - validate token & return course info (public, TASK-B3: max_uses)
  fastify.get('/:token', async (request, reply) => {
    const { token } = request.params
    const [[link]] = await pool.query(
      `SELECT q.*, tc.name_vi AS tc_name, tc.name_en AS tc_name_en,
              tc.address AS tc_address, tc.phone AS tc_phone,
              c.name AS course_name, c.start_date, c.end_date
       FROM qr_enrollment_link q
       JOIN training_center tc ON tc.id = q.training_center_id
       LEFT JOIN training_course c ON c.id = q.course_id
       WHERE q.token = ? AND q.is_active = 1`,
      [token]
    )
    if (!link) return reply.code(404).send({ error: 'Link không hợp lệ' })
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return reply.code(400).send({ error: 'QR link đã hết hạn' })
    }
    if (link.max_uses != null && link.used_count >= link.max_uses) {
      return reply.code(400).send({ error: 'QR link đã đạt giới hạn sử dụng' })
    }
    const [[{ slots_left }]] = link.course_id
      ? await pool.query(
          `SELECT c.max_students - (SELECT COUNT(*) FROM training_enrollment e WHERE e.course_id = c.id AND e.deleted_at IS NULL AND e.status IN ('PENDING','APPROVED','ACTIVE','COMPLETED')) as slots_left
           FROM training_course c WHERE c.id = ?`,
          [link.course_id]
        )
      : [{ slots_left: null }]
    return {
      training_center: {
        id: link.training_center_id,
        name_vi: link.tc_name,
        name_en: link.tc_name_en,
        address: link.tc_address,
        phone: link.tc_phone,
      },
      course: link.course_id
        ? {
            id: link.course_id,
            name: link.course_name,
            start_date: link.start_date,
            end_date: link.end_date,
            slots_left: slots_left,
          }
        : null,
      expires_at: link.expires_at,
    }
  })

  // POST /api/v1/qr-enrollment/:token/submit - seafarer submits enrollment form (public)
  fastify.post(
    '/:token/submit',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['full_name', 'date_of_birth', 'phone_primary'],
          properties: {
            full_name: { type: 'string' },
            date_of_birth: { type: 'string', format: 'date' },
            phone_primary: { type: 'string' },
            email: { type: 'string' },
            national_id: { type: 'string' },
            current_rank_id: { type: 'integer' },
            seaman_book_number: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params
      const [[link]] = await pool.query(
        'SELECT * FROM qr_enrollment_link WHERE token = ? AND is_active = 1',
        [token]
      )
      if (!link) return reply.code(404).send({ error: 'Link không hợp lệ' })
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return reply.code(400).send({ error: 'QR link đã hết hạn' })
      }
      if (link.max_uses != null && link.used_count >= link.max_uses) {
        return reply.code(400).send({ error: 'QR link đã đạt giới hạn sử dụng' })
      }

      const body = request.body

      // check if seafarer already exists by national_id or (phone + dob) dedup
      let seafarerId = null
      if (body.national_id) {
        const [[existing]] = await pool.query(
          'SELECT id FROM seafarer WHERE national_id = ? AND deleted_at IS NULL LIMIT 1',
          [body.national_id]
        )
        if (existing) seafarerId = existing.id
      } else if (body.phone_primary && body.date_of_birth) {
        // Dedup khi không có national_id
        const [[existing]] = await pool.query(
          'SELECT id FROM seafarer WHERE phone_primary = ? AND date_of_birth = ? AND deleted_at IS NULL LIMIT 1',
          [body.phone_primary, body.date_of_birth]
        )
        if (existing) seafarerId = existing.id
      }

      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()

        if (!seafarerId) {
          // get VN country id
          const [[vn]] = await conn.query('SELECT id FROM country WHERE code=\'VN\' LIMIT 1')
          const nationalityId = vn ? vn.id : 1

          const [res] = await conn.query(
            `INSERT INTO seafarer (full_name, date_of_birth, phone_primary, email,
            national_id, current_rank_id, seaman_book_number, nationality_id, status)
           VALUES (?,?,?,?,?,?,?,?,'STANDBY')`,
            [
              body.full_name,
              body.date_of_birth,
              body.phone_primary,
              body.email || null,
              body.national_id || null,
              body.current_rank_id || null,
              body.seaman_book_number || null,
              nationalityId,
            ]
          )
          seafarerId = res.insertId
        }

        // enroll in course if course_id present
        if (link.course_id) {
          const [[alreadyEnrolled]] = await conn.query(
            'SELECT id FROM training_enrollment WHERE course_id = ? AND seafarer_id = ?',
            [link.course_id, seafarerId]
          )
          if (!alreadyEnrolled) {
            const [ins] = await conn.query(
              'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date) VALUES (?,?,\'PENDING\',CURDATE())',
              [link.course_id, seafarerId]
            )
            if (ins.insertId) enrollmentService.notifyEnrollmentPending(ins.insertId)
          }
        }

        // increment used_count
        await conn.query('UPDATE qr_enrollment_link SET used_count = used_count + 1 WHERE id = ?', [
          link.id,
        ])

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }

      return reply.code(201).send({ seafarer_id: seafarerId, message: 'Đăng ký thành công' })
    }
  )

  // DELETE /api/v1/qr-enrollment/:id/deactivate (TASK-B3)
  fastify.delete(
    '/:id/deactivate',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { role } = request.user
      if (!['admin', 'operator', 'accountant'].includes(role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      const id = parseInt(request.params.id)
      const [[link]] = await pool.query(
        'SELECT id, training_center_id FROM qr_enrollment_link WHERE id = ?',
        [id]
      )
      if (!link) return reply.code(404).send({ error: 'Không tìm thấy QR link' })
      if (
        role === 'accountant' &&
        Number(link.training_center_id) !== Number(request.user.linked_entity_id)
      ) {
        return reply.code(403).send({ error: 'Chỉ được vô hiệu hóa QR của trung tâm mình' })
      }
      await pool.query('UPDATE qr_enrollment_link SET is_active = 0 WHERE id = ?', [id])
      return reply.code(204).send()
    }
  )
}

module.exports = qrEnrollmentRoutes
