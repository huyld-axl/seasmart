import dayjs from 'dayjs'
import { isValidImo } from '../../../utils/imo'

// Nhóm B: đối chiếu tàu, kiểm tra sẵn sàng, bộ giấy 12 mẫu theo giai đoạn.

// ---------- Đối chiếu tàu (B1) ----------
const norm = (text) => String(text || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/^(mv|m\/v|tau)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
// Số viết trên giấy kiểu Việt: dấu chấm ngăn nghìn, dấu phẩy thập phân ("4.120" = 4120).
const paperNumber = (text) => Number(String(text || '').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || null
const FLAG_ALIASES = { vn: 'viet nam', vietnam: 'viet nam' }
const flag = (text) => FLAG_ALIASES[norm(text).replace(/\s/g, '')] || norm(text)

// So một ô: true khớp, 'near' gần giống, false khác, null khi giấy không ghi.
export function matchName(paper, vessel) {
  const a = norm(paper); const b = norm(vessel)
  if (!a) return null
  if (a === b) return true
  return b.includes(a) || a.includes(b) ? 'near' : false
}

export function matchVessel(paper, vessel) {
  const gtPaper = paperNumber(paper.gt)
  const gtVessel = Number(vessel.gross_tonnage) || null // số DECIMAL từ API
  return {
    name: matchName(paper.name, vessel.vessel_name),
    imo: paper.imo ? String(paper.imo) === String(vessel.imo_number) : null,
    gt: gtPaper ? (gtVessel ? Math.abs(gtPaper - gtVessel) <= 1 : false) : null,
    flag: paper.flag ? flag(paper.flag) === flag(vessel.flag_name) : null,
    owner: paper.owner ? matchName(paper.owner, vessel.ship_owner_name) : null,
  }
}

// Xếp ứng viên: IMO khớp trước, rồi nhiều ô khớp hơn.
export function rankCandidates(paper, vessels) {
  const score = (m) => (m.imo === true ? 100 : 0) + Object.values(m).filter((v) => v === true).length * 10 + Object.values(m).filter((v) => v === 'near').length
  return vessels
    .map((vessel) => ({ vessel, match: matchVessel(paper, vessel) }))
    .sort((a, b) => score(b.match) - score(a.match))
}

// IMO trên giấy: 'none' không ghi, 'invalid' sai số kiểm tra, 'ok'.
export function paperImoState(imo) {
  if (!imo) return 'none'
  return isValidImo(imo) ? 'ok' : 'invalid'
}

// ---------- Kiểm tra sẵn sàng xuất (B2) ----------
const KEY_FIELDS = [
  ['full_name', 'Họ tên'], ['date_of_birth', 'Ngày sinh'], ['nationality_id', 'Quốc tịch'],
  ['national_id', 'CCCD'], ['current_rank_id', 'Chức danh'], ['seaman_book_number', 'Số sổ thuyền viên'],
]

// Hai khoảng thời gian đi tàu chồng nhau (ngày rời tàu trống coi như đến hôm nay).
export function overlappingContracts(contracts = [], today = dayjs()) {
  const spans = contracts
    .filter((c) => c.start_date && !c.deleted_at)
    .map((c) => ({ c, start: dayjs(c.start_date), end: dayjs(c.actual_end_date || c.end_date || today) }))
    .sort((a, b) => a.start.valueOf() - b.start.valueOf())
  const pairs = []
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i].start.isBefore(spans[i - 1].end, 'day')) pairs.push([spans[i - 1].c, spans[i].c])
  }
  return pairs
}

// Mỗi điều kiện: { title, result: PASS | FAIL | UNKNOWN, reason, action }
export function readinessRules({ seafarer, certificates = [], contracts = [], pendingReview = 0, today = dayjs() }) {
  const missing = KEY_FIELDS.filter(([key]) => !seafarer?.[key]).map(([, label]) => label)
  const overlaps = overlappingContracts(contracts, today)
  const expired = [
    ['Hộ chiếu', seafarer?.passport_expiry],
    ['Sổ thuyền viên', seafarer?.seaman_book_expiry],
    ['Giấy khám sức khỏe', seafarer?.medical_cert_expiry],
    ...certificates.filter((c) => c.status !== 'REVOKED').map((c) => [c.certificate_type_name || 'Chứng chỉ', c.expiry_date]),
  ].filter(([, date]) => date && dayjs(date).isBefore(today, 'day'))
  return [
    {
      title: `Thông tin cá nhân đủ ${KEY_FIELDS.length} trường trọng yếu`,
      result: missing.length ? 'FAIL' : 'PASS',
      reason: missing.length ? `Còn thiếu: ${missing.join(', ')}` : null,
      action: missing.length ? 'edit' : null,
    },
    {
      title: 'Thời gian đi tàu không trùng nhau',
      result: overlaps.length ? 'FAIL' : 'PASS',
      reason: overlaps.length ? `${overlaps.length} cặp hợp đồng chồng thời gian` : null,
      action: overlaps.length ? 'service' : null,
    },
    {
      title: 'Giấy tờ AI đọc đã duyệt hết',
      result: pendingReview ? 'UNKNOWN' : 'PASS',
      reason: pendingReview ? `${pendingReview} giấy tờ chờ duyệt` : null,
      action: pendingReview ? 'review' : null,
    },
    {
      title: 'Giấy tờ bắt buộc còn hạn',
      result: expired.length ? 'FAIL' : 'PASS',
      reason: expired.length ? expired.map(([name, date]) => `${name} hết hạn ${dayjs(date).format('DD/MM/YYYY')}`).join(' · ') : null,
      action: expired.length ? 'upload' : null,
    },
  ]
}

