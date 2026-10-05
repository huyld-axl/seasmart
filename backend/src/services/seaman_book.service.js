'use strict'

const pool = require('../config/db')

const seamanBookService = {
  async list(seafarerId) {
    const [rows] = await pool.query(
      `SELECT id, seafarer_id, book_number, issued_date, expiry_date, issued_place, notes, created_at
       FROM seaman_book
       WHERE seafarer_id = ? AND deleted_at IS NULL
       ORDER BY issued_date DESC, id DESC`,
      [seafarerId]
    )
    return rows
  },

  async create(seafarerId, data) {
    const { book_number, issued_date, expiry_date, issued_place, notes } = data
    if (!book_number?.trim()) throw { statusCode: 400, message: 'Số sổ không được để trống' }
    const [result] = await pool.query(
      `INSERT INTO seaman_book (seafarer_id, book_number, issued_date, expiry_date, issued_place, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        seafarerId,
        book_number.trim(),
        issued_date || null,
        expiry_date || null,
        issued_place?.trim() || null,
        notes?.trim() || null,
      ]
    )
    const [[row]] = await pool.query('SELECT * FROM seaman_book WHERE id = ?', [result.insertId])
    return row
  },

  async update(seafarerId, id, data) {
    const { book_number, issued_date, expiry_date, issued_place, notes } = data
    if (book_number !== undefined && !book_number?.trim())
      throw { statusCode: 400, message: 'Số sổ không được để trống' }
    const [[existing]] = await pool.query(
      'SELECT id FROM seaman_book WHERE id = ? AND seafarer_id = ? AND deleted_at IS NULL',
      [id, seafarerId]
    )
    if (!existing) throw { statusCode: 404, message: 'Không tìm thấy' }
    const updates = []
    const params = []
    if (book_number !== undefined) {
      updates.push('book_number = ?')
      params.push(book_number.trim())
    }
    if (issued_date !== undefined) {
      updates.push('issued_date = ?')
      params.push(issued_date || null)
    }
    if (expiry_date !== undefined) {
      updates.push('expiry_date = ?')
      params.push(expiry_date || null)
    }
    if (issued_place !== undefined) {
      updates.push('issued_place = ?')
      params.push(issued_place?.trim() || null)
    }
    if (notes !== undefined) {
      updates.push('notes = ?')
      params.push(notes?.trim() || null)
    }
    if (updates.length === 0) return existing
    params.push(id)
    await pool.query(`UPDATE seaman_book SET ${updates.join(', ')} WHERE id = ?`, params)
    const [[row]] = await pool.query('SELECT * FROM seaman_book WHERE id = ?', [id])
    return row
  },

  async remove(seafarerId, id) {
    const [[existing]] = await pool.query(
      'SELECT id FROM seaman_book WHERE id = ? AND seafarer_id = ? AND deleted_at IS NULL',
      [id, seafarerId]
    )
    if (!existing) throw { statusCode: 404, message: 'Không tìm thấy' }
    await pool.query('UPDATE seaman_book SET deleted_at = NOW() WHERE id = ?', [id])
  },
}

module.exports = seamanBookService
