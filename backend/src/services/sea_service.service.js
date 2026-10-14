const pool = require('../config/db')
const { withTransaction } = require('../utils/transaction')
const { normalizeRank } = require('../utils/normalize')

const TEXT_FIELDS = [
  'vessel_name_raw', 'vessel_type_raw', 'flag_raw', 'gross_tonnage_raw', 'engine_power_raw', 'owner_raw',
  'rank_raw', 'coc_number', 'sign_on_port', 'sign_off_port', 'notes',
]
const DATE_FIELDS = ['sign_on_date', 'sign_off_date']
const MATCH_STATUSES = ['NOT_CHECKED', 'MATCHED', 'NOT_FOUND']

// Ngày trả về dạng yyyy-mm-dd (không qua múi giờ).
const SELECT = `SELECT s.id, s.seafarer_id, s.document_id, s.source_type, s.vessel_name_raw, s.vessel_type_raw, s.flag_raw,
  s.gross_tonnage_raw, s.engine_power_raw, s.owner_raw, s.vessel_id, s.vessel_match_status, s.rank_raw, s.rank_id, s.coc_number,
  TO_CHAR(s.sign_on_date, 'YYYY-MM-DD') AS sign_on_date, s.sign_on_port,
  TO_CHAR(s.sign_off_date, 'YYYY-MM-DD') AS sign_off_date, s.sign_off_port,
  s.notes, s.created_by, s.updated_by, s.created_at, s.updated_at,
  v.vessel_name AS vessel_name, r.name_vi AS rank_name, r.code AS rank_code
  FROM sea_service s
  LEFT JOIN vessel v ON v.id = s.vessel_id
  LEFT JOIN "rank" r ON r.id = s.rank_id`

function cleanDate(value, label) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const text = String(value)
  const date = new Date(`${text}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw { statusCode: 400, message: `${label} chưa đúng dạng yyyy-mm-dd` }
  }
  return text
}

function summary(row) {
  return [row.vessel_name_raw, row.rank_raw, row.sign_on_date].filter(Boolean).join(' · ') || `chuyến #${row.id}`
}

const seaService = {
  // Dòng đi tàu từ trang bố trí chức danh đã duyệt; chạy trong transaction của publish().
  async insertFromDocument(conn, row) {
    await conn.query('INSERT INTO sea_service SET ?', [{ ...row, source_type: 'DOCUMENT' }])
  },

  async list(seafarerId) {
    const [rows] = await pool.query(`${SELECT} WHERE s.seafarer_id = ? AND s.deleted_at IS NULL ORDER BY s.sign_on_date IS NULL, s.sign_on_date, s.id`, [seafarerId])
    return rows
  },

  async get(id) {
    const [[row]] = await pool.query(`${SELECT} WHERE s.id = ? AND s.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy chuyến đi tàu' }
    return row
  },

  // Chọn và kiểm các trường người dùng được gửi lên.
  async clean(body, { partial }) {
    const data = {}
    for (const key of TEXT_FIELDS) {
      if (body[key] === undefined) continue
      const text = body[key] === null ? null : String(body[key]).trim()
      data[key] = text || null
    }
    for (const key of DATE_FIELDS) {
      const value = cleanDate(body[key], key === 'sign_on_date' ? 'Ngày xuống tàu' : 'Ngày rời tàu')
      if (value !== undefined) data[key] = value
    }
    if (body.vessel_id !== undefined) {
      if (body.vessel_id === null) {
        data.vessel_id = null
        data.vessel_match_status = body.vessel_match_status || 'NOT_CHECKED'
      } else {
        const [[vessel]] = await pool.query('SELECT id FROM vessel WHERE id = ? AND deleted_at IS NULL', [body.vessel_id])
        if (!vessel) throw { statusCode: 400, message: 'Không tìm thấy tàu đã chọn' }
        data.vessel_id = vessel.id
        data.vessel_match_status = 'MATCHED'
      }
    } else if (body.vessel_match_status !== undefined) {
      if (!MATCH_STATUSES.includes(body.vessel_match_status)) throw { statusCode: 400, message: 'Trạng thái đối chiếu tàu không hợp lệ' }
      data.vessel_match_status = body.vessel_match_status
    }
    // Chức danh: người dùng chọn rank_id thì dùng, không thì khớp từ chữ gốc bằng code.
    if (body.rank_id !== undefined) {
      if (body.rank_id === null) {
        data.rank_id = null
      } else {
        const [[rank]] = await pool.query('SELECT id FROM "rank" WHERE id = ?', [body.rank_id])
        if (!rank) throw { statusCode: 400, message: 'Không tìm thấy chức danh đã chọn' }
        data.rank_id = rank.id
      }
    } else if (data.rank_raw !== undefined) {
      const [ranks] = await pool.query('SELECT id, code, name_vi, name_en FROM "rank"')
      data.rank_id = data.rank_raw ? normalizeRank(data.rank_raw, ranks)?.id ?? null : null
    }
    if (!partial && !data.vessel_name_raw && !data.rank_raw) {
      throw { statusCode: 400, message: 'Nhập tên tàu hoặc chức danh của chuyến đi tàu' }
    }
    return data
  },

  async create(seafarerId, body, userId) {
    const [[seafarer]] = await pool.query('SELECT id FROM seafarer WHERE id = ? AND deleted_at IS NULL', [seafarerId])
    if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const data = await this.clean(body, { partial: false })
    const [result] = await pool.query('INSERT INTO sea_service SET ?', [
      { ...data, seafarer_id: seafarerId, source_type: 'MANUAL', created_by: userId, updated_by: userId },
    ])
    return this.get(result.insertId)
  },

  async update(id, body, reason, userId) {
    const text = String(reason || '').trim()
    if (!text) throw { statusCode: 400, message: 'Ghi lý do sửa chuyến đi tàu' }
    const before = await this.get(id)
    const data = await this.clean(body, { partial: true })
    const changes = {}
    for (const [key, value] of Object.entries(data)) {
      if ((before[key] ?? null) !== (value ?? null)) changes[`sea_service#${id}.${key}`] = [before[key] ?? null, value ?? null]
    }
    if (!Object.keys(changes).length) return before
    const after = { ...before, ...data }
    if (!after.vessel_name_raw && !after.rank_raw) throw { statusCode: 400, message: 'Chuyến đi tàu cần có tên tàu hoặc chức danh' }
    await withTransaction(pool, async (conn) => {
      await conn.query('UPDATE sea_service SET ?, updated_by = ? WHERE id = ?', [data, userId, id])
      await conn.query('INSERT INTO seafarer_revision (seafarer_id, changed_by, reason, changes) VALUES (?, ?, ?, ?)', [
        before.seafarer_id, userId, text.slice(0, 500), JSON.stringify(changes),
      ])
    })
    return this.get(id)
  },

  async remove(id, reason, userId) {
    const text = String(reason || '').trim()
    if (!text) throw { statusCode: 400, message: 'Ghi lý do xoá chuyến đi tàu' }
    const before = await this.get(id)
    await withTransaction(pool, async (conn) => {
      await conn.query('UPDATE sea_service SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [userId, id])
      await conn.query('INSERT INTO seafarer_revision (seafarer_id, changed_by, reason, changes) VALUES (?, ?, ?, ?)', [
        before.seafarer_id, userId, text.slice(0, 500), JSON.stringify({ [`sea_service#${id}`]: [summary(before), null] }),
      ])
    })
    return { success: true }
  },
}

module.exports = seaService
