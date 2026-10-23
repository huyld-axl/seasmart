const { isValidImo } = require('../utils/imo')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')
const { withTransaction } = require('../utils/transaction')

const MAX_LIST_LIMIT = 100

// Cột được phép ghi cho từng bảng (pickAllowed)
const VESSEL_COLUMNS = [
  'vessel_name', 'vessel_name_prev', 'imo_number', 'call_sign', 'mmsi',
  'vessel_type_id', 'flag_country_id', 'year_built', 'port_of_registry_id', 'classification_society', 'status', 'class_status',
  'gross_tonnage', 'net_tonnage', 'deadweight', 'length_overall', 'passenger_capacity', 'crew_capacity',
  'engine_power_kw', 'engine_type', 'dp_class', 'has_boiler', 'has_refrigeration',
  'ship_owner_id', 'technical_manager', 'commercial_manager', 'notes',
]
const OWNER_COLUMNS = [
  'company_name', 'company_name_en', 'country_id', 'tax_id', 'address', 'phone', 'fax', 'email', 'website',
  'is_active', 'notes',
]
const CONTACT_MAX = 20
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const VESSEL_STATUSES = ['ACTIVE', 'LAID_UP', 'UNDER_CONSTRUCTION', 'SCRAPPED']

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

// Người liên hệ gửi từ form: bỏ dòng trống, tối đa CONTACT_MAX người, đúng một người chính (mặc định người đầu tiên) nếu có người.
function cleanContacts(list) {
  const text = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null)
  const rows = (Array.isArray(list) ? list : [])
    .map((item) => ({ name: text(item?.name, 150), position: text(item?.position, 100), phone: text(item?.phone, 30), email: text(item?.email, 150), is_primary: Boolean(item?.is_primary) }))
    .filter((item) => item.name || item.position || item.phone || item.email)
  if (rows.some((item) => !item.name)) throw { statusCode: 400, message: 'Người liên hệ cần có họ tên' }
  if (rows.length > CONTACT_MAX) throw { statusCode: 400, message: `Tối đa ${CONTACT_MAX} người liên hệ` }
  const primary = rows.findIndex((item) => item.is_primary)
  return rows.map((item, index) => ({ ...item, is_primary: index === (primary === -1 ? 0 : primary) }))
}

async function replaceContacts(conn, ownerId, contacts) {
  await conn.query('DELETE FROM ship_owner_contact WHERE ship_owner_id = ?', [ownerId])
  for (const [index, item] of contacts.entries()) {
    await conn.query(
      'INSERT INTO ship_owner_contact (ship_owner_id, name, position, phone, email, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ownerId, item.name, item.position, item.phone, item.email, item.is_primary ? 1 : 0, index]
    )
  }
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
    if (error.code === '23505') throw { statusCode: 409, message }
    throw error
  }
}

const ON_BOARD = 'ss.deleted_at IS NULL AND ss.sign_off_date IS NULL AND ss.sign_on_date IS NOT NULL'

const VESSEL_SELECT = `SELECT v.id, v.vessel_name, v.vessel_name_prev, v.imo_number, v.call_sign, v.mmsi,
    v.vessel_type_id, vt.name_vi AS vessel_type_name, v.flag_country_id, c.name_vi AS flag_name,
    v.year_built, v.port_of_registry_id, p.name AS port_of_registry_name, v.classification_society, v.status, v.class_status,
    v.gross_tonnage, v.net_tonnage, v.deadweight, v.length_overall, v.passenger_capacity, v.crew_capacity,
    v.engine_power_kw, v.engine_type, v.dp_class, v.has_boiler, v.has_refrigeration,
    v.ship_owner_id, o.company_name AS ship_owner_name,
    v.technical_manager, v.commercial_manager, v.notes, v.updated_at,
    (SELECT COUNT(*) FROM sea_service ss WHERE ss.vessel_id = v.id AND ${ON_BOARD}) AS crew_on_board
  FROM vessel v
  LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id
  LEFT JOIN country c ON c.id = v.flag_country_id
  LEFT JOIN port p ON p.id = v.port_of_registry_id
  LEFT JOIN ship_owner o ON o.id = v.ship_owner_id`

