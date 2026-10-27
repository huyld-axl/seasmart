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
