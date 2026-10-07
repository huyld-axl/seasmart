const { isValidImo } = require('../utils/imo')

const MAX_LIST_LIMIT = 100

// Cột được phép ghi cho từng bảng (pickAllowed)
const VESSEL_COLUMNS = ['vessel_name', 'imo_number', 'vessel_type_id', 'flag_country_id', 'ship_owner_id', 'gross_tonnage', 'deadweight', 'year_built', 'notes']
const OWNER_COLUMNS = ['code', 'company_name', 'company_name_en', 'country_id', 'address', 'contact_person', 'contact_phone', 'contact_email', 'notes']

function pickAllowed(data, allowed) {
  return Object.fromEntries(
    Object.entries(data || {})
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => [key, value === '' ? null : value])
  )
}

function paging(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  return { page, limit, offset: (page - 1) * limit }
}

function validateVessel(data) {
  if (data.imo_number != null && !isValidImo(data.imo_number)) {
    throw { statusCode: 400, message: 'IMO sai số kiểm tra' }
  }
}

async function duplicateGuard(promise, message) {
  try {
    return await promise
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw { statusCode: 409, message }
    throw error
  }
}

const VESSEL_SELECT = `SELECT v.id, v.vessel_name, v.imo_number, v.vessel_type_id, vt.name_vi AS vessel_type_name,
    v.flag_country_id, c.name_vi AS flag_name, v.ship_owner_id, o.company_name AS ship_owner_name,
    v.gross_tonnage, v.deadweight, v.year_built, v.notes, v.updated_at
  FROM vessel v
  LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id
  LEFT JOIN country c ON c.id = v.flag_country_id
  LEFT JOIN ship_owner o ON o.id = v.ship_owner_id`

const OWNER_SELECT = `SELECT o.id, o.code, o.company_name, o.company_name_en, o.country_id, c.name_vi AS country_name,
    o.address, o.contact_person, o.contact_phone, o.contact_email, o.notes, o.updated_at,
    (SELECT COUNT(*) FROM vessel v WHERE v.ship_owner_id = o.id AND v.deleted_at IS NULL) AS vessel_count
  FROM ship_owner o
  LEFT JOIN country c ON c.id = o.country_id`

const fleetService = {
  async listVessels(pool, query) {
    const { limit, offset } = paging(query)
    const params = []
    let where = 'WHERE v.deleted_at IS NULL'
    if (query.search) {
      where += ' AND (v.vessel_name LIKE ? OR v.imo_number LIKE ?)'
      params.push(`%${query.search}%`, `%${query.search}%`)
    }
    const [rows] = await pool.query(`${VESSEL_SELECT} ${where} ORDER BY v.vessel_name LIMIT ? OFFSET ?`, [...params, limit, offset])
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM vessel v ${where}`, params)
    return { data: rows, total }
  },

  async getVessel(pool, id) {
    const [[row]] = await pool.query(`${VESSEL_SELECT} WHERE v.id = ? AND v.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy tàu' }
    return row
  },

  async createVessel(pool, body) {
    const data = pickAllowed(body, VESSEL_COLUMNS)
    if (!data.vessel_name) throw { statusCode: 400, message: 'Thiếu tên tàu' }
    validateVessel(data)
    const cols = Object.keys(data)
    const [result] = await duplicateGuard(
      pool.query(`INSERT INTO vessel (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(data)),
      'IMO này đã có trong danh mục'
    )
    return this.getVessel(pool, result.insertId)
  },

  async updateVessel(pool, id, body) {
    const data = pickAllowed(body, VESSEL_COLUMNS)
    if (!Object.keys(data).length) throw { statusCode: 400, message: 'Không có dữ liệu hợp lệ' }
    if ('vessel_name' in data && !data.vessel_name) throw { statusCode: 400, message: 'Thiếu tên tàu' }
    validateVessel(data)
    await this.getVessel(pool, id)
    const cols = Object.keys(data)
    await duplicateGuard(
      pool.query(`UPDATE vessel SET ${cols.map((c) => `\`${c}\` = ?`).join(',')} WHERE id = ? AND deleted_at IS NULL`, [...Object.values(data), id]),
      'IMO này đã có trong danh mục'
    )
    return this.getVessel(pool, id)
  },

  async softDelete(pool, table, id) {
    const [result] = await pool.query(`UPDATE \`${table}\` SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`, [id])
    if (!result.affectedRows) throw { statusCode: 404, message: 'Không tìm thấy' }
    return { success: true }
  },

  async restore(pool, table, id) {
    const [result] = await duplicateGuard(
      pool.query(`UPDATE \`${table}\` SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`, [id]),
      'Không khôi phục được: mã hoặc IMO đã được dùng cho bản ghi khác'
    )
    if (!result.affectedRows) throw { statusCode: 404, message: 'Không có bản ghi đã xoá để khôi phục' }
    return { success: true }
  },

  async listOwners(pool, query) {
    const { limit, offset } = paging(query)
    const params = []
    let where = 'WHERE o.deleted_at IS NULL'
    if (query.search) {
      where += ' AND (o.company_name LIKE ? OR o.code LIKE ?)'
      params.push(`%${query.search}%`, `%${query.search}%`)
    }
    const [rows] = await pool.query(`${OWNER_SELECT} ${where} ORDER BY o.company_name LIMIT ? OFFSET ?`, [...params, limit, offset])
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ship_owner o ${where}`, params)
    return { data: rows, total }
  },

  async getOwner(pool, id) {
    const [[row]] = await pool.query(`${OWNER_SELECT} WHERE o.id = ? AND o.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy chủ tàu' }
    return row
  },

  async createOwner(pool, body) {
    const data = pickAllowed(body, OWNER_COLUMNS)
    if (!data.code || !data.company_name) throw { statusCode: 400, message: 'Thiếu mã hoặc tên chủ tàu' }
    const cols = Object.keys(data)
    const [result] = await duplicateGuard(
      pool.query(`INSERT INTO ship_owner (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(data)),
      'Mã chủ tàu đã tồn tại'
    )
    return this.getOwner(pool, result.insertId)
  },

  async updateOwner(pool, id, body) {
    const data = pickAllowed(body, OWNER_COLUMNS)
    if (!Object.keys(data).length) throw { statusCode: 400, message: 'Không có dữ liệu hợp lệ' }
    if (('code' in data && !data.code) || ('company_name' in data && !data.company_name)) {
      throw { statusCode: 400, message: 'Thiếu mã hoặc tên chủ tàu' }
    }
    await this.getOwner(pool, id)
    const cols = Object.keys(data)
    await duplicateGuard(
      pool.query(`UPDATE ship_owner SET ${cols.map((c) => `\`${c}\` = ?`).join(',')} WHERE id = ? AND deleted_at IS NULL`, [...Object.values(data), id]),
      'Mã chủ tàu đã tồn tại'
    )
    return this.getOwner(pool, id)
  },
}

module.exports = { fleetService, pickAllowed, VESSEL_COLUMNS, OWNER_COLUMNS }
