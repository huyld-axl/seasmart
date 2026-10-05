const pool = require('../config/db')

const trainingCourseService = {
  async list({
    page = 1,
    limit = 20,
    training_center_id,
    status,
    course_type_id,
    search,
    requestUser,
  }) {
    const offset = (page - 1) * limit
    const where = ['tc.deleted_at IS NULL']
    const params = []

    // training_center chỉ thấy course của mình
    if (requestUser.role === 'training_center') {
      where.push('tc.training_center_id = ?')
      params.push(requestUser.linked_entity_id)
    } else if (training_center_id) {
      where.push('tc.training_center_id = ?')
      params.push(training_center_id)
    }

    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (statuses.length === 1) {
        where.push('tc.status = ?')
        params.push(statuses[0])
      } else if (statuses.length > 1) {
        where.push(`tc.status IN (${statuses.map(() => '?').join(',')})`)
        params.push(...statuses)
      }
    }
    if (course_type_id) {
      where.push('tc.course_type_id = ?')
      params.push(course_type_id)
    }

    if (search) {
      where.push('(tc.name LIKE ? OR tc.course_code LIKE ?)')
      const q = `%${search}%`
      params.push(q, q)
    }

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM training_course tc ${whereStr}`,
      params
    )

    const [rows] = await pool.query(
      `SELECT tc.id, tc.course_code, tc.name, tc.start_date, tc.end_date,
              tc.location, tc.max_students, tc.fee_vnd, tc.fee_usd,
              tc.status, tc.created_at,
              ct.name_vi as course_type_name,
              ctr.name_vi as training_center_name
       FROM training_course tc
       LEFT JOIN course_type ct ON ct.id = tc.course_type_id
       LEFT JOIN training_center ctr ON ctr.id = tc.training_center_id
       ${whereStr}
       ORDER BY tc.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows, total, page, limit }
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT tc.*,
              ct.name_vi as course_type_name,
              ctr.name_vi as training_center_name,
              COUNT(e.id) as enrolled_count
       FROM training_course tc
       LEFT JOIN course_type ct ON ct.id = tc.course_type_id
       LEFT JOIN training_center ctr ON ctr.id = tc.training_center_id
       LEFT JOIN training_enrollment e ON e.course_id = tc.id AND e.deleted_at IS NULL
       WHERE tc.id = ? AND tc.deleted_at IS NULL
       GROUP BY tc.id`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy khóa học' }
    return rows[0]
  },

  async create(data, created_by) {
    const insertData = { ...data, created_by, updated_by: created_by }
    const [result] = await pool.query('INSERT INTO training_course SET ?', [insertData])
    return this.getById(result.insertId)
  },

  async update(id, data, updated_by) {
    await this.getById(id)
    await pool.query(
      'UPDATE training_course SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [data, updated_by, id]
    )
    return this.getById(id)
  },

  async softDelete(id, updated_by) {
    await this.getById(id)
    await pool.query('UPDATE training_course SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [
      updated_by,
      id,
    ])
    return { success: true }
  },
}

module.exports = trainingCourseService
