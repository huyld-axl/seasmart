import { withFlag } from '../../../utils/flag'

// Dữ liệu hiển thị của màn Tàu và Đối tác: nhãn, lựa chọn, các khối của form và của màn chi tiết.
// Mỗi khối: [nhãn, giá trị, độ rộng trên lưới 12 cột]. Cùng thứ tự khối ở form, màn chi tiết và mục lục.

export const VESSEL_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'LAID_UP', label: 'Nằm bờ' },
  { value: 'UNDER_CONSTRUCTION', label: 'Đang đóng' },
  { value: 'SCRAPPED', label: 'Phá dỡ' },
]
export const CLASS_STATUS_OPTIONS = [
  { value: 'IN_CLASS', label: 'Còn class' },
  { value: 'SUSPENDED', label: 'Tạm dừng' },
  { value: 'WITHDRAWN', label: 'Rút đăng kiểm' },
  { value: 'UNCLASSED', label: 'Không đăng kiểm' },
]
export const DP_CLASS_OPTIONS = [
  { value: 'NONE', label: 'Không có' },
  { value: 'DP1', label: 'DP1' },
  { value: 'DP2', label: 'DP2' },
  { value: 'DP3', label: 'DP3' },
]
export const PARTNER_STATUS_OPTIONS = [
  { value: 1, label: 'Đang hợp tác' },
  { value: 0, label: 'Ngừng hợp tác' },
]

const labelOf = (options, value) => options.find((option) => option.value === value)?.label || null

export const filled = (value) => value !== undefined && value !== null && value !== ''

const num = (value, unit) => {
  if (!filled(value)) return null
  const text = Number(value).toLocaleString('vi-VN')
  return unit ? `${text} ${unit}` : text
}
const yesNo = (value) => (Number(value) === 1 ? 'Có' : 'Không')

// Chữ trong ô đầu tên đối tác: hai chữ đầu của hai từ đầu, viết hoa.
export function initialsOfName(name = '') {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]
  return letters.toUpperCase()
}

export function vesselSections(v, { linkOwner } = {}) {
  return [
    {
      key: 'id',
      title: 'Nhận dạng',
      fields: [
        ['Tên tàu', v.vessel_name, 6],
        ['Tên cũ', v.vessel_name_prev, 6],
        ['Số IMO', v.imo_number, 4, 'mono'],
        ['Call Sign', v.call_sign, 4],
        ['MMSI', v.mmsi, 4],
      ],
    },
    {
      key: 'reg',
      title: 'Đăng ký và phân loại',
      fields: [
        ['Loại tàu', v.vessel_type_name, 4],
        ['Cờ quốc gia', v.flag_name, 4],
        ['Năm đóng', v.year_built, 4],
        ['Cảng đăng ký', v.port_of_registry_name, 6],
        ['Tổ chức đăng kiểm', v.classification_society, 6],
        ['Trạng thái', labelOf(VESSEL_STATUS_OPTIONS, v.status), 6],
        ['Trạng thái đăng kiểm', labelOf(CLASS_STATUS_OPTIONS, v.class_status), 6],
      ],
    },
    {
      key: 'spec',
      title: 'Thông số',
      fields: [
        ['GRT', num(v.gross_tonnage, 'GT'), 4],
        ['NT', num(v.net_tonnage, 'NT'), 4],
        ['DWT', num(v.deadweight, 'tấn'), 4],
        ['LOA', num(v.length_overall, 'm'), 4],
        ['Sức chứa hành khách', num(v.passenger_capacity, 'người'), 4],
        ['Định biên thuyền viên', num(v.crew_capacity, 'người'), 4],
      ],
    },
    {
      key: 'eng',
      title: 'Máy và thiết bị',
      fields: [
        ['Công suất máy', num(v.engine_power_kw, 'kW'), 4],
        ['Loại động cơ', v.engine_type, 4],
        ['DP Class', labelOf(DP_CLASS_OPTIONS, v.dp_class), 4],
        ['Nồi hơi', yesNo(v.has_boiler), 6, 'always'],
        ['Lạnh (Refrigeration)', yesNo(v.has_refrigeration), 6, 'always'],
      ],
    },
    {
      key: 'mgmt',
      title: 'Quản lý',
      fields: [
        ['Chủ tàu', v.ship_owner_name ? (linkOwner ? linkOwner(v) : v.ship_owner_name) : null, 8],
        ['Quản lý kỹ thuật', v.technical_manager, 6],
        ['Quản lý thương mại', v.commercial_manager, 6],
      ],
    },
    { key: 'notes', title: 'Ghi chú', fields: [['Ghi chú', v.notes, 12]] },
  ]
}

