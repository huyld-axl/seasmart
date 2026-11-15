// Tính cho VoyageTimeline: hàm thuần, không đọc giờ máy. Ngày dạng YYYY-MM-DD.
const DAY = 86400000

const ms = (iso) => Date.parse(`${iso}T00:00:00Z`)

export const daysBetween = (from, to) => Math.round((ms(to) - ms(from)) / DAY)

// "9 tháng 12 ngày", "20 ngày"; dưới 1 ngày thì "1 ngày".
export function durationText(days) {
  const d = Math.max(days, 1)
  const months = Math.floor(d / 30)
  const rest = d % 30
  if (!months) return `${d} ngày`
  return rest ? `${months} tháng ${rest} ngày` : `${months} tháng`
}

// items: [{ id, start, end|null, ... }] -> mới nhất trước, mỗi dòng thêm days (trên tàu), ongoing,
// ashoreDays (số ngày ở bờ giữa chuyến này và chuyến mới hơn liền trước nó; null nếu không có / chồng nhau).
export function timelineRows(items, today) {
  const sorted = [...items].sort((a, b) => b.start.localeCompare(a.start))
  return sorted.map((item, index) => {
    const ongoing = !item.end
    const newer = sorted[index - 1]
    const gap = newer && item.end ? daysBetween(item.end, newer.start) : null
    return {
      ...item,
      ongoing,
      days: daysBetween(item.start, item.end || today),
      ashoreDays: gap !== null && gap > 0 ? gap : null,
      ashoreFrom: item.end || null,
      ashoreTo: newer ? newer.start : null,
      year: item.start.slice(0, 4),
    }
  })
}

// Đang ở bờ: chuyến mới nhất đã rời tàu thì tính từ ngày rời tới hôm nay.
export function ashoreNow(rows, today) {
  const first = rows[0]
  if (!first || first.ongoing) return null
  const days = daysBetween(first.end, today)
  return days > 0 ? { from: first.end, days } : null
}

export const totalDays = (rows) => rows.reduce((sum, row) => sum + row.days, 0)
