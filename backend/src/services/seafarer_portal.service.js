const pool = require('../config/db')

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
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
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
      `SELECT ec.id, ec.contract_number, ec.start_date, ec.end_date, ec.status,
              v.vessel_name, vt.name_vi as vessel_type_name, r.name_vi as rank_name
       FROM seafarer_contract ec
       JOIN voyage_position vp ON vp.id = ec.voyage_position_id
       JOIN voyage vy ON vy.id = vp.voyage_id
       JOIN vessel v ON v.id = vy.vessel_id
       LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id
       LEFT JOIN "rank" r ON r.id = vp.rank_id
       WHERE ec.seafarer_id = ? AND ec.deleted_at IS NULL AND ec.status NOT IN ('DRAFT', 'REJECTED')
       ORDER BY ec.start_date DESC
       LIMIT ? OFFSET ?`,
      [profile.id, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM seafarer_contract WHERE seafarer_id = ? AND deleted_at IS NULL AND status NOT IN (\'DRAFT\', \'REJECTED\')',
      [profile.id]
    )
    return { data: rows, total, page, limit }
  },
}

module.exports = seafarerPortalService
