// Hàm thuần cho các màn cơ hội.

// Nhãn hạn chốt từ deadline_flag của API: { kind: 'SOON' | 'LATE', days } hoặc null.
export function deadlineLabel(flag) {
  if (!flag) return null
  if (flag.kind === 'LATE') return { tone: 'error', text: `quá ${flag.days} ngày` }
  return { tone: 'warning', text: flag.days === 0 ? 'hôm nay' : `còn ${flag.days} ngày` }
}

// Dòng tóm tắt cột Ứng viên của danh sách cơ hội.
export function candidateSummary(row, formatDate) {
  if (row.placed_name) return { main: row.placed_name, sub: row.voyage_code ? `chuyến ${row.voyage_code}` : 'đã chốt' }
  if (row.selected_name) return { main: row.selected_name, sub: `chủ tàu đã chọn${row.selected_at ? ` ${formatDate(row.selected_at)}` : ''} · ${row.candidates_count} ứng viên` }
  if (!row.candidates_count) return { main: 'Chưa có', sub: null, muted: true }
  const sent = row.sent_count ? `${row.sent_count} đã gửi ${formatDate(row.last_sent_at)}` : 'chưa gửi'
  return { main: `${row.candidates_count} ứng viên`, sub: sent }
}
