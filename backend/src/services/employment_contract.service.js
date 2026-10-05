const pool = require('../config/db')

const employmentContractService = {
  async list(seafarerId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT ec.id, ec.seafarer_id, ec.vessel_id, ec.start_date, ec.end_date, ec.actual_end_date,
              ec.basic_wage_usd AS salary, ec.notes, ec.created_at, ec.updated_at,
              v.vessel_name AS vessel_name
       FROM employment_contract ec
       LEFT JOIN vessel v ON v.id = ec.vessel_id
       WHERE ec.seafarer_id = ? AND ec.deleted_at IS NULL
       ORDER BY ec.start_date DESC
       LIMIT ? OFFSET ?`,
      [seafarerId, limit, offset]
    )
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM employment_contract WHERE seafarer_id = ? AND deleted_at IS NULL',
      [seafarerId]
    )
    return { data: rows, total, page, limit }
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT ec.*, v.vessel_name AS vessel_name
       FROM employment_contract ec
       LEFT JOIN vessel v ON v.id = ec.vessel_id
       WHERE ec.id = ? AND ec.deleted_at IS NULL`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy hợp đồng' }
    return rows[0]
  },

  async create(data, createdBy) {
    const {
      seafarer_id,
      vessel_id,
      partner_id,
      ship_owner_id,
      rank_id,
      contract_number,
      sign_date,
      start_date,
      end_date,
      salary,
      notes,
      duration_months,
      sign_on_port_id,
      sign_off_port_id,
    } = data
    const [result] = await pool.query(
      `INSERT INTO employment_contract
        (seafarer_id, vessel_id, partner_id, rank_id, contract_number,
         sign_date, start_date, end_date, basic_wage_usd, notes,
         duration_months, sign_on_port_id, sign_off_port_id,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        seafarer_id,
        vessel_id || null,
        partner_id || ship_owner_id || null,
        rank_id || null,
        contract_number || null,
        sign_date || null,
        start_date || null,
        end_date || null,
        salary || null,
        notes || null,
        duration_months || null,
        sign_on_port_id || null,
        sign_off_port_id || null,
      ]
    )
    return this.getById(result.insertId)
  },

  async update(id, data, updatedBy) {
    await this.getById(id)
    const { vessel_id, start_date, end_date, actual_end_date, salary, notes } = data
    const updates = []
    const params = []
    if (vessel_id !== undefined) {
      updates.push('vessel_id = ?')
      params.push(vessel_id)
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?')
      params.push(start_date)
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?')
      params.push(end_date)
    }
    if (actual_end_date !== undefined) {
      updates.push('actual_end_date = ?')
      params.push(actual_end_date)
    }
    if (salary !== undefined) {
      updates.push('basic_wage_usd = ?')
      params.push(salary)
    }
    if (notes !== undefined) {
      updates.push('notes = ?')
      params.push(notes)
    }
    if (updates.length === 0) return this.getById(id)
    params.push(id)
    await pool.query(
      `UPDATE employment_contract SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    )
    return this.getById(id)
  },

  async softDelete(id, updatedBy) {
    await this.getById(id)
    await pool.query(
      'UPDATE employment_contract SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
      [id]
    )
    return { success: true }
  },
}

module.exports = employmentContractService
