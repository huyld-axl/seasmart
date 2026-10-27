// Hàm thuần của danh sách chuyến mới (mỗi chuyến một thuyền viên): nhãn lệch ngày lên, nhãn rời tàu, nguồn.
import dayjs from 'dayjs'
import { MANUAL_REASON_LABELS } from '../../../constants/opportunityVoyage'

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
  if (row.status === 'LEFT') return { date: row.leave_date, sub: row.leave_port_name || '—' }
  const moved = row.original_leave_date && row.original_leave_date !== row.planned_leave_date
  return { date: row.planned_leave_date, sub: moved ? `đã dời từ ${formatDate(row.original_leave_date)}` : 'dự kiến' }
}

// Nguồn: mã cơ hội, hoặc "Tạo tay · {lý do}".
export function sourceText(row) {
  if (row.source === 'OPPORTUNITY') return row.opportunity_code || 'Từ cơ hội'
  return row.manual_reason ? `Tạo tay · ${MANUAL_REASON_LABELS[row.manual_reason] || row.manual_reason}` : 'Tạo tay'
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
    manual_reason: MANUAL_REASON_LABELS[reason] ? reason : undefined,
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
