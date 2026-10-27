const { mapCatalogRow } = require('./vessel_lookup/map')
const { loadRefs } = require('./vessel_lookup/refs')

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

module.exports = { shipCatalogService, MIN_QUERY }
