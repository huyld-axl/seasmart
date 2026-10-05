const pool = require('../config/db')
const emailService = require('./email.service')
const waitlistService = require('./waitlist.service')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

async function getEnrollmentDetailsForEmail(enrollmentId) {
  const [[row]] = await pool.query(
    `SELECT e.id, e.reject_reason,
            s.full_name as seafarer_name, s.email as seafarer_email,
            tc.name as course_name, tc.start_date, tc.location,
            ctr.email as center_email
     FROM training_enrollment e
     JOIN seafarer s ON s.id = e.seafarer_id
     JOIN training_course tc ON tc.id = e.course_id
     JOIN training_center ctr ON ctr.id = tc.training_center_id
     WHERE e.id = ? AND e.deleted_at IS NULL`,
    [enrollmentId]
  )
  return row
}

function notifyEnrollmentPending(enrollmentId) {
  getEnrollmentDetailsForEmail(enrollmentId)
    .then((d) => {
      if (d && d.center_email) {
        return emailService.sendEnrollmentPending(d.center_email, {
          seafarer_name: d.seafarer_name,
          course_name: d.course_name,
          approve_url: `${FRONTEND_URL}/courses?enrollment=${enrollmentId}`,
        })
      }
    })
    .catch((err) => console.error('[Enrollment] notifyEnrollmentPending error', err))
}

function notifyEnrollmentApproved(enrollmentId) {
  getEnrollmentDetailsForEmail(enrollmentId)
    .then((d) => {
      if (d && d.seafarer_email) {
        const startDate = d.start_date ? new Date(d.start_date).toLocaleDateString('vi-VN') : ''
        return emailService.sendEnrollmentApproved(d.seafarer_email, {
          course_name: d.course_name,
          start_date: startDate,
          location: d.location || 'Theo thông báo của trung tâm',
        })
      }
    })
    .catch((err) => console.error('[Enrollment] notifyEnrollmentApproved error', err))
}

function notifyEnrollmentRejected(enrollmentId, rejectReason) {
  getEnrollmentDetailsForEmail(enrollmentId)
    .then((d) => {
      if (d && d.seafarer_email) {
        return emailService.sendEnrollmentRejected(d.seafarer_email, {
          course_name: d.course_name,
          reject_reason: rejectReason || d.reject_reason || 'Không nêu rõ',
        })
      }
    })
    .catch((err) => console.error('[Enrollment] notifyEnrollmentRejected error', err))
}

