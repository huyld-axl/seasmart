// Hàm thuần của danh sách chuyến mới (mỗi chuyến một thuyền viên): nhãn lệch ngày lên, nhãn rời tàu, nguồn.
import dayjs from 'dayjs'
import { formatCalendarDuration } from '../../../utils/format'
import { MANUAL_REASONS, MANUAL_REASON_LABELS } from '../../../constants/opportunityVoyage'

// Khoảng "Trên tàu trong" mặc định: tháng này.
export const thisMonth = () => [dayjs().startOf('month'), dayjs().endOf('month')]

// Lên tàu so với ngày xuống dự kiến của cơ hội. 0 hoặc không có cơ hội thì không có nhãn.
export function joinDeltaLabel(days) {
  if (!days) return null
  return days > 0 ? `muộn ${days} ngày` : `sớm ${-days} ngày`
}

// Nhãn cảnh báo rời tàu từ `leave_flag` của API: { kind: 'SOON' | 'LATE', days } hoặc null.
export function leaveFlagLabel(flag) {
  if (!flag) return null
  if (flag.kind === 'LATE') return { tone: 'error', text: `Quá ${flag.days} ngày chưa rời` }
  return { tone: 'warning', text: flag.days === 0 ? 'Rời hôm nay' : `Còn ${flag.days} ngày` }
}

// Ô Rời tàu: ngày chính và dòng phụ ("dự kiến" / "đã dời từ {ngày}" / nơi thực tế).
export function leaveCell(row, formatDate) {
  if (row.leave_date) return { date: row.leave_date, sub: row.leave_port_name || '—' }
  const moved = row.original_leave_date && row.original_leave_date !== row.planned_leave_date
  return { date: row.planned_leave_date, sub: moved ? `đã dời từ ${formatDate(row.original_leave_date)}` : 'dự kiến' }
}

// Ô Rời tàu của thẻ danh sách (điện thoại): đã rời thì "Rời tàu" + ngày + nơi; chưa thì "Rời tàu dự kiến" + ngày (+ "đã dời từ").
export function leaveField(row, formatDate) {
  if (row.leave_date) return { label: 'Rời tàu', value: [formatDate(row.leave_date), row.leave_port_name].filter(Boolean).join(' · ') }
  const moved = row.original_leave_date && row.original_leave_date !== row.planned_leave_date
  const date = formatDate(row.planned_leave_date)
  return { label: 'Rời tàu dự kiến', value: moved ? `${date} · dời từ ${formatDate(row.original_leave_date)}` : date }
}

// Dải cảnh báo rời tàu trên thẻ: từ leave_flag, đỏ khi quá hạn, cam khi sắp tới.
export function leaveAlert(flag) {
  const label = leaveFlagLabel(flag)
  return label ? { text: label.text, tone: label.tone === 'error' ? 'err' : 'warn' } : null
}

// Nguồn: mã cơ hội, hoặc "Tạo tay" (lý do xem ở trang chi tiết).
export function sourceText(row) {
  if (row.source === 'OPPORTUNITY') return row.opportunity_code || 'Từ cơ hội'
  return 'Tạo tay'
}

// Nhãn sớm / muộn của ngày rời so với dự kiến, hiện dưới ô ngày trong hộp Ghi rời tàu.
export function leaveHint(leaveDate, plannedLeave) {
  if (!leaveDate || !plannedLeave) return null
  const days = dayjs(leaveDate).startOf('day').diff(dayjs(plannedLeave).startOf('day'), 'day')
  if (!days) return 'Đúng ngày rời dự kiến'
  return days < 0 ? `Sớm ${-days} ngày so với dự kiến` : `Muộn ${days} ngày so với dự kiến`
}

// ---------- Form Tạo chuyến ----------
const API_DATE = 'YYYY-MM-DD'
const day = (value) => (value ? dayjs(value).format(API_DATE) : undefined)

// Điền sẵn từ đường dẫn: ?seafarer=&vessel=&owner=&rank=&reason=.
export function voyagePrefill(params) {
  const num = (key) => (params.get(key) ? Number(params.get(key)) : undefined)
  const reason = params.get('reason')
  return Object.fromEntries(Object.entries({
    seafarer_id: num('seafarer'),
    vessel_id: num('vessel'),
    ship_owner_id: num('owner'),
    rank_id: num('rank'),
    manual_reason: MANUAL_REASONS.includes(reason) ? reason : undefined,
    ended: false,
  }).filter(([, v]) => v !== undefined))
}

