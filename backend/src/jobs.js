const cron = require('node-cron')
const pool = require('./config/db')
const notificationService = require('./services/notification.service')
const emailService = require('./services/email.service')
const { purgeExpired } = require('./utils/file_trash')
const config = require('./config')

// Ngày dd/mm/yyyy cho nội dung thông báo (cột DATE trả về Date hoặc chuỗi yyyy-mm-dd).
function viDate(value) {
  const iso = value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value).slice(0, 10)
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Job ngày chạy tối đa một lần mỗi ngày, ghi ngày chạy vào job_run. Khoá advisory theo tên để hai lần gọi
// (giờ hẹn + chạy bù) không chạy chồng. Trả true nếu lần này có chạy.
async function runDaily(name, fn, db = pool) {
  const client = await db.native.connect()
  const key = `mcah.job.${name}`
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [key])
    if (!rows[0].ok) return false
    try {
      const { rows: done } = await client.query('SELECT 1 FROM job_run WHERE name = $1 AND last_run_on >= CURRENT_DATE', [name])
      if (done.length) return false
      await fn()
      await client.query(
        'INSERT INTO job_run (name, last_run_on) VALUES ($1, CURRENT_DATE) ON CONFLICT (name) DO UPDATE SET last_run_on = EXCLUDED.last_run_on',
        [name]
      )
      return true
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key])
    }
  } finally {
    client.release()
  }
}

function startJobs(logger) {
  // Bản web chạy job ngày đúng giờ hẹn. App máy tính thường tắt qua đêm nên lỡ giờ: chạy bù lúc mở app và kiểm
  // lại mỗi giờ; runDaily giữ cho mỗi job chỉ chạy một lần mỗi ngày.
  const daily = (name, expr, fn) => {
    const run = () => runDaily(name, fn).catch((err) => logger.error({ err, job: name }, 'Job: daily run failed'))
    if (config.desktop) {
      cron.schedule('0 * * * *', run)
      run()
    } else {
      cron.schedule(expr, run)
    }
  }

  // Job 1 (daily 2:00 AM): cập nhật chứng chỉ hết hạn
  daily('expire_certificates', '0 2 * * *', async () => {
    try {
      const [result] = await pool.query(
        `UPDATE seafarer_certificate
         SET status = 'EXPIRED', updated_at = NOW()
         WHERE expiry_date < CURRENT_DATE AND status = 'VALID' AND deleted_at IS NULL`
      )
      logger.info({ affectedRows: result.affectedRows }, 'Job: expired certificates updated')
    } catch (err) {
      logger.error({ err }, 'Job: failed to update expired certificates')
      // Ném lại để runDaily không ghi là đã chạy: giờ sau thử lại.
      throw err
    }
  })

  // Job 2 (daily 3:00 AM): xoá khỏi ổ đĩa các tệp đã xoá mềm / bị thay quá 180 ngày (quy tắc xoá tệp).
  daily('purge_trash', '0 3 * * *', async () => {
    try {
      await purgeExpired(logger)
    } catch (err) {
      logger.error({ err }, 'Job: failed to purge trashed files')
      // Ném lại để runDaily không ghi là đã chạy: giờ sau thử lại.
      throw err
    }
  })

  // Job 3 (daily 7:00 AM): nhắc hạn chứng chỉ / hợp đồng / giấy tờ, gửi vào chuông của người phụ trách thuyền viên
  // (seafarer.created_by, cùng cột phạm vi "của mình"); thuyền viên không có tài khoản nên không gửi cho họ.
  daily('notify_expiry', '0 7 * * *', async () => {
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
          `SELECT sc.id, sc.seafarer_id, s.created_by AS user_id, s.full_name, sc.expiry_date, ct.name_vi as cert_name
           FROM seafarer_certificate sc
           JOIN seafarer s ON s.id = sc.seafarer_id AND s.deleted_at IS NULL AND s.created_by IS NOT NULL
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
              body: `${row.full_name}: ${row.cert_name || 'chứng chỉ'} hết hạn sau ${label}.`,
            })
            created++
          }
        }
      }
      const [contracts] = await pool.query(
        `SELECT ec.id, ec.seafarer_id, s.created_by AS user_id, s.full_name, ec.end_date
         FROM seafarer_contract ec
         JOIN seafarer s ON s.id = ec.seafarer_id AND s.deleted_at IS NULL AND s.created_by IS NOT NULL
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
            body: `${row.full_name}: hợp đồng kết thúc ngày ${viDate(row.end_date)}.`,
          })
          created++
        }
      }
      const [docs] = await pool.query(
        `SELECT id, created_by AS user_id, full_name, passport_expiry, seaman_book_expiry, medical_cert_expiry
         FROM seafarer WHERE deleted_at IS NULL AND created_by IS NOT NULL
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
              body: `${row.full_name}: hộ chiếu hết hạn ngày ${viDate(row.passport_expiry)}.`,
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
              body: `${row.full_name}: sổ thuyền viên hết hạn ngày ${viDate(row.seaman_book_expiry)}.`,
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
              body: `${row.full_name}: giấy khám sức khỏe hết hạn ngày ${viDate(row.medical_cert_expiry)}.`,
            })
            created++
          }
        }
      }
      logger.info({ created }, 'Job: expiry notifications created')
    } catch (err) {
      logger.error({ err }, 'Job: failed to create expiry notifications')
      // Ném lại để runDaily không ghi là đã chạy: giờ sau thử lại.
      throw err
    }
  })

  // Job 4 (mỗi 5 phút): đưa vào chạy lại tệp và giấy AI đọc kẹt quá 5 phút (trước đây chỉ làm lúc khởi động).
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

module.exports = { startJobs, runDaily }
