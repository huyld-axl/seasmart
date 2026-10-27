// Đổi dữ liệu thô của nguồn ngoài (và dòng danh mục tàu) thành bản đề xuất theo cột của bảng vessel.
// Hàm thuần: không đọc DB, `refs` là danh mục loại tàu và quốc gia đã đọc sẵn.

// Bỏ dấu, hạ chữ thường, bỏ dấu câu, gọn khoảng trắng. Dùng để so khớp tên.
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function text(value, max) {
  if (value === null || value === undefined) return null
  const out = String(value).trim().replace(/\s+/g, ' ')
  return out ? out.slice(0, max) : null
}

function number(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[,\s]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function count(value) {
  const parsed = number(value)
  return parsed === null ? null : Math.round(parsed)
}

function flag(value) {
  if (value === true || value === 1 || String(value).toLowerCase() === 'true') return 1
  if (value === false || value === 0 || String(value).toLowerCase() === 'false') return 0
  return null
}

// Từ khoá trong tên loại tàu của nguồn ngoài -> mã loại tàu của MCAH. Từ trên xuống, gặp là dừng.
const TYPE_KEYWORDS = [
  [/chemical/, 'TANKER-CHEM'],
  [/\b(lng|lpg|gas)\b/, 'TANKER-GAS'],
  [/crude|oil|product|tanker/, 'TANKER-OIL'],
  [/container/, 'CONTAINER'],
  [/bulk|ore carrier|cement|limestone/, 'BULK'],
  [/general cargo|multi purpose|multipurpose|cargo/, 'GENERAL-CARGO'],
  [/ro ro|roro|vehicle|car carrier/, 'RORO'],
  [/tug/, 'TUG'],
  [/offshore|supply|platform/, 'OFFSHORE'],
  [/passenger|cruise/, 'PASSENGER'],
  [/ferry|high speed/, 'FERRY'],
  [/fishing|trawler/, 'FISHING'],
  [/dredg/, 'DREDGER'],
  [/crane/, 'CRANE'],
  [/barge/, 'BARGE'],
]

// Trả id loại tàu hoặc null. Thử khớp đúng tên tiếng Anh trước, rồi mới dò từ khoá.
function matchVesselType(raw, types = []) {
  const key = normalize(raw)
  if (!key) return null
  const exact = types.find((type) => normalize(type.name_en) === key || normalize(type.code) === key)
  if (exact) return exact.id
  const hit = TYPE_KEYWORDS.find(([pattern]) => pattern.test(key))
  const found = hit && types.find((type) => String(type.code) === hit[1])
  return found ? found.id : null
}

// Tên gọi khác của quốc gia ở các nguồn tàu biển (khác name_en trong danh mục).
const COUNTRY_ALIASES = {
  'marshall is': 'MH', 'marshall islands': 'MH', 'hong kong china': 'HK', 'hong kong': 'HK', 'korea south': 'KR', 'south korea': 'KR',
  'korea republic of': 'KR', 'russian federation': 'RU', 'united states of america': 'US', 'usa': 'US', 'uk': 'GB',
  'united kingdom': 'GB', 'great britain': 'GB', 'viet nam': 'VN', 'cayman is': 'KY', 'bahamas the': 'BS',
  'st vincent grenadines': 'VC', 'st kitts nevis': 'KN', 'cook is': 'CK', 'china people s republic of': 'CN', 'china pr': 'CN',
}

function matchCountry(raw, countries = []) {
  const key = normalize(raw)
  if (!key) return null
  const upper = String(raw).trim().toUpperCase()
  const byCode = countries.find((country) => String(country.code).toUpperCase() === upper)
  if (byCode) return byCode.id
  const byName = countries.find((country) => normalize(country.name_en) === key || normalize(country.name_vi) === key)
  if (byName) return byName.id
  const code = COUNTRY_ALIASES[key]
  const alias = code && countries.find((country) => String(country.code).toUpperCase() === code)
  return alias ? alias.id : null
}

function mapStatus(value) {
  const key = normalize(value)
  if (!key) return null
  if (key.includes('construction')) return 'UNDER_CONSTRUCTION'
  if (key.includes('scrap') || key.includes('broken')) return 'SCRAPPED'
  if (key.includes('laid')) return 'LAID_UP'
  return 'ACTIVE'
}

// Kiểm "không đăng kiểm" trước "đăng kiểm", vì "unclassed" cũng chứa "classed".
function mapClassStatus(value) {
  const key = normalize(value)
  if (!key) return null
  if (key.includes('suspend')) return 'SUSPENDED'
  if (key.includes('withdraw')) return 'WITHDRAWN'
  if (key.includes('not class') || key.includes('unclass')) return 'UNCLASSED'
  if (key.includes('class')) return 'IN_CLASS'
  return null
}

function mapDpClass(value) {
  const key = normalize(value)
  if (!key) return null
  if (key === 'none') return 'NONE'
  const match = /dp\s*s?\s*([123])/.exec(key)
  return match ? `DP${match[1]}` : null
}

function year(value) {
  const match = /\d{4}/.exec(String(value ?? ''))
  const parsed = match ? Number(match[0]) : null
  return parsed && parsed >= 1900 && parsed <= 2100 ? parsed : null
}

const first = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== '') ?? null

