const { mapCatalogRow } = require('./vessel_lookup/map')
const { loadRefs } = require('./vessel_lookup/refs')
const config = require('../config')
const desktopCloud = require('../utils/desktop_cloud')

const MIN_QUERY = 2
const MAX_LIMIT = 50

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

const HIT_CTE = `WITH hit AS (
  SELECT source_id FROM ship_catalog WHERE ship_name ILIKE ?
  UNION SELECT source_id FROM ship_catalog_exname WHERE name ILIKE ?
  UNION SELECT source_id FROM ship_catalog WHERE imo_number = ?
  UNION SELECT source_id FROM ship_catalog WHERE mmsi = ?
)`
// Tàu đã có trong MCAH (kể cả đã xoá mềm, vì imo_number là unique trên cả bảng) không hiện trong danh mục.
const NOT_IN_MCAH = 'NOT EXISTS (SELECT 1 FROM vessel v WHERE v.imo_number = s.imo_number)'

// Danh mục tàu thế giới: tìm theo tên, tên cũ, IMO (7 số) hoặc MMSI (9 số). Mỗi nhánh UNION dùng một index riêng.
// Mỗi dòng kèm `prefill` (cột của vessel, đã đổi loại tàu và cờ sang id) và `unmatched` (chữ gốc không khớp) cho form Thêm tàu.
const shipCatalogService = {
  async search(db, { q, page = 1, limit = 20 } = {}) {
    const term = String(q || '').trim()
    const size = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 20))
    const current = Math.max(1, Number(page) || 1)
    if (term.length < MIN_QUERY) return { data: [], total: 0, page: current, limit: size }
    if (config.desktop) return searchCloud(db, term, current, size)
    const contains = `%${escapeLike(term)}%`
    const prefix = `${escapeLike(term)}%`
    const imo = /^\d{7}$/.test(term) ? term : null
    const mmsi = /^\d{9}$/.test(term) ? term : null
    const hit = [contains, contains, imo, mmsi]

    const [[{ total }]] = await db.query(`${HIT_CTE} SELECT COUNT(*) AS total FROM hit JOIN ship_catalog s ON s.source_id = hit.source_id WHERE ${NOT_IN_MCAH}`, hit)
    if (!Number(total)) return { data: [], total: 0, page: current, limit: size }

    const [rows] = await db.query(
      `${HIT_CTE}
       SELECT s.source_id, s.imo_number, s.ship_name, s.mmsi, s.ship_type, s.ship_type_group, s.flag_code, s.flag_name,
              CASE WHEN s.ship_name ILIKE ? THEN NULL
                   ELSE (SELECT min(e.name) FROM ship_catalog_exname e WHERE e.source_id = s.source_id AND e.name ILIKE ?) END AS ex_name
       FROM hit JOIN ship_catalog s ON s.source_id = hit.source_id
       WHERE ${NOT_IN_MCAH}
       ORDER BY (s.ship_name ILIKE ?) DESC, (s.imo_number IS NOT NULL) DESC, s.ship_name, s.source_id
       LIMIT ? OFFSET ?`,
      [...hit, contains, contains, prefix, size, (current - 1) * size]
    )
    const refs = await loadRefs(db)
    return { data: rows.map((row) => ({ ...row, ...mapCatalogRow(row, refs) })), total: Number(total), page: current, limit: size }
  },
}

// App máy tính: danh mục nằm ở máy chủ dịch vụ MCAH (không phát cả danh mục trong bộ cài). Máy chủ trả dòng thô;
// ở đây loại tàu đã có trong văn phòng và đổi loại tàu / cờ sang mã của văn phòng như bản web.
async function searchCloud(db, term, page, limit) {
  let result
  try {
    result = await desktopCloud.call(`/api/vessels/catalog?q=${encodeURIComponent(term)}&page=${page}&limit=${limit}`, null, { method: 'GET' })
  } catch (error) {
    if (['CLOUD_OFFLINE', 'SIGNER_DOWN', 'NO_OFFICE'].includes(error.code)) throw { statusCode: 503, message: 'Cần kết nối internet để tìm danh mục tàu' }
    throw error
  }
  const imos = result.data.map((row) => row.imo_number).filter(Boolean)
  const [existing] = imos.length ? await db.query('SELECT imo_number FROM vessel WHERE imo_number IN (?)', [imos]) : [[]]
  const taken = new Set(existing.map((row) => row.imo_number))
  const refs = await loadRefs(db)
  const data = result.data.filter((row) => !row.imo_number || !taken.has(row.imo_number)).map((row) => ({ ...row, ...mapCatalogRow(row, refs) }))
  return { data, total: Math.max(0, Number(result.total) - (result.data.length - data.length)), page: result.page, limit: result.limit }
}

module.exports = { shipCatalogService, MIN_QUERY }
