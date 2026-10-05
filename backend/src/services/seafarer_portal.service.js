const pool = require('../config/db')

// Fields seafarer được phép tự cập nhật qua portal
const PORTAL_ALLOWED_FIELDS = [
  'phone_primary',
  'permanent_address',
  'permanent_ward',
  'permanent_district',
  'permanent_province',
  'height_cm',
  'weight_kg',
  'shoe_size',
  'protective_size',
  'personal_bank_account_number',
  'salary_bank_account_number',
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
      `SELECT sc.*,
              ct.name_vi as certificate_type_name,
              ct.name_en as certificate_type_name_en,
              c.name_vi as issued_at_country_name
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
      `SELECT ec.*, v.vessel_name as vessel_name, v.vessel_type as vessel_type_name
       FROM employment_contract ec
       LEFT JOIN vessel v ON v.id = ec.vessel_id
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
}

module.exports = seafarerPortalService
