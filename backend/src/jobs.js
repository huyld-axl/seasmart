const cron = require('node-cron')
const pool = require('./config/db')
const notificationService = require('./services/notification.service')
const emailService = require('./services/email.service')

function startJobs(logger) {
  // Job 1 (daily 2:00 AM): cập nhật chứng chỉ hết hạn
  cron.schedule('0 2 * * *', async () => {
    try {
      const [result] = await pool.query(
        `UPDATE seafarer_certificate
         SET status = 'EXPIRED', updated_at = NOW()
         WHERE expiry_date < CURDATE() AND status = 'VALID' AND deleted_at IS NULL`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: expired certificates updated')
    } catch (err) {
      logger.error({ err }, 'Job: failed to update expired certificates')
    }
  })

  // Job 2 (daily 2:05 AM): reconcile seafarer status với contract end dates
  cron.schedule('5 2 * * *', async () => {
    try {
      const [result] = await pool.query(
        `UPDATE seafarer s
         SET s.status = 'AVAILABLE', s.updated_at = NOW()
         WHERE s.status = 'ON_VESSEL'
           AND s.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM employment_contract ec
             WHERE ec.seafarer_id = s.id
               AND ec.deleted_at IS NULL
               AND (ec.actual_end_date IS NULL OR ec.actual_end_date >= CURDATE())
           )`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: seafarer status reconciled')
    } catch (err) {
      logger.error({ err }, 'Job: failed to reconcile seafarer status')
    }
  })

  // Job 3 (hourly): cleanup expired OTP records
  cron.schedule('15 * * * *', async () => {
    try {
      const [result] = await pool.query(
        `DELETE FROM otp_verification
         WHERE expires_at < NOW() AND used_at IS NULL`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: expired OTPs cleaned up')
    } catch (err) {
      logger.error({ err }, 'Job: failed to cleanup expired OTPs')
    }
  })

  // Job 4a (daily 8:00 AM): course reminder — 3 ngày trước khi khóa bắt đầu (TASK-C1)
  cron.schedule('0 8 * * *', async () => {
    try {
      const threeDaysLater = new Date()
      threeDaysLater.setDate(threeDaysLater.getDate() + 3)
      const dateStr = threeDaysLater.toISOString().split('T')[0]
      const [enrollments] = await pool.query(
        `SELECT e.id, s.email as seafarer_email, s.full_name,
                tc.name as course_name, tc.start_date, tc.location
         FROM training_enrollment e
         JOIN seafarer s ON e.seafarer_id = s.id
         JOIN training_course tc ON e.course_id = tc.id
         WHERE e.deleted_at IS NULL AND e.status IN ('APPROVED', 'ACTIVE')
           AND DATE(tc.start_date) = ?
           AND s.email IS NOT NULL AND s.email != ''`,
        [dateStr]
      )
      for (const row of enrollments) {
        const startDate = row.start_date
          ? new Date(row.start_date).toLocaleDateString('vi-VN')
          : dateStr
        await emailService
          .sendCourseReminder(row.seafarer_email, {
            full_name: row.full_name,
            course_name: row.course_name,
            start_date: startDate,
            location: row.location || 'Theo thông báo của trung tâm',
          })
          .catch((err) =>
            logger.error({ err, enrollmentId: row.id }, 'Course reminder email failed')
          )
      }
      logger.info({ count: enrollments.length }, 'Job: course reminders sent')
    } catch (err) {
      logger.error({ err }, 'Job: failed to send course reminders')
    }
  })

  // Job 4 (daily 7:00 AM): notifications for cert/contract/doc expiry
  cron.schedule('0 7 * * *', async () => {
    try {
      let created = 0
      const intervals = [
        { days: 30, label: '30 ngày' },
        { days: 15, label: '15 ngày' },
        { days: 14, label: '14 ngày' },
        { days: 7, label: '7 ngày' },
      ]
      for (const { days, label } of intervals) {
        const [certs] = await pool.query(
          `SELECT sc.id, sc.seafarer_id, s.user_id, sc.expiry_date, ct.name_vi as cert_name
           FROM seafarer_certificate sc
           JOIN seafarer s ON s.id = sc.seafarer_id AND s.deleted_at IS NULL AND s.user_id IS NOT NULL
           LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
           WHERE sc.deleted_at IS NULL AND sc.expiry_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
          [days]
        )
        for (const row of certs) {
          const dup = await notificationService.hasRecentDuplicate(
            row.user_id,
            'CERT_EXPIRY',
            row.seafarer_id,
            24
          )
          if (!dup) {
            await notificationService.create({
              user_id: row.user_id,
              type: 'CERT_EXPIRY',
              ref_table: 'seafarer_certificate',
              ref_id: row.seafarer_id,
              title: 'Chứng chỉ sắp hết hạn',
              body: `${row.cert_name || 'Chứng chỉ'} hết hạn sau ${label}.`,
            })
            created++
          }
        }
      }
      const [contracts] = await pool.query(
        `SELECT ec.id, ec.seafarer_id, s.user_id, ec.end_date
         FROM employment_contract ec
         JOIN seafarer s ON s.id = ec.seafarer_id AND s.deleted_at IS NULL AND s.user_id IS NOT NULL
         WHERE ec.deleted_at IS NULL AND ec.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
      )
      for (const row of contracts) {
        const dup = await notificationService.hasRecentDuplicate(
          row.user_id,
          'CONTRACT_END',
          row.seafarer_id,
          24
        )
        if (!dup) {
          await notificationService.create({
            user_id: row.user_id,
            type: 'CONTRACT_END',
            ref_table: 'employment_contract',
            ref_id: row.seafarer_id,
            title: 'Hợp đồng sắp kết thúc',
            body: `Hợp đồng kết thúc vào ${row.end_date}.`,
          })
          created++
        }
      }
      const [docs] = await pool.query(
        `SELECT id, user_id, full_name, passport_expiry, seaman_book_expiry, medical_cert_expiry
         FROM seafarer WHERE deleted_at IS NULL AND user_id IS NOT NULL
         AND (passport_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           OR seaman_book_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           OR medical_cert_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))`
      )
      for (const row of docs) {
        if (row.passport_expiry) {
          const dup = await notificationService.hasRecentDuplicate(
            row.user_id,
            'PASSPORT_EXPIRY',
            row.id,
            24
          )
          if (!dup) {
            await notificationService.create({
              user_id: row.user_id,
              type: 'PASSPORT_EXPIRY',
              ref_table: 'seafarer',
              ref_id: row.id,
              title: 'Hộ chiếu sắp hết hạn',
              body: `Hộ chiếu hết hạn ${row.passport_expiry}.`,
            })
            created++
          }
        }
        if (row.seaman_book_expiry) {
          const dup = await notificationService.hasRecentDuplicate(
            row.user_id,
            'SEAMAN_BOOK_EXPIRY',
            row.id,
            24
          )
          if (!dup) {
            await notificationService.create({
              user_id: row.user_id,
              type: 'SEAMAN_BOOK_EXPIRY',
              ref_table: 'seafarer',
              ref_id: row.id,
              title: 'Sổ thuyền viên sắp hết hạn',
              body: `Sổ thuyền viên hết hạn ${row.seaman_book_expiry}.`,
            })
            created++
          }
        }
        if (row.medical_cert_expiry) {
          const dup = await notificationService.hasRecentDuplicate(
            row.user_id,
            'MEDICAL_EXPIRY',
            row.id,
            24
          )
          if (!dup) {
            await notificationService.create({
              user_id: row.user_id,
              type: 'MEDICAL_EXPIRY',
              ref_table: 'seafarer',
              ref_id: row.id,
              title: 'Giấy khám sức khỏe sắp hết hạn',
              body: `Giấy khám sức khỏe hết hạn ${row.medical_cert_expiry}.`,
            })
            created++
          }
        }
      }
      logger.info({ created }, 'Job: expiry notifications created')
    } catch (err) {
      logger.error({ err }, 'Job: failed to create expiry notifications')
    }
  })

  // Job 5 (hourly): waitlist NOTIFIED đã quá confirm_by → EXPIRED, promote next (TASK-C2)
  const waitlistService = require('./services/waitlist.service')
  cron.schedule('0 * * * *', async () => {
    try {
      const [expired] = await pool.query(
        'SELECT id, course_id FROM enrollment_waitlist WHERE status = \'NOTIFIED\' AND confirm_by < NOW()'
      )
      for (const entry of expired) {
        await pool.query('UPDATE enrollment_waitlist SET status = \'EXPIRED\' WHERE id = ?', [
          entry.id,
        ])
        await waitlistService
          .promoteNext(entry.course_id)
          .catch((err) => logger.error({ err }, 'promoteNext failed'))
      }
      if (expired.length)
        logger.info({ count: expired.length }, 'Job: waitlist expired, promoted next')
    } catch (err) {
      logger.error({ err }, 'Job: failed to process waitlist expired')
    }
  })

  logger.info('Background jobs started')
}

module.exports = { startJobs }