// Các khối của màn chi tiết đối tác, cùng thứ tự và tên với form. Dạng dùng chung với màn thuyền viên (ReadSections):
// khối { key, title, fields | items, unit }; trường [nhãn, giá trị, độ rộng 12 cột]. `render` đổi chữ thành nút gọi / gửi mail / liên kết.
export function partnerSections(o, render = {}) {
  const phone = render.phone || ((v) => v)
  const mail = render.mail || ((v) => v)
  const link = render.link || ((v) => v)
  const chat = { whatsapp: (v) => v, line: (v) => v, wechat: (v) => v, ...render.chat }
  return [
    {
      key: 'company',
      title: 'Công ty',
      fields: [
        ['Tên công ty', o.company_name, 6],
        ['Tên tiếng Anh', o.company_name_en, 6],
        ['Mã số thuế', o.tax_id, 4],
        ['Quốc gia', o.country_name ? withFlag(o.country_code, o.country_name) : null, 4],
        ['Tình trạng', Number(o.is_active) === 1 ? 'Đang hợp tác' : 'Ngừng hợp tác', 4],
      ],
    },
    {
      key: 'contact',
      title: 'Liên hệ công ty',
      fields: [
        ['Địa chỉ', o.address, 12],
        ['Điện thoại', phone(o.phone), 4],
        ['Fax', o.fax, 4],
        ['Email', mail(o.email), 4],
        ['Website', link(o.website), 12],
      ],
    },
    {
      key: 'person',
      title: 'Người liên hệ',
      unit: 'người',
      itemsEmpty: 'Chưa có người liên hệ.',
      items: (o.contacts || []).map((c, i) => ({
        title: `Người liên hệ ${i + 1}`,
        tags: c.is_primary ? ['Liên hệ chính'] : [],
        fields: [
          ['Họ tên', c.name, 4],
          ['Chức vụ', c.position, 4],
          ['Điện thoại', phone(c.phone), 4],
          ['Email', mail(c.email), 12],
          ['WhatsApp', chat.whatsapp(c.whatsapp), 4],
          ['LINE', chat.line(c.line_id), 4],
          ['WeChat', chat.wechat(c.wechat_id), 4],
        ],
        actions: render.quick ? render.quick(c) : null,
      })),
    },
    {
      key: 'usage',
      title: 'Đang được dùng ở',
      fields: [
        ['Tàu thuộc đối tác', o.usage?.vessels ?? 0, 4],
        ['Chuyến tàu', o.usage?.voyages ?? 0, 4],
        ['Bộ giấy đã nộp', o.usage?.packs ?? 0, 4],
      ],
      footnote: 'Đối tác đang được dùng thì không xoá được, chỉ chuyển sang Ngừng hợp tác.',
    },
  ]
}

// Số trường đã điền / tổng của một khối. Không tính trường luôn có giá trị ('always') và trường suy ra từ trường khác ('skip').
export function countFilled(section) {
  const counted = section.fields.filter((field) => field[3] !== 'always' && field[4] !== 'skip')
  return { done: counted.filter((field) => filled(field[1])).length, total: counted.length }
}

// Cờ từ form (Switch) sang cột 0/1 của DB, và ngược lại.
export const flagToNumber = (value) => (value ? 1 : 0)
export const flagToBool = (value) => Number(value) === 1

const cleanText = (value) => {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  return trimmed || null
}