const OWNER_SELECT = `SELECT o.id, o.company_name, o.company_name_en, o.country_id, c.name_vi AS country_name, c.code AS country_code,
    o.tax_id, o.address, o.phone, o.fax, o.email, o.website,
    o.is_active, o.notes, o.updated_at,
    (SELECT COALESCE(json_agg(json_build_object('id', ct.id, 'name', ct.name, 'position', ct.position, 'phone', ct.phone, 'email', ct.email, 'is_primary', ct.is_primary = 1)
       ORDER BY ct.is_primary DESC, ct.sort_order, ct.id), '[]'::json) FROM ship_owner_contact ct WHERE ct.ship_owner_id = o.id) AS contacts,
    (o.logo_path IS NOT NULL) AS has_logo,
    (SELECT COUNT(*) FROM vessel v WHERE v.ship_owner_id = o.id AND v.deleted_at IS NULL) AS vessel_count,
    (SELECT COUNT(*) FROM export_pack ep WHERE ep.ship_owner_id = o.id AND ep.deleted_at IS NULL) AS pack_count
  FROM ship_owner o
  LEFT JOIN country c ON c.id = o.country_id`

function sniffLogo(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  return null
}

const fleetService = {
  async listVessels(pool, query) {
    const { limit, offset } = paging(query)
    const params = []
    let search = ''
    if (query.search) {
      search = ' AND (unaccent(v.vessel_name::text) ILIKE unaccent(?) OR unaccent(v.imo_number::text) ILIKE unaccent(?) OR unaccent(o.company_name::text) ILIKE unaccent(?))'
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`)
    }
    const status = VESSEL_STATUSES.includes(query.status) ? query.status : null
    const from = 'FROM vessel v LEFT JOIN ship_owner o ON o.id = v.ship_owner_id WHERE v.deleted_at IS NULL'
    const [rows] = await pool.query(
      `${VESSEL_SELECT} WHERE v.deleted_at IS NULL${search}${status ? ' AND v.status = ?' : ''} ORDER BY v.vessel_name LIMIT ? OFFSET ?`,
      [...params, ...(status ? [status] : []), limit, offset]
    )
    const [countRows] = await pool.query(`SELECT v.status, COUNT(*) AS n ${from}${search} GROUP BY v.status`, params)
    const counts = { all: 0, ...Object.fromEntries(VESSEL_STATUSES.map((key) => [key, 0])) }
    for (const row of countRows) {
      counts[row.status] = Number(row.n)
      counts.all += Number(row.n)
    }
    return { data: rows, total: status ? counts[status] : counts.all, counts }
  },

  async getVessel(pool, id) {
    const [[row]] = await pool.query(`${VESSEL_SELECT} WHERE v.id = ? AND v.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy tàu' }
    return row
  },

  async getVesselDetail(pool, id) {
    const vessel = await this.getVessel(pool, id)
    return { ...vessel, usage: await this.vesselUsage(pool, id) }
  },

  // Các chuyến đi tàu đã khớp với tàu này, mới nhất trước. Đang trên tàu là chuyến chưa có ngày rời.
  async listVesselService(pool, id) {
    await this.getVessel(pool, id)
    const [rows] = await pool.query(
      `SELECT ss.id, ss.seafarer_id, s.full_name AS seafarer_name, COALESCE(r.name_vi, ss.rank_raw) AS rank_name,
              ss.sign_on_date, ss.sign_off_date, (${ON_BOARD}) AS on_board
       FROM sea_service ss
       JOIN seafarer s ON s.id = ss.seafarer_id AND s.deleted_at IS NULL
       LEFT JOIN "rank" r ON r.id = ss.rank_id
       WHERE ss.vessel_id = ? AND ss.deleted_at IS NULL
       ORDER BY ss.sign_on_date DESC NULLS LAST, ss.id DESC LIMIT 200`,
      [id]
    )
    return { data: rows, total: rows.length }
  },

  async createVessel(pool, body) {
    const data = pickAllowed(body, VESSEL_COLUMNS)
    if (!data.vessel_name) throw { statusCode: 400, message: 'Thiếu tên tàu' }
    validateVessel(data)
    const cols = Object.keys(data)
    const [result] = await duplicateGuard(
      pool.query(`INSERT INTO vessel (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(data)),
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
      pool.query(`UPDATE vessel SET ${cols.map((c) => `"${c}" = ?`).join(',')} WHERE id = ? AND deleted_at IS NULL`, [...Object.values(data), id]),
      'IMO này đã có trong danh mục'
    )
    return this.getVessel(pool, id)
  },

  async softDelete(pool, table, id) {
    if (table === 'vessel') {
      const usage = await this.vesselUsage(pool, id)
      if (usage.total) throw { statusCode: 409, message: `Tàu đang được dùng ở ${usage.total} chỗ, không xoá được. Đổi trạng thái sang Nằm bờ hoặc Phá dỡ.` }
    }
    if (table === 'ship_owner') {
      const usage = await this.ownerUsage(pool, id)
      if (usage.total) throw { statusCode: 409, message: `Đối tác đang được dùng ở ${usage.total} chỗ, không xoá được. Chuyển sang Ngừng hợp tác.` }
    }
    const [result] = await pool.query(`UPDATE "${table}" SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`, [id])
    if (!result.affectedRows) throw { statusCode: 404, message: 'Không tìm thấy' }
    return { success: true }
  },

  async vesselUsage(pool, id) {
    const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM sea_service WHERE vessel_id = ? AND deleted_at IS NULL', [id])
    const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM voyage WHERE vessel_id = ? AND deleted_at IS NULL', [id])
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE vessel_id = ? AND deleted_at IS NULL', [id])
    const usage = { sea_service: Number(a.n), voyages: Number(b.n), documents: Number(c.n) }
    return { ...usage, total: usage.sea_service + usage.voyages + usage.documents }
  },

  async ownerUsage(pool, id) {
    const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM vessel WHERE ship_owner_id = ? AND deleted_at IS NULL', [id])
    const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM voyage WHERE ship_owner_id = ? AND deleted_at IS NULL', [id])
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM export_pack WHERE ship_owner_id = ? AND deleted_at IS NULL', [id])
    const usage = { vessels: Number(a.n), voyages: Number(b.n), packs: Number(c.n) }
    return { ...usage, total: usage.vessels + usage.voyages + usage.packs }
  },

  async restore(pool, table, id) {
    const [result] = await duplicateGuard(
      pool.query(`UPDATE "${table}" SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`, [id]),
      'Không khôi phục được: mã hoặc IMO đã được dùng cho bản ghi khác'
    )
    if (!result.affectedRows) throw { statusCode: 404, message: 'Không có bản ghi đã xoá để khôi phục' }
    return { success: true }
  },

  async listOwners(pool, query) {
    const { limit, offset } = paging(query)
    const params = []
    let search = ''
    if (query.search) {
      search = ' AND (unaccent(o.company_name::text) ILIKE unaccent(?) OR EXISTS (SELECT 1 FROM ship_owner_contact ct WHERE ct.ship_owner_id = o.id AND unaccent(ct.name::text) ILIKE unaccent(?)))'
      params.push(`%${query.search}%`, `%${query.search}%`)
    }
    const active = query.active === '1' ? 1 : query.active === '0' ? 0 : null
    const [rows] = await pool.query(
      `${OWNER_SELECT} WHERE o.deleted_at IS NULL${search}${active == null ? '' : ' AND o.is_active = ?'} ORDER BY o.company_name LIMIT ? OFFSET ?`,
      [...params, ...(active == null ? [] : [active]), limit, offset]
    )
    const [countRows] = await pool.query(`SELECT o.is_active, COUNT(*) AS n FROM ship_owner o WHERE o.deleted_at IS NULL${search} GROUP BY o.is_active`, params)
    const counts = { all: 0, active: 0, inactive: 0 }
    for (const row of countRows) {
      counts[Number(row.is_active) === 1 ? 'active' : 'inactive'] = Number(row.n)
      counts.all += Number(row.n)
    }
    const total = active == null ? counts.all : active === 1 ? counts.active : counts.inactive
    return { data: rows, total, counts }
  },

  async getOwner(pool, id) {
    const [[row]] = await pool.query(`${OWNER_SELECT} WHERE o.id = ? AND o.deleted_at IS NULL`, [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy đối tác' }
    return row
  },

  async getOwnerDetail(pool, id) {
    const owner = await this.getOwner(pool, id)
    const [vessels] = await pool.query(
      `SELECT v.id, v.vessel_name, v.imo_number, vt.name_vi AS vessel_type_name, v.status,
              (SELECT COUNT(*) FROM sea_service ss WHERE ss.vessel_id = v.id AND ${ON_BOARD}) AS crew_on_board
       FROM vessel v LEFT JOIN vessel_type vt ON vt.id = v.vessel_type_id
       WHERE v.ship_owner_id = ? AND v.deleted_at IS NULL ORDER BY v.vessel_name`,
      [id]
    )
    const [packs] = await pool.query(
      `SELECT p.id, p.title, p.created_at, s.full_name AS seafarer_name, s.id AS seafarer_id
       FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id
       WHERE p.ship_owner_id = ? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 5`,
      [id]
    )
    const usage = await this.ownerUsage(pool, id)
    return { ...owner, vessels, recent_packs: packs, usage }
  },

  async createOwner(pool, body) {
    const data = pickAllowed(body, OWNER_COLUMNS)
    if (!data.company_name) throw { statusCode: 400, message: 'Thiếu tên đối tác' }
    const contacts = cleanContacts(body.contacts)
    const cols = Object.keys(data)
    const id = await withTransaction(pool, async (conn) => {
      const [result] = await duplicateGuard(
        conn.query(`INSERT INTO ship_owner (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(data)),
        'Đối tác đã tồn tại'
      )
      await replaceContacts(conn, result.insertId, contacts)
      return result.insertId
    })
    return this.getOwner(pool, id)
  },

  async updateOwner(pool, id, body) {
    const data = pickAllowed(body, OWNER_COLUMNS)
    const contacts = body?.contacts === undefined ? null : cleanContacts(body.contacts)
    if (!Object.keys(data).length && !contacts) throw { statusCode: 400, message: 'Không có dữ liệu hợp lệ' }
    if ('company_name' in data && !data.company_name) {
      throw { statusCode: 400, message: 'Thiếu tên đối tác' }
    }
    await this.getOwner(pool, id)
    const cols = Object.keys(data)
    await withTransaction(pool, async (conn) => {
      if (cols.length) {
        await duplicateGuard(
          conn.query(`UPDATE ship_owner SET ${cols.map((c) => `"${c}" = ?`).join(',')} WHERE id = ? AND deleted_at IS NULL`, [...Object.values(data), id]),
          'Mã đối tác đã tồn tại'
        )
      }
      if (contacts) await replaceContacts(conn, id, contacts)
    })
    return this.getOwner(pool, id)
  },

  async saveOwnerLogo(pool, id, file) {
    const buffer = await file.toBuffer()
    if (file.file?.truncated || buffer.length > LOGO_MAX_BYTES) throw { statusCode: 413, message: 'Logo lớn hơn 2 MB, chọn ảnh nhỏ hơn' }
    const mime = sniffLogo(buffer)
    if (!mime) throw { statusCode: 400, message: 'Chỉ nhận logo JPG hoặc PNG' }
    const [[row]] = await pool.query('SELECT logo_path FROM ship_owner WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy đối tác' }

    const dir = path.join(config.upload.dir, 'logos')
    fs.mkdirSync(dir, { recursive: true })
    const storagePath = path.join(dir, `${id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${mime === 'image/png' ? '.png' : '.jpg'}`)
    fs.writeFileSync(storagePath, buffer)
    try {
      await pool.query('UPDATE ship_owner SET logo_path = ?, logo_mime = ? WHERE id = ?', [storagePath, mime, id])
    } catch (err) {
      fs.rmSync(storagePath, { force: true })
      throw err
    }
    if (row.logo_path) fs.rmSync(row.logo_path, { force: true })
    return this.getOwner(pool, id)
  },

  async getOwnerLogo(pool, id) {
    const [[row]] = await pool.query('SELECT logo_path, logo_mime FROM ship_owner WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row?.logo_path || !fs.existsSync(row.logo_path)) throw { statusCode: 404, message: 'Chưa có logo' }
    return { path: row.logo_path, mime: row.logo_mime }
  },

  async removeOwnerLogo(pool, id) {
    const [[row]] = await pool.query('SELECT logo_path FROM ship_owner WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy đối tác' }
    await pool.query('UPDATE ship_owner SET logo_path = NULL, logo_mime = NULL WHERE id = ?', [id])
    if (row.logo_path) fs.rmSync(row.logo_path, { force: true })
    return this.getOwner(pool, id)
  },
}

module.exports = { fleetService, pickAllowed, paging, VESSEL_COLUMNS, OWNER_COLUMNS, VESSEL_STATUSES }
