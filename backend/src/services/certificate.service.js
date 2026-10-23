const fs = require('fs')
const path = require('path')
const pool = require('../config/db')
const config = require('../config')

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png']

const EXPIRING_DAYS = 60

// Trạng thái hạn để hiện: không thời hạn, hết hạn, sắp hết hạn (trong 60 ngày), còn hạn.
// Tính từ ngày hết hạn, không tin cột status (job đêm mới cập nhật cột đó).
function expiryStatusOf(row, now = new Date()) {
  if (row.no_expiry) return 'NO_EXPIRY'
  if (!row.expiry_date) return 'NO_EXPIRY'
  // Chuỗi yyyy-mm-dd (SELECT đã định dạng) hoặc Date của driver (giờ địa phương).
  const expiry = row.expiry_date instanceof Date
    ? new Date(row.expiry_date.getFullYear(), row.expiry_date.getMonth(), row.expiry_date.getDate())
    : new Date(`${String(row.expiry_date).slice(0, 10)}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (expiry < today) return 'EXPIRED'
  const days = Math.round((expiry - today) / 86400000)
  return days <= EXPIRING_DAYS ? 'EXPIRING' : 'VALID'
}

// Một dòng cho tab Chứng chỉ: tên hiện ra (loại trong danh mục, hoặc tên trên giấy), nguồn, trạng thái hạn.
function shapeCertificate(row, now) {
  const fromDocument = Boolean(row.source_document_id)
  return {
    ...row,
    display_name: row.certificate_type_name || row.certificate_name_raw || 'Chứng chỉ chưa rõ loại',
    expiry_status: expiryStatusOf(row, now),
    source: fromDocument ? 'document' : 'manual',
    source_file_name: row.source_file_name || null,
    source_page: row.source_page || null,
  }
}

const certificateService = {
  async list(seafarerId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit
    // Hết hạn sớm nhất lên trước (đã hết hạn đứng đầu), không thời hạn xuống cuối.
    const [rows] = await pool.query(
      `SELECT sc.*,
              TO_CHAR(sc.issued_date, 'YYYY-MM-DD') AS issued_date,
              TO_CHAR(sc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              ct.name_vi as certificate_type_name,
              ct.category as certificate_category,
              c.name_vi  as issued_at_country_name,
              COALESCE(u.file_name, sd.file_name) AS source_file_name,
              sd.page_label AS source_page,
              sd.upload_id AS source_upload_id
       FROM seafarer_certificate sc
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN country c ON c.id = sc.issued_at_country_id
       LEFT JOIN seafarer_document sd ON sd.id = sc.source_document_id
       LEFT JOIN document_upload u ON u.id = sd.upload_id
       WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
       ORDER BY (sc.no_expiry = 1 OR sc.expiry_date IS NULL), sc.expiry_date ASC, sc.id ASC
       LIMIT ? OFFSET ?`,
      [seafarerId, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM seafarer_certificate WHERE seafarer_id = ? AND deleted_at IS NULL',
      [seafarerId]
    )
    const now = new Date()
    return { data: rows.map((row) => shapeCertificate(row, now)), total, page, limit }
  },

  async getById(id, seafarerId) {
    const [rows] = await pool.query(
      `SELECT sc.*,
              TO_CHAR(sc.issued_date, 'YYYY-MM-DD') AS issued_date,
              TO_CHAR(sc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              ct.name_vi as certificate_type_name,
              c.name_vi  as issued_at_country_name
       FROM seafarer_certificate sc
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN country c ON c.id = sc.issued_at_country_id
       WHERE sc.id = ? AND sc.seafarer_id = ? AND sc.deleted_at IS NULL`,
      [id, seafarerId]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy chứng chỉ' }
    return shapeCertificate(rows[0])
  },

  async create(seafarerId, data, created_by) {
    try {
      const [result] = await pool.query(
        'INSERT INTO seafarer_certificate SET ?',
        [{ ...data, seafarer_id: seafarerId, created_by, updated_by: created_by }]
      )
      return this.getById(result.insertId, seafarerId)
    } catch (err) {
      if (err?.code === '23505') throw { statusCode: 409, message: 'Hồ sơ đã có chứng chỉ này (cùng loại và cùng ngày cấp)' }
      throw err
    }
  },

  async update(id, seafarerId, data, updated_by) {
    await this.getById(id, seafarerId)
    await pool.query(
      'UPDATE seafarer_certificate SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [data, updated_by, id]
    )
    return this.getById(id, seafarerId)
  },

  async softDelete(id, seafarerId, updated_by) {
    await this.getById(id, seafarerId)
    await pool.query(
      'UPDATE seafarer_certificate SET deleted_at = NOW(), updated_by = ? WHERE id = ?',
      [updated_by, id]
    )
    return { success: true }
  },

  async uploadFile(id, seafarerId, file, updated_by) {
    await this.getById(id, seafarerId)

    const ext = path.extname(file.filename).toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      throw { statusCode: 400, message: 'Chỉ chấp nhận file PDF, JPG, JPEG, PNG' }
    }

    // Đọc buffer để kiểm tra magic bytes thực sự
    const fileBuffer = await file.toBuffer()

    // Magic bytes: PDF=%PDF, JPEG=FFD8FF, PNG=89504E47
    const magic = fileBuffer.slice(0, 4)
    const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff
    const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47

    if (!isPdf && !isJpeg && !isPng) {
      throw { statusCode: 400, message: 'Nội dung file không hợp lệ' }
    }

    const uploadDir = path.join(config.upload.dir, 'certificates', String(seafarerId))
    fs.mkdirSync(uploadDir, { recursive: true })

    const filename = `${id}_${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)
    fs.writeFileSync(filepath, fileBuffer)

    const document_url = `/uploads/certificates/${seafarerId}/${filename}`
    await pool.query(
      'UPDATE seafarer_certificate SET document_url = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [document_url, updated_by, id]
    )

    return this.getById(id, seafarerId)
  },

  // File chứng chỉ nhập tay (document_url) để tải về; chứng chỉ từ giấy tờ AI đọc thì tải qua /documents/uploads/:id/file.
  async manualFile(id, seafarerId) {
    const [rows] = await pool.query(
      'SELECT document_url, certificate_name_raw FROM seafarer_certificate WHERE id = ? AND seafarer_id = ? AND deleted_at IS NULL',
      [id, seafarerId]
    )
    const url = rows[0]?.document_url
    if (!url) throw { statusCode: 404, message: 'Chứng chỉ này không có file đính kèm' }
    const name = path.basename(url)
    const filepath = path.join(config.upload.dir, 'certificates', String(seafarerId), name)
    if (!fs.existsSync(filepath)) throw { statusCode: 404, message: 'Không tìm thấy file chứng chỉ' }
    const mime = { '.pdf': 'application/pdf', '.png': 'image/png' }[path.extname(name).toLowerCase()] || 'image/jpeg'
    return { path: filepath, name, mime }
  },
}

module.exports = certificateService
module.exports.expiryStatusOf = expiryStatusOf
