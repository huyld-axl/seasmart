// Tính vị trí cho CrewTimeline: hàm thuần, không đọc giờ máy. Ngày dạng YYYY-MM-DD.
const DAY = 86400000
const ms = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const pad = (n) => String(n).padStart(2, '0')

// rows: [{ id, bars: [{ kind, start, end, label }] }]. Trả cột tháng, vạch hôm nay và vị trí từng thanh theo % bề ngang.
// Thanh ngoài khoảng bị cắt vào khoảng; thanh nằm hẳn ngoài bị bỏ. Ngày cuối tính trọn ngày (cộng 1).
export function timelineLayout({ from, to, today, rows = [] }) {
  const start = ms(from)
  const end = ms(to) + DAY
  const span = end - start
  const pct = (t) => ((t - start) / span) * 100
  const months = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7)) - 1
  while (Date.UTC(y, m, 1) < end) {
    const a = Math.max(Date.UTC(y, m, 1), start)
    const b = Math.min(Date.UTC(y, m + 1, 1), end)
    months.push({ key: `${y}-${pad(m + 1)}`, label: `${pad(m + 1)}/${String(y).slice(2)}`, left: pct(a), width: pct(b) - pct(a) })
    m += 1
    if (m === 12) { m = 0; y += 1 }
  }
  const todayMs = today ? ms(today) : null
  return {
    months,
    todayLeft: todayMs !== null && todayMs >= start && todayMs < end ? pct(todayMs) : null,
    rows: rows.map((row) => ({
      ...row,
      bars: (row.bars || [])
        .filter((bar) => bar.start && bar.end && ms(bar.end) + DAY > start && ms(bar.start) < end)
        .map((bar) => {
          const a = Math.max(ms(bar.start), start)
          const b = Math.min(ms(bar.end) + DAY, end)
          return { ...bar, left: pct(a), width: Math.max(pct(b) - pct(a), 0.4) }
        }),
    })),
  }
}