// Giá trị form -> body POST /voyages. Ngày rời thực tế chỉ gửi khi bật "Chuyến đã kết thúc".
export function toVoyagePayload(values) {
  const ended = !!values.ended
  const body = {
    seafarer_id: values.seafarer_id,
    rank_id: values.rank_id,
    vessel_id: values.vessel_id,
    ship_owner_id: values.ship_owner_id,
    manual_reason: values.manual_reason,
    budget_monthly_usd: values.budget_monthly_usd ?? null,
    join_date: day(values.join_date),
    join_port_id: values.join_port_id,
    planned_leave_date: day(values.planned_leave_date),
    planned_leave_port_id: values.planned_leave_port_id || null,
    notes: values.notes?.trim() || null,
    ended,
  }
  if (ended) Object.assign(body, { leave_date: day(values.leave_date), leave_port_id: values.leave_port_id, leave_note: values.leave_note?.trim() || null })
  return body
}

// "Lưu & tạo chuyến khác": giữ tàu, chủ tàu, ngày, nơi, lý do; bỏ người, chức danh, budget, ghi chú.
export function nextVoyageValues(_, saved) {
  const keep = ['vessel_id', 'ship_owner_id', 'manual_reason', 'join_date', 'join_port_id', 'planned_leave_date', 'planned_leave_port_id', 'ended', 'leave_date', 'leave_port_id']
  return Object.fromEntries(keep.filter((key) => saved[key] !== undefined).map((key) => [key, saved[key]]))
}

// ---------- Chi tiết chuyến ----------
// Có đủ hai mốc thì hiển thị tháng lịch/ngày; nếu chỉ có số ngày lệch thì giữ số ngày chính xác.
export function deltaText(days, from, to) {
  if (!days) return null
  const n = Math.abs(days)
  const dates = from && to ? [from, to].sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf()) : []
  const amount = formatCalendarDuration(dates[0], dates[1]) || `${n} ngày`
  return days > 0 ? `muộn ${amount}` : `sớm ${amount}`
}

// Thời gian còn lại theo tháng lịch/ngày; thiếu ngày, ngày sai hoặc đã qua thì null.
export function timeLeft(planned, today = dayjs()) {
  return formatCalendarDuration(today, planned) || null
}

const HISTORY = {
  PLACE: { kind: 'accept', tone: 'success', title: 'Chốt người, ghi lên tàu' },
  CREATE: { kind: 'edit', tone: 'success', title: 'Tạo chuyến' },
  MIGRATE: { kind: 'upload', tone: 'neutral', title: 'Chuyển từ dữ liệu chuyến cũ' },
  LEAVE: { kind: 'export', tone: 'neutral', title: 'Ghi rời tàu' },
  TRANSFER_OUT: { kind: 'export', tone: 'neutral', title: 'Rời tàu do chuyển tàu' }, // chuyến cũ (giai đoạn 1)
  LEAVE_PLAN: { kind: 'edit', tone: 'warning', title: 'Đổi ngày rời dự kiến' },
  EDIT_DATES: { kind: 'edit', tone: 'warning', title: 'Sửa ngày đã ghi' },
  DELETE: { kind: 'reject', tone: 'error', title: 'Huỷ chốt / xoá chuyến' },
}

// Lịch sử chuyến (mục 4.7) -> item của AuditTimeline. portName(id) đổi id cảng ra tên.
export function historyItems(history, { formatDate, portName = () => null }) {
  const at = (date, port) => [formatDate(date), portName(port)].filter(Boolean).join(' · ')
  return (history || []).map((h) => {
    const p = typeof h.payload === 'string' ? JSON.parse(h.payload) : h.payload || {}
    const base = HISTORY[h.action] || { kind: 'edit', tone: 'neutral', title: h.action }
    const item = { id: h.id, kind: base.kind, tone: base.tone, title: base.title, time: dayjs(h.created_at).format('HH:mm DD/MM/YYYY'), actor: h.actor_email || null }
    if (h.action === 'PLACE') item.after = at(p.join_date, p.join_port_id)
    if (h.action === 'CREATE' && p.manual_reason) item.title = `Tạo chuyến · ${MANUAL_REASON_LABELS[p.manual_reason] || p.manual_reason}`
    if (h.action === 'LEAVE' || h.action === 'TRANSFER_OUT') item.after = at(p.leave_date, p.leave_port_id)
    if (h.action === 'LEAVE_PLAN') Object.assign(item, { before: formatDate(p.from), after: formatDate(p.to) })
    if (h.action === 'EDIT_DATES' && p.before && p.after) {
      const show = (v) => [at(v.join_date, v.join_port_id), v.leave_date ? `rời ${at(v.leave_date, v.leave_port_id)}` : null].filter(Boolean).join(' · ')
      Object.assign(item, { before: `lên ${show(p.before)}`, after: `lên ${show(p.after)}` })
    }
    if (p.note) item.reason = p.note
    return item
  })
}

