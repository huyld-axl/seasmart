const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')
const config = require('../config')
const { exportPackService } = require('./export_pack.service')

// Tên tệp trong .zip → { name, kind }: giấy tờ (thư mục GIAY-TO) hay biểu mẫu. Bỏ tệp ghi chú THIEU / CHUA-CO.
function filesOfZip(buffer) {
  const zip = new PizZip(buffer)
  return Object.values(zip.files)
    .filter((f) => !f.dir && !/\/(THIEU-GIAY|CHUA-CO)\.txt$/.test(f.name))
    .map((f) => ({ name: path.basename(f.name).replace(/^\d+[ -]/, '').replace(/\.[^.]+$/, ''), kind: f.name.includes('/GIAY-TO/') ? 'doc' : 'form', path: f.name }))
    // Mỗi biểu mẫu có cả bản PDF và Excel: chỉ liệt kê một lần.
    .filter((f, i, all) => all.findIndex((g) => g.kind === f.kind && g.name === f.name) === i)
}

const seafarerSendService = {
  filesOfZip,

  // Đóng hồ sơ từng người của một lần gửi thành .zip và giữ lại (gọi sau khi đã ghi opportunity_send).
  // Lỗi của một người không chặn người khác; người lỗi thì tab Đã xuất tải bản dựng lại từ dữ liệu hiện tại.
  async keepCopies(pool, sendId, log) {
    const [[send]] = await pool.query('SELECT export_pack_ids FROM opportunity_send WHERE id = ?', [sendId])
    if (!send) return
    const dir = path.join(config.upload.dir, 'sends', String(sendId))
    fs.mkdirSync(dir, { recursive: true })
    for (const packId of send.export_pack_ids) {
      try {
        const [[pack]] = await pool.query('SELECT seafarer_id FROM export_pack WHERE id = ?', [packId])
        const { buffer, filename } = await exportPackService.buildZip(pool, packId, 'pdf')
        const file = path.join(dir, `${packId}.zip`)
        fs.writeFileSync(file, buffer)
        await pool.query(
          'INSERT INTO opportunity_send_copy (send_id, seafarer_id, export_pack_id, storage_path, file_name, files) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
          [sendId, pack.seafarer_id, packId, file, filename, JSON.stringify(filesOfZip(buffer))])
      } catch (error) {
        log?.warn?.({ err: error, sendId, packId }, 'Không giữ được bản đã gửi')
      }
    }
  },

  // Các lần nộp hồ sơ của một thuyền viên (tab Đã xuất), mới nhất trước.
  // stale: giấy tờ theo yêu cầu của cơ hội đã được sửa / thay sau lúc gửi. legacy: bộ giấy cũ không gắn cơ hội.
  async listForSeafarer(pool, seafarerId) {
    const [rows] = await pool.query(
      `SELECT os.id, os.sent_at, os.to_email, u.full_name AS sent_by_name, u.email AS sent_by_email,
              o.id AS opportunity_id, o.code AS opportunity_code, v.vessel_name AS vessel_name, so.company_name AS ship_owner_name, r.name_vi AS rank_name,
              p.id AS export_pack_id, c.id AS copy_id, c.files
       FROM opportunity_send os
       JOIN opportunity o ON o.id = os.opportunity_id
       JOIN export_pack p ON p.id = ANY(os.export_pack_ids) AND p.seafarer_id = ?
       LEFT JOIN opportunity_send_copy c ON c.send_id = os.id AND c.seafarer_id = p.seafarer_id
       LEFT JOIN vessel v ON v.id = o.vessel_id
       LEFT JOIN ship_owner so ON so.id = o.ship_owner_id
       LEFT JOIN rank r ON r.id = o.rank_id
       LEFT JOIN "user" u ON u.id = os.sent_by
       ORDER BY os.sent_at DESC, os.id DESC`,
      [seafarerId])
    const sends = []
    for (const row of rows) {
      const [changed] = await pool.query(
        `SELECT DISTINCT ct.name_vi FROM seafarer_certificate sc
         JOIN certificate_type ct ON ct.id = sc.certificate_type_id
         JOIN opportunity_requirement q ON q.certificate_type_id = sc.certificate_type_id AND q.opportunity_id = ? AND q.kind = 'CERTIFICATE'
         WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL AND sc.updated_at > ?`,
        [row.opportunity_id, seafarerId, row.sent_at])
      sends.push({ ...row, files: row.files || null, has_copy: Boolean(row.copy_id), stale: changed.map((c) => c.name_vi) })
    }
    const [legacy] = await pool.query(
      `SELECT p.id, p.title, p.created_at, u.email AS created_by_email
       FROM export_pack p LEFT JOIN "user" u ON u.id = p.created_by
       WHERE p.seafarer_id = ? AND p.deleted_at IS NULL AND p.opportunity_id IS NULL
       ORDER BY p.id DESC`, [seafarerId])
    return { data: sends.map(({ copy_id: _copy, ...send }) => send), legacy }
  },

  // .zip của một lần gửi cho một thuyền viên: bản đã giữ lúc gửi; lần gửi cũ chưa có bản giữ thì dựng lại từ bộ giấy.
  async download(pool, seafarerId, sendId) {
    const [[row]] = await pool.query(
      `SELECT c.storage_path, c.file_name, p.id AS pack_id
       FROM opportunity_send os JOIN export_pack p ON p.id = ANY(os.export_pack_ids) AND p.seafarer_id = ?
       LEFT JOIN opportunity_send_copy c ON c.send_id = os.id AND c.seafarer_id = p.seafarer_id
       WHERE os.id = ?`, [seafarerId, sendId])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy lần gửi này' }
    if (row.storage_path && fs.existsSync(row.storage_path)) return { buffer: fs.readFileSync(row.storage_path), filename: row.file_name }
    return exportPackService.buildZip(pool, row.pack_id, 'pdf')
  },
}

module.exports = seafarerSendService
