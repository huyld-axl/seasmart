const pool = require('../config/db')
const enrollmentService = require('./enrollment.service')
const waitlistService = require('./waitlist.service')

// Fields seafarer được phép tự cập nhật qua portal
const PORTAL_ALLOWED_FIELDS = [
  'full_name_en',
  'phone_primary',
  'phone_secondary',
  'email',
  'permanent_address',
  'permanent_ward',
  'permanent_district',
  'permanent_province',
  'temporary_address',
  'marital_status',
  'children_count',
  'children_info',
  'children_ages',
  'height_cm',
  'weight_kg',
  'shirt_size',
  'pants_size',
  'bank_account_number',
  'bank_name',
  'bank_account_holder',
  'notes',
]

const seafarerPortalService = {
  async getProfile(userId) {
    const [rows] = await pool.query(
      `SELECT s.*, r.name_vi as rank_name, c.name_vi as nationality_name
       FROM seafarer s
       LEFT JOIN rank r ON r.id = s.current_rank_id
       LEFT JOIN country c ON c.id = s.nationality_id
       WHERE s.user_id = ? AND s.deleted_at IS NULL`,
      [userId]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Chưa có hồ sơ thuyền viên liên kết' }
    return rows[0]
  },

  async updateProfile(userId, data) {
    const profile = await this.getProfile(userId)

    // Chỉ cho phép cập nhật các trường trong whitelist
    const safeData = {}
    for (const key of PORTAL_ALLOWED_FIELDS) {
      if (data[key] !== undefined) safeData[key] = data[key]
    }
    if (Object.keys(safeData).length === 0) {
      throw { statusCode: 400, message: 'Không có trường hợp lệ để cập nhật' }
    }

    await pool.query('UPDATE seafarer SET ?, updated_at = NOW() WHERE id = ?', [
      safeData,
      profile.id,
    ])
    return this.getProfile(userId)
  },

  async getCertificates(userId, { page = 1, limit = 50 } = {}) {
    const profile = await this.getProfile(userId)
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT sc.*, ct.name_vi as certificate_type_name, c.name_vi as issued_at_country_name
       FROM seafarer_certificate sc
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN country c ON c.id = sc.issued_at_country_id
       WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
       ORDER BY sc.expiry_date ASC
       LIMIT ? OFFSET ?`,
      [profile.id, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM seafarer_certificate WHERE seafarer_id = ? AND deleted_at IS NULL',
      [profile.id]
    )
    return { data: rows, total, page, limit }
  },

  async getContracts(userId, { page = 1, limit = 20 } = {}) {
    const profile = await this.getProfile(userId)
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT ec.*, v.name as vessel_name, vt.name_vi as vessel_type_name
       FROM employment_contract ec
       LEFT JOIN vessel v ON v.id = ec.vessel_id
       LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id
       WHERE ec.seafarer_id = ? AND ec.deleted_at IS NULL
       ORDER BY ec.start_date DESC
       LIMIT ? OFFSET ?`,
      [profile.id, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM employment_contract WHERE seafarer_id = ? AND deleted_at IS NULL',
      [profile.id]
    )
    return { data: rows, total, page, limit }
  },

  // TASK-B2: Danh sách khóa học đang mở đăng ký (PLANNED, ONGOING)
  async listOpenCourses(userId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT tc.id, tc.course_code, tc.name, tc.start_date, tc.end_date, tc.max_students,
              tc.fee_vnd, tc.fee_usd, tc.location,
              ctr.name_vi as training_center_name,
              (SELECT COUNT(*) FROM training_enrollment e WHERE e.course_id = tc.id AND e.deleted_at IS NULL
               AND e.status IN ('PENDING','APPROVED','ACTIVE','COMPLETED')) as enrolled_count
       FROM training_course tc
       JOIN training_center ctr ON ctr.id = tc.training_center_id
       WHERE tc.deleted_at IS NULL AND tc.status IN ('PLANNED', 'ONGOING')
       ORDER BY tc.start_date ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM training_course WHERE deleted_at IS NULL AND status IN (\'PLANNED\', \'ONGOING\')'
    )
    return { data: rows, total, page, limit }
  },

  async getEnrollments(userId, { page = 1, limit = 20 } = {}) {
    const profile = await this.getProfile(userId)
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT e.*, tc.name as course_name, tc.course_code,
              ctr.name_vi as training_center_name
       FROM training_enrollment e
       LEFT JOIN training_course tc ON tc.id = e.course_id
       LEFT JOIN training_center ctr ON ctr.id = tc.training_center_id
       WHERE e.seafarer_id = ? AND e.deleted_at IS NULL
       ORDER BY e.enrollment_date DESC
       LIMIT ? OFFSET ?`,
      [profile.id, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM training_enrollment WHERE seafarer_id = ? AND deleted_at IS NULL',
      [profile.id]
    )
    return { data: rows, total, page, limit }
  },

  async enroll(userId, courseId) {
    const profile = await this.getProfile(userId)
    const seafarerId = profile.id

    const [[course]] = await pool.query(
      `SELECT id, name, start_date, end_date, max_students
       FROM training_course WHERE id = ? AND deleted_at IS NULL AND status IN ('PLANNED', 'ONGOING')`,
      [courseId]
    )
    if (!course) throw { statusCode: 404, message: 'Khóa học không tồn tại hoặc chưa mở đăng ký' }

    const [[existing]] = await pool.query(
      `SELECT id, status FROM training_enrollment
       WHERE course_id = ? AND seafarer_id = ? AND deleted_at IS NULL
         AND status NOT IN ('REJECTED', 'WITHDRAWN')`,
      [courseId, seafarerId]
    )
    if (existing) throw { statusCode: 409, message: 'Bạn đã đăng ký khóa học này rồi' }

    const [[conflict]] = await pool.query(
      `SELECT tc.name as course_name FROM training_enrollment e
       JOIN training_course tc ON tc.id = e.course_id
       WHERE e.seafarer_id = ? AND e.deleted_at IS NULL
         AND e.status IN ('APPROVED', 'ACTIVE')
         AND tc.start_date < ? AND tc.end_date > ?`,
      [seafarerId, course.end_date, course.start_date]
    )
    if (conflict)
      throw { statusCode: 409, message: `Trùng lịch với khóa học: ${conflict.course_name}` }

    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM training_enrollment
       WHERE course_id = ? AND deleted_at IS NULL AND status IN ('PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED')`,
      [courseId]
    )
    const hasSlot = !course.max_students || cnt < course.max_students

    if (hasSlot) {
      const [result] = await pool.query(
        'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date) VALUES (?, ?, \'PENDING\', CURDATE())',
        [courseId, seafarerId]
      )
      enrollmentService.notifyEnrollmentPending(result.insertId)
      return {
        type: 'enrollment',
        id: result.insertId,
        status: 'PENDING',
        message: 'Đăng ký thành công, chờ duyệt',
      }
    }

    const [[waitExists]] = await pool.query(
      'SELECT id FROM enrollment_waitlist WHERE course_id = ? AND seafarer_id = ? AND status = ?',
      [courseId, seafarerId, 'WAITING']
    )
    if (waitExists) throw { statusCode: 409, message: 'Bạn đã có trong danh sách chờ khóa học này' }

    const [[{ nextPos }]] = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as nextPos FROM enrollment_waitlist WHERE course_id = ? AND status = \'WAITING\'',
      [courseId]
    )
    const [wr] = await pool.query(
      'INSERT INTO enrollment_waitlist (course_id, seafarer_id, position, status) VALUES (?, ?, ?, \'WAITING\')',
      [courseId, seafarerId, nextPos]
    )
    return {
      type: 'waitlist',
      id: wr.insertId,
      status: 'WAITING',
      message: 'Khóa học đã đủ, bạn đã được xếp vào danh sách chờ',
    }
  },

  async cancelEnrollment(userId, enrollmentId) {
    const profile = await this.getProfile(userId)
    const [rows] = await pool.query(
      'SELECT id, seafarer_id, status, course_id FROM training_enrollment WHERE id = ? AND deleted_at IS NULL',
      [enrollmentId]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy đăng ký' }
    if (Number(rows[0].seafarer_id) !== Number(profile.id)) {
      throw { statusCode: 403, message: 'Không có quyền hủy đăng ký này' }
    }
    if (String(rows[0].status) !== 'PENDING') {
      throw {
        statusCode: 409,
        message: 'Chỉ được hủy đăng ký khi trạng thái là chờ duyệt (PENDING)',
      }
    }
    const courseId = rows[0].course_id
    await pool.query('UPDATE training_enrollment SET status = ?, updated_at = NOW() WHERE id = ?', [
      'WITHDRAWN',
      enrollmentId,
    ])
    waitlistService
      .promoteNext(courseId)
      .catch((err) => console.error('[Portal] promoteNext error', err))
    return { success: true }
  },
}

module.exports = seafarerPortalService
