const fs = require('fs')
const path = require('path')
const pool = require('../config/db')
const config = require('../config')

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png']

const certificateService = {
  async list(seafarerId, { page = 1, limit = 9999, certificate_type_id } = {}) {
    const offset = (page - 1) * limit
    const filters = [seafarerId]
    let whereExtra = ''
    if (certificate_type_id) {
      whereExtra = ' AND sc.certificate_type_id = ?'
      filters.push(certificate_type_id)
    }
    const [rows] = await pool.query(
      `SELECT sc.*,
              ct.name_vi as certificate_type_name,
              ct.name_en as certificate_type_name_en,
              ct.warning_before_months,
              c.name_vi  as issued_at_country_name
       FROM seafarer_certificate sc
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN country c ON c.id = sc.issued_at_country_id
       WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL${whereExtra}
       ORDER BY sc.expiry_date ASC
       LIMIT ? OFFSET ?`,
      [...filters, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM seafarer_certificate WHERE seafarer_id = ? AND deleted_at IS NULL${whereExtra}`,
      filters
    )
    return { data: rows, total, page, limit }
  },

  async getById(id, seafarerId) {
    const [rows] = await pool.query(
      `SELECT sc.*,
              ct.name_vi as certificate_type_name,
              ct.name_en as certificate_type_name_en,
              ct.warning_before_months,
              c.name_vi  as issued_at_country_name
       FROM seafarer_certificate sc
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN country c ON c.id = sc.issued_at_country_id
       WHERE sc.id = ? AND sc.seafarer_id = ? AND sc.deleted_at IS NULL`,
      [id, seafarerId]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy chứng chỉ' }
    return rows[0]
  },

  async create(seafarerId, data, created_by) {
    if (data.certificate_type_id && data.issued_date) {
      const [[dup]] = await pool.query(
        `SELECT id FROM seafarer_certificate
         WHERE seafarer_id = ? AND certificate_type_id = ? AND issued_date = ? AND deleted_at IS NULL
         LIMIT 1`,
        [seafarerId, data.certificate_type_id, data.issued_date]
      )
      if (dup) {
        throw {
          statusCode: 409,
          message: 'Chứng chỉ cùng loại và cùng ngày cấp đã tồn tại cho thuyền viên này.',
        }
      }
    }
    const [result] = await pool.query(
      'INSERT INTO seafarer_certificate SET ?, seafarer_id = ?, created_by = ?, updated_by = ?',
      [data, seafarerId, created_by, created_by]
    )
    return this.getById(result.insertId, seafarerId)
  },

  async update(id, seafarerId, data, updated_by) {
    await pool.query(
      'UPDATE seafarer_certificate SET ?, updated_by = ?, updated_at = NOW() WHERE id = ? AND seafarer_id = ? AND deleted_at IS NULL',
      [data, updated_by, id, seafarerId]
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

  async deleteFile(id, seafarerId, updated_by) {
    const cert = await this.getById(id, seafarerId)
    if (!cert.document_url) {
      throw { statusCode: 400, message: 'Chứng chỉ này không có file đính kèm' }
    }
    const filename = cert.document_url.split('/').pop()
    const filePath = path.join(config.upload.dir, 'certificates', String(seafarerId), filename)
    try {
      await fs.promises.unlink(filePath)
    } catch {
      // File không tồn tại trên disk — tiếp tục xóa DB
    }
    await pool.query(
      'UPDATE seafarer_certificate SET document_url = NULL, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [updated_by, id]
    )
    return this.getById(id, seafarerId)
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
    await fs.promises.writeFile(filepath, fileBuffer)

    const document_url = `/uploads/certificates/${seafarerId}/${filename}`
    await pool.query(
      'UPDATE seafarer_certificate SET document_url = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [document_url, updated_by, id]
    )

    return this.getById(id, seafarerId)
  },
}

module.exports = certificateService
