const pool = require('../config/db')
const emailService = require('./email.service')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const waitlistService = {
  async promoteNext(courseId) {
    const [[next]] = await pool.query(
      `SELECT w.*, s.email as seafarer_email, s.full_name, tc.name as course_name
       FROM enrollment_waitlist w
       JOIN seafarer s ON s.id = w.seafarer_id
       JOIN training_course tc ON tc.id = w.course_id
       WHERE w.course_id = ? AND w.status = 'WAITING'
       ORDER BY w.position ASC
       LIMIT 1`,
      [courseId]
    )
    if (!next) return null

    const confirmBy = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await pool.query(
      'UPDATE enrollment_waitlist SET status = \'NOTIFIED\', notified_at = NOW(), confirm_by = ? WHERE id = ?',
      [confirmBy, next.id]
    )

    if (next.seafarer_email) {
      const confirmUrl = `${FRONTEND_URL}/seafarer/courses?waitlist_confirm=${next.id}`
      await emailService
        .sendWaitlistNotify(next.seafarer_email, {
          course_name: next.course_name,
          confirm_by: confirmBy.toLocaleString('vi-VN'),
          confirm_url: confirmUrl,
        })
        .catch((err) => console.error('[Waitlist] email error', err))
    }
    return { waitlist_id: next.id, seafarer_id: next.seafarer_id }
  },

  async confirmWaitlist(waitlistId, seafarerId) {
    const [[entry]] = await pool.query(
      'SELECT * FROM enrollment_waitlist WHERE id = ? AND seafarer_id = ? AND status = \'NOTIFIED\'',
      [waitlistId, seafarerId]
    )
    if (!entry) throw { statusCode: 404, message: 'Không tìm thấy hoặc đã xử lý' }
    if (new Date(entry.confirm_by) < new Date()) {
      throw { statusCode: 400, message: 'Đã hết thời gian xác nhận (24h)' }
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date) VALUES (?, ?, \'PENDING\', CURDATE())',
        [entry.course_id, entry.seafarer_id]
      )
      await conn.query('UPDATE enrollment_waitlist SET status = \'ENROLLED\' WHERE id = ?', [
        waitlistId,
      ])
      await conn.query(
        'UPDATE enrollment_waitlist SET status = \'EXPIRED\' WHERE course_id = ? AND id != ? AND status = \'NOTIFIED\'',
        [entry.course_id, waitlistId]
      )
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    return { success: true, message: 'Đã xác nhận, đăng ký đang chờ duyệt' }
  },

  async cancelWaitlist(waitlistId, seafarerId) {
    const [r] = await pool.query(
      'UPDATE enrollment_waitlist SET status = \'CANCELLED\' WHERE id = ? AND seafarer_id = ? AND status IN (\'WAITING\', \'NOTIFIED\')',
      [waitlistId, seafarerId]
    )
    if (r.affectedRows === 0)
      throw { statusCode: 404, message: 'Không tìm thấy hoặc không thể hủy' }
    return { success: true }
  },
}

module.exports = waitlistService
