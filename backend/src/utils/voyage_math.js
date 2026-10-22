// Hàm tính thuần cho chuyến tàu và hợp đồng: không đọc DB, không đọc giờ máy.
// Bản frontend (pages/admin/voyages/voyageView.js) phải cho cùng kết quả trên cùng bộ ví dụ.
const { DUE_SOON_DAYS } = require('../constants/voyage_contract')

const DAY_MS = 86400000
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => (v == null || v === '' ? 0 : Number(v))

function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) throw { statusCode: 400, message: 'Ngày không hợp lệ' }
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) }
}

// start + n tháng, ngày vượt quá cuối tháng thì lùi về cuối tháng (31/01 + 1 tháng = 28/02).
function addMonths({ y, m, d }, n) {
  const total = y * 12 + m + n
  const ty = Math.floor(total / 12)
  const tm = total % 12
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return Date.UTC(ty, tm, Math.min(d, last))
}

function daysBetween(from, to) {
  return Math.round((to - from) / DAY_MS)
}

// Số tháng giữa hai ngày: m tháng trọn + d ngày lẻ / 30, làm tròn 2 chữ số.
function monthsBetween(start, end) {
  const s = parseDate(start)
  const e = parseDate(end)
  const endMs = Date.UTC(e.y, e.m, e.d)
  if (endMs < Date.UTC(s.y, s.m, s.d)) throw { statusCode: 400, message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' }
  let months = (e.y - s.y) * 12 + (e.m - s.m)
  while (months > 0 && addMonths(s, months) > endMs) months -= 1
  const days = daysBetween(addMonths(s, months), endMs)
  return round2(months + days / 30)
}

// Người dùng sửa ô nào thì ô kia tự tính. Trả { total, monthly }.
function splitBudget({ total, monthly, months }) {
  if (total != null && total !== '') {
    return { total: round2(total), monthly: months > 0 ? round2(num(total) / months) : round2(total) }
  }
  return { total: round2(num(monthly) * months), monthly: round2(num(monthly)) }
}

const sumItems = (items, kind, field) =>
  round2(items.filter((i) => i.kind === kind).reduce((s, i) => s + num(i[field]), 0))

// Cân đối hợp đồng. receivableOk/payableOk/diffOk là true khi đạt (dấu ✓ xanh).
function contractBalance({ items, budgetMonthly, contractMonths }) {
  const budget = num(budgetMonthly)
  const receivableMonthly = sumItems(items, 'MONTHLY', 'receivable_usd')
  const payableMonthly = sumItems(items, 'MONTHLY', 'payable_usd')
  const receivableOnce = sumItems(items, 'ONE_TIME', 'receivable_usd')
  const payableOnce = sumItems(items, 'ONE_TIME', 'payable_usd')
  const diffMonthly = round2(receivableMonthly - payableMonthly)
  return {
    budgetMonthly: round2(budget),
    receivableMonthly,
    payableMonthly,
    diffMonthly,
    receivableOnce,
    payableOnce,
    diffOnce: round2(receivableOnce - payableOnce),
    diffContract: round2(diffMonthly * num(contractMonths)),
    receivableOk: receivableMonthly <= budget,
    payableOk: payableMonthly <= budget,
    diffOk: diffMonthly >= 0 && diffMonthly <= budget,
  }
}

// Cảnh báo trễ ngày, chỉ khi PLANNING. today và plannedEmbark dạng YYYY-MM-DD.
function dueFlag({ status, plannedEmbark, today }) {
  if (status !== 'PLANNING') return null
  const p = parseDate(plannedEmbark)
  const t = parseDate(today)
  const days = daysBetween(Date.UTC(t.y, t.m, t.d), Date.UTC(p.y, p.m, p.d))
  if (days < 0) return { kind: 'LATE', days: -days }
  if (days <= DUE_SOON_DAYS) return { kind: 'SOON', days }
  return null
}

function displayStatus({ status, positionsTotal, positionsFilled }) {
  if (status === 'ONBOARD') return 'ONBOARD'
  if (status === 'ENDED') return 'ENDED'
  return positionsTotal > 0 && positionsFilled >= positionsTotal ? 'FULL' : 'RECRUITING'
}


// ---------- Yêu cầu thanh toán ----------
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10)
const dayMs = ({ y, m, d }) => Date.UTC(y, m, d)

// Ngày chốt sổ `closingDay` của tháng (y, m); 31 hoặc lớn hơn số ngày của tháng = ngày cuối tháng.
function closingOf(y, m, closingDay) {
  return addMonths({ y, m, d: closingDay }, 0)
}

// Chia [start, end] thành các kỳ theo ngày chốt sổ. Kỳ đầu bắt đầu đúng ngày bắt đầu,
// kỳ sau bắt đầu ngay sau ngày chốt của kỳ trước, kỳ cuối kết thúc đúng ngày kết thúc. Trả [{ start, end }] dạng YYYY-MM-DD.
function splitPeriods({ start, end, closingDay }) {
  const endMs = dayMs(parseDate(end))
  let cur = dayMs(parseDate(start))
  if (endMs < cur) throw { statusCode: 400, message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' }
  const out = []
  while (cur <= endMs) {
    const c = parseDate(isoOf(cur))
    let close = closingOf(c.y, c.m, closingDay)
    if (close < cur) close = addMonths({ y: c.y, m: c.m, d: closingDay }, 1)
    const periodEnd = Math.min(close, endMs)
    out.push({ start: isoOf(cur), end: isoOf(periodEnd) })
    cur = periodEnd + DAY_MS
  }
  return out
}

// Hạn thanh toán: ngày `payDay` của tháng (tháng chốt + payMonthOffset), gặp thứ 7, CN thì lùi (BEFORE) hoặc tiến (AFTER)
// tới ngày thường gần nhất. Không xét ngày lễ: cần dời thì người vận hành sửa hạn trên bill.
function dueDate({ periodEnd, payDay, payMonthOffset, holidayRule }) {
  const p = parseDate(periodEnd)
  let t = addMonths({ y: p.y, m: p.m, d: payDay }, payMonthOffset)
  const off = (ms) => [0, 6].includes(new Date(ms).getUTCDay())
  while (off(t)) t += holidayRule === 'BEFORE' ? -DAY_MS : DAY_MS
  return isoOf(t)
}

// Trạng thái hiển thị của bill. today, periodEnd, dueDate dạng YYYY-MM-DD.
function billDisplayStatus({ status, periodEnd, dueDate: due, today }) {
  if (status === 'PAID') return 'PAID'
  if (status === 'SENT') return today > due ? 'OVERDUE' : 'SENT'
  return today < periodEnd ? 'UPCOMING' : 'TO_SEND'
}

module.exports = { splitPeriods, dueDate, billDisplayStatus, parseDate, addMonths, monthsBetween, splitBudget, contractBalance, dueFlag, displayStatus, round2 }