function digits(value, length) {
  const out = String(value ?? '').trim()
  return new RegExp(`^\\d{${length}}$`).test(out) ? out : null
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined))
}

// raw: phần `data` của nguồn ngoài. Trả { proposal, unmatched, extra }.
//  proposal: chỉ các cột của vessel và chỉ trường có giá trị hợp lệ (đã khớp ràng buộc của form).
//  unmatched: chữ gốc của trường khoá ngoại không khớp danh mục, để giao diện gợi ý chọn tay.
//  extra: thông tin không có cột riêng, chỉ để hiển thị.
function mapProposal(raw = {}, refs = {}) {
  const rawType = first(raw.vessel_type, raw.type, raw.ship_type)
  const rawFlag = first(raw.flag, raw.flag_country, raw.flag_country_name, raw.flag_state)
  const typeId = matchVesselType(rawType, refs.types)
  const flagId = matchCountry(rawFlag, refs.countries)
  const proposal = compact({
    vessel_name: text(raw.name, 150),
    imo_number: digits(raw.imo_number, 7),
    mmsi: digits(raw.mmsi, 9),
    call_sign: text(raw.call_sign, 10),
    vessel_type_id: typeId,
    flag_country_id: flagId,
    year_built: year(raw.year_built),
    classification_society: text(raw.class_society, 50),
    status: mapStatus(raw.lifecycle_status),
    class_status: mapClassStatus(raw.class_status),
    gross_tonnage: number(raw.gross_tonnage),
    deadweight: number(raw.deadweight),
    passenger_capacity: count(raw.passenger_capacity),
    crew_capacity: count(raw.crew_capacity),
    engine_power_kw: number(raw.engine_power_kw),
    engine_type: text(raw.engine_type, 100),
    dp_class: mapDpClass(raw.dp_class),
    has_boiler: flag(raw.has_boiler),
    has_refrigeration: flag(raw.has_refrigeration),
    technical_manager: text(raw.manager_name, 200),
  })
  const ownerName = text(raw.owner_name, 200)
  const unmatched = compact({
    vessel_type: rawType && typeId === null ? text(rawType, 100) : null,
    flag: rawFlag && flagId === null ? text(rawFlag, 100) : null,
    ship_owner: ownerName,
  })
  const extra = compact({
    owner_name: ownerName,
    class_number: text(raw.class_number, 50),
    class_notation: text(raw.class_notation, 100),
    engine_maker: text(raw.engine_maker, 100),
    trade_area: text(raw.trade_area, 100),
  })
  return { proposal, unmatched, extra }
}

// Dòng ship_catalog -> bản điền sẵn cho form Thêm tàu. Loại tàu thử theo nhóm loại tàu trước, rồi theo tên loại.
function mapCatalogRow(row, refs = {}) {
  const typeId = matchVesselType(row.ship_type, refs.types) ?? matchVesselType(row.ship_type_group, refs.types)
  const flagId = matchCountry(row.flag_code, refs.countries) ?? matchCountry(row.flag_name, refs.countries)
  const prefill = compact({
    vessel_name: text(row.ship_name, 150),
    imo_number: row.imo_number || null,
    mmsi: row.mmsi || null,
    vessel_type_id: typeId,
    flag_country_id: flagId,
  })
  const unmatched = compact({
    vessel_type: row.ship_type && typeId === null ? text(row.ship_type, 100) : null,
    flag: row.flag_name && flagId === null ? text(row.flag_name, 100) : null,
  })
  return { prefill, unmatched }
}

module.exports = { normalize, matchVesselType, matchCountry, mapStatus, mapClassStatus, mapDpClass, mapProposal, mapCatalogRow }
