const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': '\'' }
const JUNK = /[?#<>[\]^~*=$%:\n\r]/

function realImo(sourceId) {
  return sourceId >= 1000000 && sourceId <= 9999999 ? String(sourceId) : null
}

function cleanText(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

// EX_NAMES là chuỗi tách bằng ';', có tên rác do nguồn lỗi mã hoá (HTML escape, ký tự lạ).
function splitExNames(value, shipName) {
  const seen = new Set([String(shipName || '').toUpperCase()])
  const names = []
  const decoded = String(value || '').replace(/&(?:lt|gt|amp|quot|#39);/g, (entity) => ENTITIES[entity])
  for (const part of decoded.split(';')) {
    const name = cleanText(part, 255)
    if (!name || JUNK.test(name) || seen.has(name.toUpperCase())) continue
    seen.add(name.toUpperCase())
    names.push(name)
  }
  return names
}

// Một dòng SHOW_FLEET (kèm REGISTER_ID, ABBR) -> dòng ship_catalog + danh sách tên cũ.
function toCatalogRow(row) {
  const sourceId = Number(row.IMO_NO)
  const shipName = cleanText(row.SHIP_NAME, 255)
  if (!Number.isSafeInteger(sourceId) || !shipName) return null
  const mmsi = String(row.MMSI ?? '')
  return {
    source_id: sourceId,
    imo_number: realImo(sourceId),
    ship_name: shipName,
    mmsi: /^\d{9}$/.test(mmsi) ? mmsi : null,
    ship_type: cleanText(row.SHIP_TYPE, 100),
    ship_type_group: cleanText(row.SHIP_TYPE_GROUP, 100),
    flag_code: /^[A-Za-z]{2}$/.test(row.ABBR || '') ? row.ABBR.toUpperCase() : null,
    flag_name: cleanText(row.COUNTRY_NAME, 100),
    register_id: cleanText(row.REGISTER_ID, 50),
    ex_names: splitExNames(row.EX_NAMES, shipName),
  }
}

module.exports = { realImo, splitExNames, toCatalogRow }
