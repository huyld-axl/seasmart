const fs = require('fs')
const path = require('path')
const pool = require('../config/db')
const config = require('../config')

// Quy tắc xoá tệp của hệ thống (xem CLAUDE.md, mục Xoá tệp): không xoá tệp khỏi ổ đĩa ngay.
// Tệp bị xoá hoặc bị thay thì đưa vào file_trash; job hằng ngày xoá khỏi ổ đĩa tệp đã nằm đó quá TRASH_DAYS ngày.
const TRASH_DAYS = 180

// Đưa một hoặc nhiều tệp vào thùng rác. Bỏ qua đường dẫn rỗng.
async function trashFiles(paths, reason, db = pool) {
  const list = [].concat(paths).filter(Boolean)
  for (const file of list) await db.query('INSERT INTO file_trash (path, reason) VALUES (?, ?)', [file, reason])
}

// Đường dẫn trên ổ đĩa của tệp chứng chỉ nạp tay (document_url dạng /uploads/certificates/:seafarerId/:tệp).
const certificateFilePath = (seafarerId, documentUrl) => (documentUrl ? path.join(config.upload.dir, 'certificates', String(seafarerId), path.basename(documentUrl)) : null)

// Xoá khỏi ổ đĩa: tệp trong file_trash và tệp tải lên (cùng ảnh trang) đã xoá mềm quá TRASH_DAYS ngày.
async function purgeExpired(logger, days = TRASH_DAYS) {
  let removed = 0
  const [trash] = await pool.query(
    'SELECT id, path FROM file_trash WHERE purged_at IS NULL AND trashed_at < NOW() - (? * INTERVAL \'1 day\') ORDER BY id LIMIT 1000', [days])
  for (const row of trash) {
    fs.rmSync(row.path, { force: true })
    await pool.query('UPDATE file_trash SET purged_at = NOW() WHERE id = ?', [row.id])
    removed += 1
  }
  const [uploads] = await pool.query(
    `SELECT id, storage_path FROM document_upload
     WHERE deleted_at IS NOT NULL AND files_purged_at IS NULL AND deleted_at < NOW() - (? * INTERVAL '1 day') ORDER BY id LIMIT 500`, [days])
  for (const upload of uploads) {
    const [pages] = await pool.query('SELECT image_path, thumb_path FROM document_upload_page WHERE upload_id = ?', [upload.id])
    for (const file of [upload.storage_path, ...pages.flatMap((p) => [p.image_path, p.thumb_path])]) {
      if (file) fs.rmSync(file, { force: true })
    }
    await pool.query('UPDATE document_upload SET files_purged_at = NOW() WHERE id = ?', [upload.id])
    removed += 1
  }
  logger?.info?.({ files: trash.length, uploads: uploads.length }, 'Job: purged files trashed over 180 days')
  return removed
}

module.exports = { TRASH_DAYS, trashFiles, certificateFilePath, purgeExpired }