export function readinessLevel(rules) {
  if (rules.some((rule) => rule.result === 'FAIL')) return 'BLOCKED'
  if (rules.some((rule) => rule.result === 'UNKNOWN')) return 'NEEDS_REVIEW'
  return 'READY_IN_SCOPE'
}

// ---------- Bộ giấy 12 mẫu (B3, B4) ----------
export const STAGES = [
  { key: 'tuyen', label: 'Tuyển dụng' },
  { key: 'di-tau', label: 'Lên tàu' },
  { key: 'roi-tau', label: 'Rời tàu' },
]

// signers: người ký; needs: trường hồ sơ mẫu cần; inputs: ô điền lúc xuất; group: nhóm chọn một.
// Giữ khớp với backend/src/constants/pack_templates.js.
const d = (key, name, stage, signers, needs, inputs, group = null) => ({ key, name, stage, signers, needs, inputs, group })
export const TEMPLATES = [
  d('kq', 'Kết quả thi tuyển', 'tuyen', ['Giám khảo 1', 'Giám khảo 2', 'Giám đốc'], [], ['Điểm từng tiêu chuẩn']),
  d('tb', 'Thông báo trúng tuyển', 'tuyen', ['Giám đốc'], [], ['Ngày có mặt']),
  d('cv', 'CV chủ tàu Trung Quốc', 'tuyen', [], ['Cỡ giày', 'Nhóm máu', 'Người thân liên hệ'], []),
  d('pt', 'Phiếu thu', 'tuyen', ['Người nộp tiền', 'Thủ quỹ', 'Kế toán trưởng'], [], ['Số tiền', 'Lý do thu']),
  d('qddd', 'Quyết định điều động', 'di-tau', ['Giám đốc'], [], ['Tên tàu', 'Ngày xuống tàu']),
  d('bhxh', 'Đơn tham gia BHXH', 'di-tau', ['Thuyền viên'], [], ['Mức đóng'], 'bhxh'),
  d('kbhxh', 'Đơn không tham gia BHXH', 'di-tau', ['Thuyền viên'], [], [], 'bhxh'),
  d('bl', 'Thư bảo lãnh', 'di-tau', ['Giám đốc'], ['Người bảo lãnh'], []),
  d('uqcn', 'Ủy quyền cá nhân', 'di-tau', ['Thuyền viên'], [], ['Người được ủy quyền']),
  d('uql', 'Ủy quyền nhận lương', 'di-tau', ['Thuyền viên'], ['Số tài khoản'], ['Người nhận lương']),
  d('qdrt', 'Quyết định rời tàu', 'roi-tau', ['Giám đốc'], [], ['Ngày rời tàu', 'Cảng rời tàu']),
  d('tl', 'Thanh lý hợp đồng', 'roi-tau', ['Thuyền viên', 'Giám đốc'], [], ['Ngày thanh lý']),
]
export const template = (key) => TEMPLATES.find((t) => t.key === key)

// Chọn nhanh theo giai đoạn; hai đơn BHXH chỉ lấy đơn tham gia.
export function stagePick(stageKey) {
  return TEMPLATES.filter((t) => t.stage === stageKey && t.key !== 'kbhxh').map((t) => t.key)
}

// Bật/tắt một giấy; bật một đơn BHXH thì bỏ đơn còn lại.
export function toggleTemplate(selected, key) {
  if (selected.includes(key)) return selected.filter((k) => k !== key)
  const group = template(key)?.group
  const kept = group ? selected.filter((k) => template(k)?.group !== group) : selected
  return TEMPLATES.map((t) => t.key).filter((k) => kept.includes(k) || k === key)
}

export function packInputs(selected) {
  return [...new Set(selected.flatMap((key) => template(key).inputs))]
}

// Trường hồ sơ mà mẫu cần → cách kiểm trên hồ sơ thật (seafarer + danh sách người liên hệ).
export const PROFILE_NEEDS = {
  'Cỡ giày': (s) => !!s?.shoe_size,
  'Nhóm máu': (s) => !!s?.blood_type,
  'Người thân liên hệ': (s, contacts) => contacts.some((c) => !c.is_guarantor),
  'Người bảo lãnh': (s, contacts) => contacts.some((c) => c.is_guarantor),
  'Số tài khoản': (s) => !!s?.bank_account_number,
}

// Trường còn thiếu trên hồ sơ cho các giấy đã chọn.
export function packMissing(selected, seafarer, contacts = []) {
  return selected.flatMap((key) => template(key).needs
    .filter((field) => !PROFILE_NEEDS[field]?.(seafarer, contacts))
    .map((field) => ({ field, doc: template(key).name })))
}

// Chữ ký cần trong cả bộ: [{ doc, who }]
export function packSignatures(selected) {
  return selected.flatMap((key) => template(key).signers.map((who) => ({ doc: key, who })))
}
