// Hàm thuần cho cơ hội và chuyến: không đọc DB, không đọc giờ máy ("hôm nay" truyền vào).
const { parseDate, addMonths, monthsBetween, round2 } = require('./voyage_math')
const { SEAFARER_COLUMN_DOCS, DEADLINE_WARN_DAYS, LEAVE_WARN_DAYS } = require('../constants/opportunity_voyage')

const DAY_MS = 86400000
const iso = (value) => (value == null ? null : String(value instanceof Date ? value.toISOString() : value).slice(0, 10))
const ms = (value) => { const d = parseDate(value); return Date.UTC(d.y, d.m, d.d) }
const daysFrom = (from, to) => Math.round((ms(to) - ms(from)) / DAY_MS)
const isoOfMs = (t) => new Date(t).toISOString().slice(0, 10)

// Trạng thái hiển thị của cơ hội (mục 1.2). candidates: [{ status, owner_selected_at, last_sent_at }].
function displayStatus({ status, candidates = [] }) {
  if (status !== 'OPEN') return status
  const live = candidates.filter((c) => c.status !== 'REMOVED')
  if (!live.length) return 'NEW'
  if (live.some((c) => c.owner_selected_at)) return 'OWNER_SELECTED'
  if (live.some((c) => c.last_sent_at)) return 'WAITING'
  return 'PICKING'
}

// Cảnh báo hạn chốt, chỉ khi OPEN: { kind: 'SOON' | 'LATE', days } hoặc null.
function deadlineFlag({ status, deadline, today }) {
  if (status !== 'OPEN' || !deadline) return null
  const days = daysFrom(today, deadline)
  if (days < 0) return { kind: 'LATE', days: -days }
  if (days <= DEADLINE_WARN_DAYS) return { kind: 'SOON', days }
  return null
}

// Cảnh báo ngày rời của chuyến đang trên tàu: còn 0–30 ngày (SOON) hoặc đã qua mà chưa ghi rời (LATE).
function leaveFlag({ status, planned_leave_date: planned, today }) {
  if (status !== 'ONBOARD' || !planned) return null
  const days = daysFrom(today, planned)
  if (days < 0) return { kind: 'LATE', days: -days }
  if (days <= LEAVE_WARN_DAYS) return { kind: 'SOON', days }
  return null
}

// Ngày giấy phải còn hạn tới, theo valid_until; ANY → null (có là được).
function neededUntil(req, { join, leave }) {
  if (req.valid_until === 'JOIN') return iso(join)
  if (req.valid_until === 'LEAVE') return iso(leave)
  if (req.valid_until === 'LEAVE_PLUS') return isoOfMs(addMonths(parseDate(leave), Number(req.plus_months) || 0))
  return null
}

// Một giấy đã có: hết hạn trước ngày cần thì expires_early, không có ngày hết hạn coi như còn hạn.
function docState(expiry, needed) {
  if (!needed || !expiry) return { state: 'ok', expiry: iso(expiry) }
  return { state: iso(expiry) >= needed ? 'ok' : 'expires_early', expiry: iso(expiry) }
}

function certificateState(req, { seafarer, certificates }, needed) {
  const column = req.certificate_code && SEAFARER_COLUMN_DOCS[req.certificate_code]
  if (column) {
    const number = seafarer?.[column.number]
    if (!number || !String(number).trim()) return { state: 'missing', expiry: null }
    return docState(seafarer[column.expiry], needed)
  }
  const owned = certificates.filter((c) => c.certificate_type_id === req.certificate_type_id && c.status !== 'REVOKED')
  if (!owned.length) return { state: 'missing', expiry: null }
  if (owned.some((c) => Number(c.no_expiry) === 1 || !c.expiry_date)) return { state: 'ok', expiry: null }
  // Lấy giấy còn hạn xa nhất.
  const latest = owned.map((c) => iso(c.expiry_date)).sort().at(-1)
  return docState(latest, needed)
}

function experienceState(req, experience) {
  if (req.rank_id) {
    const months = experience.rankMonths?.[req.rank_id] || 0
    return { state: months >= Number(req.min_months) ? 'ok' : 'missing', value: months }
  }
  const trips = experience.vesselTypeTrips?.[req.vessel_type_id] || 0
  return { state: trips >= Number(req.min_trips) ? 'ok' : 'missing', value: trips }
}

// Đối chiếu một thuyền viên với hồ sơ yêu cầu (mục 1.6). Bỏ qua yêu cầu TEMPLATE.
// requirements: dòng opportunity_requirement kèm certificate_code; dates: { join, leave } của cơ hội.
function requirementFit({ seafarer = {}, certificates = [], experience = {}, requirements = [], dates }) {
  const items = requirements
    .filter((r) => r.kind !== 'TEMPLATE')
    .map((req) => {
      const needed = req.kind === 'CERTIFICATE' ? neededUntil(req, dates) : null
      const result = req.kind === 'CERTIFICATE' ? certificateState(req, { seafarer, certificates }, needed) : experienceState(req, experience)
      return { requirement_id: req.id, kind: req.kind, level: req.level, needed_until: needed, ...result }
    })
  const tally = (level) => {
    const rows = items.filter((i) => i.level === level)
    return { ok: rows.filter((i) => i.state === 'ok').length, total: rows.length }
  }
  return { items, required: tally('REQUIRED'), preferred: tally('PREFERRED') }
}

// Tổng tháng theo chức danh và số chuyến theo loại tàu từ lịch sử đi tàu.
// rows: [{ rank_id, vessel_type_id, start, end }] (end null = đang trên tàu, tính tới hôm nay).
function experienceFromHistory(rows = [], today) {
  const rankMonths = {}
  const vesselTypeTrips = {}
  for (const row of rows) {
    if (!row.start) continue
    const end = iso(row.end) || iso(today)
    if (end < iso(row.start)) continue
    if (row.rank_id) rankMonths[row.rank_id] = round2((rankMonths[row.rank_id] || 0) + monthsBetween(iso(row.start), end))
    if (row.vessel_type_id) vesselTypeTrips[row.vessel_type_id] = (vesselTypeTrips[row.vessel_type_id] || 0) + 1
  }
  return { rankMonths, vesselTypeTrips }
}

// Thứ tự đề xuất (mục 1.7): đủ bắt buộc trước, nhiều mục nên có hơn, rồi ngày rảnh gần ngày xuống hơn.
// a, b: { fit, free_from (null = rảnh ngay), today, join }.
function compareSuggestions(a, b) {
  const full = (x) => (x.fit.required.ok === x.fit.required.total ? 1 : 0)
  if (full(a) !== full(b)) return full(b) - full(a)
  if (a.fit.required.ok !== b.fit.required.ok) return b.fit.required.ok - a.fit.required.ok
  if (a.fit.preferred.ok !== b.fit.preferred.ok) return b.fit.preferred.ok - a.fit.preferred.ok
  const gap = (x) => Math.abs(daysFrom(x.free_from || x.today, x.join))
  return gap(a) - gap(b)
}

// Chuyến giao với [from, to]: lên trước hoặc đúng `to`, rời (thực tế, không có thì dự kiến) từ `from` trở đi.
function overlapsRange(voyage, from, to) {
  const end = iso(voyage.leave_date) || iso(voyage.planned_leave_date)
  return iso(voyage.join_date) <= iso(to) && end >= iso(from)
}

module.exports = {
  displayStatus,
  deadlineFlag,
  leaveFlag,
  neededUntil,
  requirementFit,
  experienceFromHistory,
  compareSuggestions,
  overlapsRange,
  daysFrom,
}