const enrollmentService = {
  async list({ page = 1, limit = 20, course_id, seafarer_id, result, status, training_center_id }) {
    const offset = (page - 1) * limit
    const where = ['e.deleted_at IS NULL']
    const params = []

    if (course_id) {
      where.push('e.course_id = ?')
      params.push(course_id)
    }
    if (seafarer_id) {
      where.push('e.seafarer_id = ?')
      params.push(seafarer_id)
    }
    if (result) {
      where.push('e.result = ?')
      params.push(result)
    }
    if (status) {
      where.push('e.status = ?')
      params.push(status)
    }
    if (training_center_id) {
      where.push('tc.training_center_id = ?')
      params.push(training_center_id)
    }

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM training_enrollment e
       LEFT JOIN training_course tc ON tc.id = e.course_id
       ${whereStr}`,
      params
    )

    const [rows] = await pool.query(
      `SELECT e.id, e.enrollment_date, e.status, e.result, e.grade, e.certificate_issued,
              e.total_score, e.created_at,
              s.full_name as seafarer_name, s.seafarer_code, s.phone_primary,
              tc.name as course_name, tc.course_code
       FROM training_enrollment e
       LEFT JOIN seafarer s ON s.id = e.seafarer_id
       LEFT JOIN training_course tc ON tc.id = e.course_id
       ${whereStr}
       ORDER BY e.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows, total, page, limit }
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT e.*,
              s.full_name as seafarer_name, s.seafarer_code,
              tc.name as course_name, tc.course_code, tc.max_students, tc.training_center_id
       FROM training_enrollment e
       LEFT JOIN seafarer s ON s.id = e.seafarer_id
       LEFT JOIN training_course tc ON tc.id = e.course_id
       WHERE e.id = ? AND e.deleted_at IS NULL`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy đăng ký' }

    // Lấy điểm chi tiết
    const [scores] = await pool.query(
      'SELECT * FROM enrollment_score WHERE enrollment_id = ? ORDER BY id',
      [id]
    )
    return { ...rows[0], scores }
  },

  async create(data, created_by, options = {}) {
    const { userRole, linkedEntityId } = options
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[course]] = await conn.query(
        `SELECT id, max_students, training_center_id, start_date, end_date
         FROM training_course WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
        [data.course_id]
      )
      if (!course) throw { statusCode: 404, message: 'Không tìm thấy khóa học' }

      if (userRole === 'training_center') {
        if (Number(course.training_center_id) !== Number(linkedEntityId)) {
          throw { statusCode: 403, message: 'Chỉ được enroll vào khóa học của trung tâm mình' }
        }
      }

      const [[enrolled]] = await conn.query(
        `SELECT COUNT(*) as cnt FROM training_enrollment WHERE course_id = ? AND deleted_at IS NULL
         AND status IN ('ACTIVE','APPROVED','COMPLETED')`,
        [data.course_id]
      )
      if (course.max_students && enrolled.cnt >= course.max_students) {
        throw { statusCode: 400, message: 'Khóa học đã đủ số học viên tối đa' }
      }

      const [[existing]] = await conn.query(
        'SELECT id FROM training_enrollment WHERE course_id = ? AND seafarer_id = ? AND deleted_at IS NULL',
        [data.course_id, data.seafarer_id]
      )
      if (existing) throw { statusCode: 400, message: 'Thuyền viên đã đăng ký khóa học này' }

      const warnings = []
      if (course.start_date && course.end_date) {
        const [conflict] = await conn.query(
          `SELECT ctr.name_vi as center_name, tc.name as course_name
           FROM training_enrollment e
           JOIN training_course tc ON tc.id = e.course_id
           JOIN training_center ctr ON ctr.id = tc.training_center_id
           WHERE e.seafarer_id = ? AND e.deleted_at IS NULL AND e.status IN ('APPROVED', 'ACTIVE')
             AND tc.start_date < ? AND tc.end_date > ?`,
          [data.seafarer_id, course.end_date, course.start_date]
        )
        if (conflict[0]) {
          warnings.push(
            `Thuyền viên đang có lịch học tại: ${conflict[0].center_name} - ${conflict[0].course_name}`
          )
        }
      }

      const status =
        data.status &&
        ['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'FAILED', 'WITHDRAWN', 'REJECTED'].includes(
          data.status
        )
          ? data.status
          : 'ACTIVE'
      const referredByCenterId =
        data.referred_by_center_id != null ? data.referred_by_center_id : null
      const insertData = {
        course_id: data.course_id,
        seafarer_id: data.seafarer_id,
        enrollment_date: data.enrollment_date || new Date().toISOString().slice(0, 10),
        rank_at_enrollment: data.rank_at_enrollment,
        notes: data.notes,
        status,
        referred_by_center_id: referredByCenterId,
      }

      const [result] = await conn.query(
        'INSERT INTO training_enrollment SET ?, created_by = ?, updated_by = ?',
        [insertData, created_by, created_by]
      )

      await conn.commit()
      const out = await this.getById(result.insertId)
      if (warnings.length) out.warnings = warnings
      if (out.status === 'PENDING') notifyEnrollmentPending(out.id)
      return out
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },

  async update(id, data, updated_by) {
    const enrollment = await this.getById(id)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(
        'UPDATE training_enrollment SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
        [data, updated_by, id]
      )

      // Nếu certificate_issued = true → tạo seafarer_certificate trong cùng transaction
      if (data.certificate_issued && !enrollment.certificate_issued) {
        const [cert] = await conn.query(
          `SELECT ct.certificate_type_id, ct.validity_years, e.seafarer_id
           FROM training_enrollment e
           JOIN training_course tc ON tc.id = e.course_id
           JOIN course_type ct ON ct.id = tc.course_type_id
           WHERE e.id = ?`,
          [id]
        )
        if (cert[0] && cert[0].certificate_type_id) {
          const issuedDate = new Date()
          let expiryDate = null
          if (cert[0].validity_years) {
            expiryDate = new Date(issuedDate)
            expiryDate.setFullYear(expiryDate.getFullYear() + cert[0].validity_years)
          }
          const [certResult] = await conn.query(
            `INSERT INTO seafarer_certificate
             (seafarer_id, certificate_type_id, issued_date, expiry_date, status, created_by, updated_by)
             VALUES (?, ?, ?, ?, 'VALID', ?, ?)`,
            [
              cert[0].seafarer_id,
              cert[0].certificate_type_id,
              issuedDate.toISOString().split('T')[0],
              expiryDate ? expiryDate.toISOString().split('T')[0] : null,
              updated_by,
              updated_by,
            ]
          )
          await conn.query('UPDATE training_enrollment SET certificate_id = ? WHERE id = ?', [
            certResult.insertId,
            id,
          ])
        }
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    return this.getById(id)
  },

  async addScores(enrollmentId, scores, created_by) {
    await this.getById(enrollmentId)

    for (const score of scores) {
      await pool.query(
        `INSERT INTO enrollment_score
         (enrollment_id, criteria_code, criteria_name, score, max_score, grade, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), grade = VALUES(grade), notes = VALUES(notes)`,
        [
          enrollmentId,
          score.criteria_code,
          score.criteria_name,
          score.score,
          score.max_score || null,
          score.grade || null,
          score.notes || null,
        ]
      )
    }

    return this.getById(enrollmentId)
  },

  async softDelete(id, updated_by) {
    await this.getById(id)
    await pool.query(
      'UPDATE training_enrollment SET deleted_at = NOW(), updated_by = ? WHERE id = ?',
      [updated_by, id]
    )
    return { success: true }
  },

  // TASK-B1: Duyệt đăng ký (chỉ PENDING)
  async approve(id, userId, notes, userRole, linkedEntityId) {
    const enrollment = await this.getById(id)
    if (enrollment.status !== 'PENDING') {
      throw { statusCode: 400, message: 'Chỉ duyệt được đăng ký ở trạng thái PENDING' }
    }
    if (userRole === 'training_center') {
      if (Number(enrollment.training_center_id) !== Number(linkedEntityId)) {
        throw {
          statusCode: 403,
          message: 'Chỉ được duyệt đăng ký thuộc khóa học của trung tâm mình',
        }
      }
    }
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM training_enrollment
       WHERE course_id = ? AND deleted_at IS NULL AND status IN ('ACTIVE','APPROVED','COMPLETED')`,
      [enrollment.course_id]
    )
    if (enrollment.max_students && cnt >= enrollment.max_students) {
      throw { statusCode: 409, message: 'Khóa học đã đủ số học viên tối đa' }
    }
    await pool.query(
      `UPDATE training_enrollment SET status = 'APPROVED', approved_by = ?, approved_at = NOW(),
       notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?`,
      [userId, notes || null, id]
    )
    notifyEnrollmentApproved(id)
    return this.getById(id)
  },

  async getTrainingHistory(seafarerId, userRole) {
    const scoreFields = userRole !== 'training_center' ? ', e.total_score, e.grade' : ''
    const [rows] = await pool.query(
      `SELECT e.id, e.enrollment_date, e.status, e.result, e.certificate_issued,
              tc.name as course_name, tc.start_date, tc.end_date,
              ctr.name_vi as center_name, e.referred_by_center_id${scoreFields}
       FROM training_enrollment e
       JOIN training_course tc ON tc.id = e.course_id
       JOIN training_center ctr ON ctr.id = tc.training_center_id
       WHERE e.seafarer_id = ? AND e.deleted_at IS NULL
       ORDER BY e.enrollment_date DESC`,
      [seafarerId]
    )
    return rows
  },

  async reject(id, userId, reason, userRole, linkedEntityId) {
    if (!reason || !String(reason).trim()) {
      throw { statusCode: 400, message: 'Cần có lý do từ chối' }
    }
    const enrollment = await this.getById(id)
    if (enrollment.status !== 'PENDING') {
      throw { statusCode: 400, message: 'Chỉ từ chối được đăng ký ở trạng thái PENDING' }
    }
    if (userRole === 'training_center') {
      if (Number(enrollment.training_center_id) !== Number(linkedEntityId)) {
        throw {
          statusCode: 403,
          message: 'Chỉ được từ chối đăng ký thuộc khóa học của trung tâm mình',
        }
      }
    }
    await pool.query(
      `UPDATE training_enrollment SET status = 'REJECTED', approved_by = ?, approved_at = NOW(),
       reject_reason = ?, updated_at = NOW() WHERE id = ?`,
      [userId, String(reason).trim(), id]
    )
    notifyEnrollmentRejected(id, String(reason).trim())
    waitlistService
      .promoteNext(enrollment.course_id)
      .catch((err) => console.error('[Enrollment] promoteNext error', err))
    return this.getById(id)
  },

  notifyEnrollmentPending(enrollmentId) {
    notifyEnrollmentPending(enrollmentId)
  },
}

module.exports = enrollmentService
