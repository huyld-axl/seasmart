// Định dạng ngày và tiền dùng chung. Ngày hiện DD/MM/YYYY (API gửi YYYY-MM-DD); tiền USD kiểu Việt Nam 1.150,00.
import dayjs from 'dayjs'

// Thời hạn để hiển thị, tách biệt với số tháng quy đổi dùng tính tiền.
export function formatCalendarDuration(start, end) {
  if (!start || !end) return ''
  const a = dayjs(start).startOf('day')
  const b = dayjs(end).startOf('day')
  if (!a.isValid() || !b.isValid() || b.isBefore(a)) return ''
  let months = (b.year() - a.year()) * 12 + b.month() - a.month()
  while (months > 0 && a.add(months, 'month').isAfter(b)) months -= 1
  const days = b.diff(a.add(months, 'month'), 'day')
  return [months ? `${months} tháng` : '', days ? `${days} ngày` : ''].filter(Boolean).join(' ') || '0 ngày'
}

const usd = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usdShort = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

export function formatDate(value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('DD/MM/YYYY') : ''
}

// Ngày giờ DD/MM/YYYY HH:mm (giờ máy người xem).
export function formatDateTime(value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : ''
}

// fixed: luôn hai chữ số lẻ (ô nhập, bảng khoản); không có fixed thì bỏ ",00" (cột tổng).
export function formatUsd(value, { fixed = false } = {}) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return ''
  return (fixed ? usd : usdShort).format(Number(value))
}

// Chênh lệch có dấu: "+1.700", "-200", 0 là "0". Không có giá trị thì "—".
export function formatDiff(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return `${n > 0 ? '+' : ''}${usdShort.format(n)}`
}
