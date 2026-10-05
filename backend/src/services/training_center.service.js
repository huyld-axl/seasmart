const pool = require('../config/db')

const trainingCenterService = {
  async list({ page = 1, limit = 20, search, is_active }) {
    const offset = (page - 1) * limit
    const where = ['deleted_at IS NULL']
    const params = []

    if (search) {
      where.push('(name_vi LIKE ? OR name_en LIKE ? OR code LIKE ? OR license_number LIKE ?)')
      const q = `%${search}%`
      params.push(q, q, q, q)
    }
    if (is_active !== undefined && is_active !== '') {
      where.push('is_active = ?')
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0)
    }

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM training_center ${whereStr}`,
      params
    )

    const [rows] = await pool.query(
      `SELECT id, code, name_vi, name_en, license_number, license_expiry,
              address, phone, email, contact_person, is_active, created_at
       FROM training_center ${whereStr}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows, total, page, limit }
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT tc.*, c.name_vi as country_name
       FROM training_center tc
       LEFT JOIN country c ON c.id = tc.country_id
       WHERE tc.id = ? AND tc.deleted_at IS NULL`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy trung tâm đào tạo' }
    return rows[0]
  },

  async create(data, created_by) {
    const insertData = { ...data, created_by, updated_by: created_by }
    const [result] = await pool.query('INSERT INTO training_center SET ?', [insertData])
    const center = await this.getById(result.insertId)

    // Nếu có user_id thì link user với training center
    if (data.user_id) {
      await pool.query(
        'UPDATE user SET linked_entity_type = \'training_center\', linked_entity_id = ? WHERE id = ?',
        [result.insertId, data.user_id]
      )
    }

    return center
  },

  async update(id, data, updated_by, requestUser) {
    const center = await this.getById(id)

    // training_center role chỉ được sửa record của chính mình
    if (requestUser.role === 'training_center' && requestUser.linked_entity_id !== id) {
      throw { statusCode: 403, message: 'Không có quyền chỉnh sửa trung tâm này' }
    }

    await pool.query(
      'UPDATE training_center SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [data, updated_by, id]
    )
    return this.getById(id)
  },

  async softDelete(id, updated_by) {
    await this.getById(id)
    await pool.query('UPDATE training_center SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [
      updated_by,
      id,
    ])
    return { success: true }
  },
}

module.exports = trainingCenterService
