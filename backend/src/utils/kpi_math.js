// Hàm tính thuần cho KPI của màn Tổng quan: không đọc DB, không đọc giờ máy.
// Định nghĩa ở docs/mcah-ke-hoach-tong-quan.md mục 1.4. Tháng viết 'YYYY-MM', ngày viết 'YYYY-MM-DD'.
const { parseDate, round2 } = require('./voyage_math')

const DAY_MS = 86400000
const num = (v) => (v == null || v === '' ? 0 : Number(v))
const msOf = (value) => { const { y, m, d } = parseDate(value); return Date.UTC(y, m, d) }

function parseMonth(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw { statusCode: 400, message: 'Tháng không hợp lệ' }
  return { y: Number(m[1]), m: Number(m[2]) - 1 }
}
const monthOf = (y, m) => `${y + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}`

function daysInMonth(month) {
  const { y, m } = parseMonth(month)
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

// n tháng kết thúc ở `month`, cũ trước: lastMonths('2026-11', 3) → ['2026-09', '2026-10', '2026-11'].
function lastMonths(month, n) {
  const { y, m } = parseMonth(month)
  return Array.from({ length: n }, (_, i) => monthOf(y, m - (n - 1) + i))
}

// Số ngày của [start, end] (tính cả hai đầu) nằm trong tháng. upTo: chỉ đếm tới hết ngày đó (số "đã ghi nhận tới hôm nay").
function monthOverlapDays(start, end, month, upTo = null) {
  const { y, m } = parseMonth(month)
  const from = Math.max(msOf(start), Date.UTC(y, m, 1))
  let to = Math.min(msOf(end), Date.UTC(y, m + 1, 0))
  if (upTo) to = Math.min(to, msOf(upTo))
  return to < from ? 0 : Math.round((to - from) / DAY_MS) + 1
}

const monthlyDiff = (items) => items.filter((i) => i.kind === 'MONTHLY').reduce((s, i) => s + num(i.receivable_usd) - num(i.payable_usd), 0)
const onceDiff = (items) => items.filter((i) => i.kind === 'ONE_TIME').reduce((s, i) => s + num(i.receivable_usd) - num(i.payable_usd), 0)

// Doanh thu của một hợp đồng trong một tháng: chênh lệch hằng tháng × ngày trong tháng / số ngày tháng,
// cộng chênh lệch một lần nếu tháng chứa ngày bắt đầu (và, khi có upTo, ngày bắt đầu không sau upTo).
function contractRevenue({ start_date: start, end_date: end, items = [] }, month, upTo = null) {
  const days = monthOverlapDays(start, end, month, upTo)
  let value = (monthlyDiff(items) * days) / daysInMonth(month)
  const startMonth = String(start).slice(0, 7)
  if (startMonth === month && (!upTo || msOf(start) <= msOf(upTo))) value += onceDiff(items)
  return round2(value)
}

// Tổng doanh thu theo từng tháng của nhiều hợp đồng: { '2026-10': 26300, '2026-11': 26900 }.
function revenueByMonth(contracts, months, upTo = null) {
  const out = Object.fromEntries(months.map((mo) => [mo, 0]))
  for (const c of contracts) for (const mo of months) out[mo] = round2(out[mo] + contractRevenue(c, mo, upTo))
  return out
}

// Tiến độ cần có tới hôm nay. Chưa đặt mục tiêu → null.
function pace(target, day, days) {
  if (target == null) return null
  return round2((Number(target) * day) / days)
}

// Nhãn thẻ Hợp đồng: DONE (đạt mục tiêu), ON_TRACK (đúng tiến độ), BEHIND (chậm). Chưa đặt mục tiêu → null.
function contractLabel(done, target, paceValue) {
  if (target == null) return null
  if (done >= target) return 'DONE'
  return done >= paceValue ? 'ON_TRACK' : 'BEHIND'
}

// Nhãn thẻ Doanh thu: { kind: 'DONE' } hoặc { kind: 'SHORT', short }. Chưa đặt mục tiêu → null.
function revenueLabel(projected, target) {
  if (target == null) return null
  const short = round2(Number(target) - projected)
  return short > 0 ? { kind: 'SHORT', short } : { kind: 'DONE' }
}

module.exports = { daysInMonth, lastMonths, monthOverlapDays, contractRevenue, revenueByMonth, pace, contractLabel, revenueLabel }