export const VESSEL_TEXT_FIELDS = ['vessel_name', 'vessel_name_prev', 'imo_number', 'call_sign', 'mmsi', 'classification_society', 'engine_type', 'technical_manager', 'commercial_manager', 'notes']
export const VESSEL_NUMBER_FIELDS = ['gross_tonnage', 'net_tonnage', 'deadweight', 'length_overall', 'engine_power_kw', 'passenger_capacity', 'crew_capacity', 'year_built']
export const VESSEL_LINK_FIELDS = ['vessel_type_id', 'flag_country_id', 'port_of_registry_id', 'ship_owner_id']
export const VESSEL_CHOICE_FIELDS = ['status', 'class_status', 'dp_class']

export function vesselToFormValues(vessel) {
  const values = { status: 'ACTIVE', has_boiler: false, has_refrigeration: false }
  if (!vessel) return values
  for (const key of [...VESSEL_TEXT_FIELDS, ...VESSEL_LINK_FIELDS, ...VESSEL_CHOICE_FIELDS]) values[key] = vessel[key] ?? null
  for (const key of VESSEL_NUMBER_FIELDS) values[key] = filled(vessel[key]) ? Number(vessel[key]) : null
  values.has_boiler = flagToBool(vessel.has_boiler)
  values.has_refrigeration = flagToBool(vessel.has_refrigeration)
  return values
}

export function vesselToPayload(values) {
  const payload = {}
  for (const key of VESSEL_TEXT_FIELDS) payload[key] = cleanText(values[key])
  for (const key of VESSEL_NUMBER_FIELDS) payload[key] = filled(values[key]) ? Number(values[key]) : null
  for (const key of [...VESSEL_LINK_FIELDS, 'class_status', 'dp_class']) payload[key] = filled(values[key]) ? values[key] : null
  payload.status = values.status || 'ACTIVE'
  payload.has_boiler = flagToNumber(values.has_boiler)
  payload.has_refrigeration = flagToNumber(values.has_refrigeration)
  return payload
}

export const PARTNER_TEXT_FIELDS = ['company_name', 'company_name_en', 'tax_id', 'address', 'phone', 'fax', 'email', 'website', 'notes']
export const EMPTY_CONTACT = { name: '', position: '', phone: '', email: '', whatsapp: '', line_id: '', wechat_id: '', is_primary: false }

export function partnerToFormValues(owner) {
  const values = { is_active: 1, contacts: [] }
  if (!owner) return values
  for (const key of PARTNER_TEXT_FIELDS) values[key] = owner[key] ?? null
  values.country_id = owner.country_id ?? null
  values.contacts = (owner.contacts || []).map((c) => ({ name: c.name, position: c.position ?? '', phone: c.phone ?? '', email: c.email ?? '', whatsapp: c.whatsapp ?? '', line_id: c.line_id ?? '', wechat_id: c.wechat_id ?? '', is_primary: !!c.is_primary }))
  values.is_active = Number(owner.is_active) === 0 ? 0 : 1
  return values
}

// Bỏ dòng trống, cắt khoảng trắng, đúng một liên hệ chính (mặc định người đầu tiên).
export function cleanContactList(list) {
  const rows = (list || [])
    .map((c) => ({ name: cleanText(c?.name), position: cleanText(c?.position), phone: cleanText(c?.phone), email: cleanText(c?.email), whatsapp: cleanText(c?.whatsapp), line_id: cleanText(c?.line_id), wechat_id: cleanText(c?.wechat_id), is_primary: !!c?.is_primary }))
    .filter((c) => c.name || c.position || c.phone || c.email || c.whatsapp || c.line_id || c.wechat_id)
  const primary = rows.findIndex((c) => c.is_primary)
  return rows.map((c, index) => ({ ...c, is_primary: index === (primary === -1 ? 0 : primary) }))
}

export function partnerToPayload(values) {
  const payload = {}
  for (const key of PARTNER_TEXT_FIELDS) payload[key] = cleanText(values[key])
  payload.country_id = filled(values.country_id) ? values.country_id : null
  payload.is_active = values.is_active === 0 ? 0 : 1
  payload.contacts = cleanContactList(values.contacts)
  return payload
}

// Các khóa form đã đổi so với giá trị gốc (so sánh sau khi chuẩn hoá về payload).
export function changedKeys(initial, current, toPayload) {
  const before = toPayload(initial)
  const after = toPayload(current)
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}
