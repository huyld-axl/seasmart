const pool = require('../config/db')

const notificationService = {
  async list(userId, { is_read, limit = 10 } = {}) {
    const where = ['user_id = ?']
    const params = [userId]
    if (is_read !== undefined && is_read !== '') {
      where.push('is_read = ?')
      params.push(is_read === true || is_read === 'true' || is_read === 1 ? 1 : 0)
    }
    const limitVal = Math.min(parseInt(limit) || 10, 50)
    params.push(limitVal)
    const [rows] = await pool.query(
      `SELECT id, user_id, type, ref_table, ref_id, title, body, is_read, read_at, created_at
       FROM notification
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      params
    )
    return rows
  },

  async getUnreadCount(userId) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM notification WHERE user_id = ? AND is_read = 0',
      [userId]
    )
    return count
  },

  async markRead(userId, notificationId) {
    const [r] = await pool.query(
      'UPDATE notification SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    )
    return r.affectedRows > 0
  },

  async markAllRead(userId) {
    const [r] = await pool.query(
      'UPDATE notification SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    )
    return r.affectedRows
  },

  async create(notification) {
    const { user_id, type, ref_table, ref_id, title, body } = notification
    const [result] = await pool.query(
      'INSERT INTO notification (user_id, type, ref_table, ref_id, title, body) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, type, ref_table || null, ref_id || null, title, body || null]
    )
    return result.insertId
  },

  async hasRecentDuplicate(userId, type, refId, withinHours = 24) {
    const [rows] = await pool.query(
      `SELECT 1 FROM notification
       WHERE user_id = ? AND type = ? AND ref_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [userId, type, refId, withinHours]
    )
    return rows.length > 0
  },
}

module.exports = notificationService
