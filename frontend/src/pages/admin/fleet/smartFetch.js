import { filled } from './fleetView'

// Lấy thông tin thông minh: đổi bản đề xuất của máy chủ (cột của vessel) thành thay đổi cho form tàu.
// Trường form mà bản đề xuất được phép điền. Không gồm `status`, `has_boiler`, `has_refrigeration` vì form luôn có giá trị mặc định,
// và không gồm `imo_number` vì đó là khoá để tra.
export const SMART_FIELDS = [
  'vessel_name', 'call_sign', 'mmsi', 'vessel_type_id', 'flag_country_id', 'year_built', 'classification_society', 'class_status',
  'gross_tonnage', 'deadweight', 'passenger_capacity', 'crew_capacity', 'engine_power_kw', 'engine_type', 'dp_class', 'technical_manager',
]
// Trường lấy từ một dòng danh mục tàu thế giới.
export const CATALOG_FIELDS = ['vessel_name', 'imo_number', 'mmsi', 'vessel_type_id', 'flag_country_id']

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => filled(source?.[key])).map((key) => [key, source[key]]))

export const catalogValues = (prefill) => pick(prefill, CATALOG_FIELDS)

// Thêm tàu: chỉ điền vào ô còn trống, giữ nguyên ô người dùng đã có.
export function fillBlanks(values, proposal) {
  return pick(proposal, SMART_FIELDS.filter((key) => !filled(values?.[key])))
}

// Sửa tàu: không ghi đè. Liệt kê ô trống hoặc khác giá trị hiện tại; ô trống được chọn sẵn.
// display(key, value) đổi id thành tên để hiện cho người dùng.
export function compareRows(values, proposal, { labels = {}, display = (key, value) => value } = {}) {
  return SMART_FIELDS.filter((key) => filled(proposal?.[key]) && String(values?.[key] ?? '') !== String(proposal[key])).map((key) => ({
    key,
    label: labels[key] || key,
    current: filled(values?.[key]) ? display(key, values[key]) : null,
    next: display(key, proposal[key]),
    value: proposal[key],
    on: !filled(values?.[key]),
  }))
}

// Chữ gợi ý cho trường khoá ngoại không khớp danh mục: chỉ khi ô còn trống.
export function unmatchedHints(unmatched = {}, values = {}) {
  return {
    vessel_type: !filled(values.vessel_type_id) && unmatched.vessel_type ? unmatched.vessel_type : null,
    flag: !filled(values.flag_country_id) && unmatched.flag ? unmatched.flag : null,
    ship_owner: !filled(values.ship_owner_id) && unmatched.ship_owner ? unmatched.ship_owner : null,
  }
}

// Mã loại tàu tự sinh từ tên tiếng Anh, tránh trùng mã có sẵn.
export function vesselTypeCode(nameEn, existingCodes = []) {
  const base = String(nameEn || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'TYPE'
  const taken = new Set(existingCodes.map((code) => String(code).toUpperCase()))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

// Form Thêm tàu mở từ Danh mục tàu thế giới (hoặc từ ô tìm có IMO): dựng giá trị ban đầu, nguồn của từng trường, gợi ý và thông báo.
// incoming = { prefill, unmatched, smart } trong location.state; smart là kết quả Lấy thông tin thông minh nếu người dùng đã chọn lấy.
export function seedFromIncoming(base, incoming) {
  if (!incoming) return { values: base, sources: {}, unmatched: {}, catalogCount: 0, smartCount: 0, smart: null }
  const catalog = catalogValues(incoming.prefill)
  const merged = { ...base, ...catalog }
  const smart = incoming.smart || null
  const patch = smart?.found ? fillBlanks(merged, smart.proposal) : {}
  return {
    values: { ...merged, ...patch },
    sources: { ...Object.fromEntries(Object.keys(catalog).map((key) => [key, 'catalog'])), ...Object.fromEntries(Object.keys(patch).map((key) => [key, 'smart'])) },
    unmatched: { ...(incoming.unmatched || {}), ...(smart?.found ? smart.unmatched : {}) },
    catalogCount: Object.keys(catalog).length,
    smartCount: Object.keys(patch).length,
    smart,
  }
}

// Thông báo đầu form: { key, tone: 'neutral' | 'warning', title, description, vesselId? }.
export function seedNotices(seed, fetchedAt) {
  const out = []
  if (seed.catalogCount) out.push({ key: 'catalog', tone: 'neutral', title: `Đã điền ${seed.catalogCount} trường từ danh mục tàu thế giới`, description: 'Kiểm tra lại rồi bấm Thêm tàu.' })
  const smart = seed.smart
  if (smart?.found) out.push({ key: 'smart', tone: 'neutral', title: `Đã lấy thêm ${seed.smartCount} trường bằng Lấy thông minh${fetchedAt ? ` (lúc ${fetchedAt})` : ''}`, description: 'Ô đã có giá trị được giữ nguyên.' })
  else if (smart) out.push({ key: 'smart', tone: 'warning', title: `Nguồn bên ngoài không có tàu IMO ${smart.imo_number}`, description: 'Các trường còn lại nhập tay.' })
  if (smart?.existing_vessel && !smart.existing_vessel.deleted) {
    out.push({ key: 'existing', tone: 'warning', title: `IMO này đã có trong MCAH: ${smart.existing_vessel.vessel_name}`, description: 'Thêm tiếp sẽ báo trùng IMO. Mở tàu đã có để sửa.', vesselId: smart.existing_vessel.id })
  }
  return out
}
