const pool = require('../config/db')

const seafarerCallService = {
  async list(seafarerId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM seafarer_call_log WHERE seafarer_id = ?',
      [seafarerId]
    )
    const [rows] = await pool.query(
      `SELECT cl.*, u.full_name as called_by_name
       FROM seafarer_call_log cl
       LEFT JOIN user u ON u.id = cl.called_by
       WHERE cl.seafarer_id = ?
       ORDER BY cl.called_at DESC
       LIMIT ? OFFSET ?`,
      [seafarerId, limit, offset]
    )
    return { data: rows, total, page, limit }
  },

  async create(seafarerId, { note, called_at }, calledBy) {
    let calledAtValue = new Date()
    if (called_at) {
      const parsedDate = new Date(called_at)
      if (Number.isNaN(parsedDate.getTime())) {
        throw { statusCode: 400, message: 'Thời gian gọi không hợp lệ' }
      }
      calledAtValue = parsedDate
    }

    const [result] = await pool.query(
      'INSERT INTO seafarer_call_log (seafarer_id, note, called_at, called_by) VALUES (?, ?, ?, ?)',
      [seafarerId, note || null, calledAtValue, calledBy]
    )
    return { id: result.insertId }
  },

  async delete(id, seafarerId) {
    const [rows] = await pool.query(
      'SELECT id FROM seafarer_call_log WHERE id = ? AND seafarer_id = ?',
      [id, seafarerId]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy bản ghi' }
    await pool.query('DELETE FROM seafarer_call_log WHERE id = ?', [id])
  },

  async getSummary(seafarerIds) {
    if (!seafarerIds.length) return {}
    const placeholders = seafarerIds.map(() => '?').join(', ')
    const [rows] = await pool.query(
      `SELECT seafarer_id,
              COUNT(*) as call_count,
              MIN(called_at) as first_call_at,
              MAX(called_at) as last_call_at
       FROM seafarer_call_log
       WHERE seafarer_id IN (${placeholders})
       GROUP BY seafarer_id`,
      seafarerIds
    )
    const [noteRows] = await pool.query(
      `SELECT cl.seafarer_id, cl.note as last_call_note
       FROM seafarer_call_log cl
       INNER JOIN (
         SELECT seafarer_id, MAX(called_at) as max_at
         FROM seafarer_call_log
         WHERE seafarer_id IN (${placeholders})
         GROUP BY seafarer_id
       ) latest ON cl.seafarer_id = latest.seafarer_id AND cl.called_at = latest.max_at
       WHERE cl.seafarer_id IN (${placeholders})`,
      [...seafarerIds, ...seafarerIds]
    )
    const noteMap = {}
    noteRows.forEach((r) => {
      noteMap[r.seafarer_id] = r.last_call_note
    })

    const result = {}
    rows.forEach((r) => {
      result[r.seafarer_id] = {
        call_count: r.call_count,
        first_call_at: r.first_call_at,
        last_call_at: r.last_call_at,
        last_call_note: noteMap[r.seafarer_id] || null,
      }
    })
    return result
  },
}

module.exports = seafarerCallService
