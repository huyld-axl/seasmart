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
         WHERE expiry_date < CURRENT_DATE AND status = 'VALID' AND deleted_at IS NULL`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: expired certificates updated')
    } catch (err) {
      logger.error({ err }, 'Job: failed to update expired certificates')
    }
  })

  // Job 2 (daily 2:10 AM): hợp đồng Hiệu lực đã qua ngày kết thúc chuyển sang Hết hạn.
  // Trạng thái thuyền viên không đổi ở đây, chỉ đổi theo chuyến (Bắt đầu / Kết thúc chuyến).
  cron.schedule('10 2 * * *', async () => {
    try {
      const [result] = await pool.query(
        `UPDATE seafarer_contract
         SET status = 'ENDED', updated_at = NOW()
         WHERE status = 'ACTIVE' AND end_date < CURRENT_DATE AND deleted_at IS NULL`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: seafarer contracts ended')
    } catch (err) {
      logger.error({ err }, 'Job: failed to end seafarer contracts')
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
           WHERE sc.deleted_at IS NULL AND sc.expiry_date = (CURRENT_DATE + (? * INTERVAL '1 day'))`,
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
         FROM seafarer_contract ec
         JOIN seafarer s ON s.id = ec.seafarer_id AND s.deleted_at IS NULL AND s.user_id IS NOT NULL
         WHERE ec.status = 'ACTIVE' AND ec.deleted_at IS NULL AND ec.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (30 * INTERVAL '1 day'))`
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
            ref_table: 'seafarer_contract',
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
         AND (passport_expiry BETWEEN CURRENT_DATE AND (CURRENT_DATE + (30 * INTERVAL '1 day'))
           OR seaman_book_expiry BETWEEN CURRENT_DATE AND (CURRENT_DATE + (30 * INTERVAL '1 day'))
           OR medical_cert_expiry BETWEEN CURRENT_DATE AND (CURRENT_DATE + (30 * INTERVAL '1 day')))`
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

  // Job 6 (mỗi 5 phút): đưa vào chạy lại tệp và giấy AI đọc kẹt quá 5 phút (trước đây chỉ làm lúc khởi động).
  const documentService = require('./services/document.service').documentService
  cron.schedule('*/5 * * * *', async () => {
    try {
      const queued = await documentService.recoverStalled()
      if (queued.uploads || queued.documents) logger.info(queued, 'Job: queued stalled documents')
    } catch (err) {
      logger.error({ err }, 'Job: failed to recover stalled documents')
    }
  })

  logger.info('Background jobs started')
}

module.exports = { startJobs }