// ---------- Thẻ Đội ngũ trên trang tàu ----------
// Khoảng xem: Hôm nay · 6 tháng tới · Cả năm (tính từ hôm nay). Tuỳ chọn thì lấy từ RangePicker.
export function crewRange(key, today = dayjs()) {
  const t = dayjs(today).startOf('day')
  if (key === 'today') return [t, t]
  if (key === 'half') return [t, t.add(6, 'month')]
  if (key === 'year') return [t.startOf('year'), t.endOf('year').startOf('day')]
  return null
}

const iso = (v) => (v ? String(v).slice(0, 10) : null)

// Hàng cho CrewTimeline: mỗi chuyến một hàng, rồi các cơ hội đang mở (nhạt). Biểu đồ cần ít nhất vài ngày nên
// khoảng "Hôm nay" được nới ra ±1 tháng ở trang gọi.
export function crewRows({ voyages = [], openings = [], today, formatDate, onVoyage, onOpening }) {
  const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)
  const rows = voyages.map((v) => {
    const original = iso(v.original_leave_date) || iso(v.planned_leave_date)
    const planned = iso(v.planned_leave_date)
    const join = iso(v.join_date)
    const joinLine = `Lên tàu ${formatDate(join)}${v.join_port_name ? ` tại ${v.join_port_name}` : ''}`
    const bars = [{ kind: 'planned', start: join, end: original, label: `rời ${formatDate(original)}`, tip: `Dự kiến rời ban đầu ${formatDate(original)}` }]
    let subtitle = `${v.rank_name} · ${v.code}`
    let warn = false
    if (v.leave_date) {
      const delta = deltaText(v.leave_delta_days, v.planned_leave_date, v.leave_date)
      bars.push({
        kind: 'left', start: join, end: iso(v.leave_date),
        label: [v.leave_port_name, delta].filter(Boolean).join(' · '),
        tip: [joinLine, `Rời tàu ${formatDate(v.leave_date)}${v.leave_port_name ? ` tại ${v.leave_port_name}` : ''}`, delta].filter(Boolean).join('\n'),
      })
    } else {
      const delta = deltaText(v.join_delta_days, v.opportunity?.planned_join_date, v.join_date)
      bars.push({
        kind: 'onboard', start: join, end: today,
        label: [v.join_port_name, delta].filter(Boolean).join(' · '),
        tip: [joinLine, delta, `Dự kiến rời ${formatDate(planned)}`].filter(Boolean).join('\n'),
      })
      if (planned !== original) {
        const [a, b] = [original, planned].sort()
        bars.push({ kind: 'moved', start: a, end: b, label: `dời tới ${formatDate(planned)}`, tip: `Ngày rời dời từ ${formatDate(original)} tới ${formatDate(planned)}` })
      }
      // Đã quá ngày rời dự kiến mà chuyến vẫn đang trên tàu: tô cảnh báo từ ngày đó tới hôm nay.
      if (planned && today && planned < today) {
        const late = dayDiff(today, planned)
        bars.push({ kind: 'overdue', start: planned, end: today, label: `quá ${late} ngày`, tip: `Dự kiến rời ${formatDate(planned)}, quá ${late} ngày mà chưa ghi rời tàu` })
        subtitle += ` · quá hạn rời ${late} ngày`
        warn = true
      }
    }
    return { id: `v${v.id}`, title: v.seafarer_name, subtitle, warn, onClick: onVoyage ? () => onVoyage(v) : undefined, bars }
  })
  const opens = openings.map((o) => {
    const join = iso(o.planned_join_date)
    // Cơ hội còn mở mà ngày lên dự kiến đã qua: chưa chốt kịp.
    const late = join && today && join < today ? dayDiff(today, join) : 0
    const chosen = o.selected_name ? ` · chủ tàu đã chọn ${o.selected_name}` : ''
    return {
      id: `o${o.id}`,
      title: o.code,
      subtitle: `${o.rank_name} · cơ hội, chưa chốt${late ? ` · quá ngày lên ${late} ngày` : ''}`,
      warn: late > 0,
      onClick: onOpening ? () => onOpening(o) : undefined,
      bars: [{
        kind: 'opening',
        start: join,
        end: iso(o.planned_leave_date),
        label: `Dự kiến lên ${formatDate(o.planned_join_date)}${chosen}`,
        tip: [`Dự kiến lên ${formatDate(o.planned_join_date)}`, `Dự kiến rời ${formatDate(o.planned_leave_date)}`, o.selected_name ? `Chủ tàu đã chọn ${o.selected_name}` : null, late ? `Đã quá ngày lên dự kiến ${late} ngày` : null].filter(Boolean).join('\n'),
      }],
    }
  })
  return [...rows, ...opens]
}
