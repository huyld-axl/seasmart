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


// Duyệt lại hợp đồng đã có bill: tính bill nào cắt, xoá mềm, sinh thêm, bị chặn. Không chạm DB.
// bills: bill chưa xoá của một bên, sắp theo seq: { id, code, seq, period_start, period_end, status, edited }.
// term: { closing_day, pay_day, pay_month_offset, holiday_rule }.
function planBillChanges({ start, end, bills, term }) {
  const due = (periodEnd) => dueDate({ periodEnd, payDay: term.pay_day, payMonthOffset: term.pay_month_offset, holidayRule: term.holiday_rule })
  const day = (v) => String(v).slice(0, 10)
  const build = (periods, firstSeq, withOneTime) => periods.map((period, index) => ({
    seq: firstSeq + index, start: period.start, end: period.end, due_date: due(period.end), with_one_time: withOneTime && index === 0,
  }))
  const brief = (bill) => ({ bill_id: bill.id, code: bill.code, seq: bill.seq, status: bill.status, start: day(bill.period_start), end: day(bill.period_end), edited: Boolean(bill.edited) })
  const plan = { mode: 'NONE', cut: [], remove: [], create: [], blocked: [] }
  const startDay = day(start)
  const endDay = day(end)
  if (!bills.length) {
    return { ...plan, mode: 'FIRST', create: build(splitPeriods({ start: startDay, end: endDay, closingDay: term.closing_day }), 1, true) }
  }
  const oldStart = day(bills[0].period_start)
  const oldEnd = day(bills[bills.length - 1].period_end)
  if (startDay !== oldStart) {
    return {
      ...plan,
      mode: 'REGENERATE',
      remove: bills.map(brief),
      create: build(splitPeriods({ start: startDay, end: endDay, closingDay: term.closing_day }), 1, true),
      blocked: bills.filter((b) => b.status !== 'OPEN').map(brief),
    }
  }
  if (endDay < oldEnd) {
    const remove = bills.filter((b) => day(b.period_start) > endDay)
    const cut = bills.filter((b) => day(b.period_start) <= endDay && endDay < day(b.period_end))
    return {
      ...plan,
      mode: 'CUT',
      remove: remove.map(brief),
      cut: cut.map((b) => ({
        ...brief(b), from: { start: day(b.period_start), end: day(b.period_end) }, to: { start: day(b.period_start), end: endDay }, due_date: due(endDay),
      })),
      blocked: [...remove, ...cut].filter((b) => b.status !== 'OPEN').map(brief),
    }
  }
  if (endDay > oldEnd) {
    const first = parseDate(oldEnd)
    const next = isoOf(Date.UTC(first.y, first.m, first.d) + DAY_MS)
    return {
      ...plan,
      mode: 'EXTEND',
      create: build(splitPeriods({ start: next, end: endDay, closingDay: term.closing_day }), Math.max(...bills.map((b) => b.seq)) + 1, false),
    }
  }
  return plan
}

module.exports = { planBillChanges, splitPeriods, dueDate, billDisplayStatus, parseDate, addMonths, monthsBetween, splitBudget, contractBalance, dueFlag, displayStatus, round2 }
