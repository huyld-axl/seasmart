const { REPORTS } = require('../constants/reports')
const { monthRows } = require('./payout.service')
const { round2, sumBy, splitAmounts, planAmounts, groupByOwner, mergeSpans, termText, validMonth } = require('../utils/report_math')

// Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md): 4 bảng dựng từ cùng các dòng của bảng Trả lương (bill phải thu có kỳ kết thúc trong tháng).
// Số Trả = số đang hiện ở Trả lương: dòng đã chốt là số đã chốt, chưa chốt là mặc định từ cột Phải chi của hợp đồng.

const iso = (v) => (v == null ? null : String(v).slice(0, 10))
const byName = (a, b) => a.localeCompare(b, 'vi')
const monthLabel = (month) => `${month.slice(5)}/${month.slice(0, 4)}`

// Đối tác, thuyền viên, hợp đồng để giao diện làm link sang chi tiết.
const links = (r) => ({ ship_owner_id: r.ship_owner.id, seafarer_id: r.seafarer.id, contract_id: r.contract.id })

function ownerReport(rows, side, month) {
  return groupByOwner(rows, side).map((g, i) => ({
    no: i + 1, month: monthLabel(month), ship_owner_name: g.ship_owner.company_name,
    monthly: g.monthly, one_time: g.one_time, total: g.total, headcount: g.headcount, share: g.share,
    _links: { ship_owner_id: g.ship_owner.id },
  }))
}

function cashflowReport(rows) {
  const sorted = [...rows].sort((a, b) => a.bill.due_date.localeCompare(b.bill.due_date)
    || byName(a.ship_owner.company_name, b.ship_owner.company_name) || byName(a.seafarer.full_name, b.seafarer.full_name) || a.bill.id - b.bill.id)
  const dayKey = (r) => r.bill.due_date
  const ownerKey = (r) => `${r.bill.due_date}|${r.ship_owner.id}`
  const daySpans = mergeSpans(sorted, dayKey)
  const ownerSpans = mergeSpans(sorted, ownerKey)
  const sumOf = (keyFn, r) => sumBy(sorted.filter((x) => keyFn(x) === keyFn(r)), (x) => x.bill.total_usd)
  return sorted.map((r, i) => ({
    no: i + 1,
    due_date: r.bill.due_date,
    day_total: sumOf(dayKey, r),
    ship_owner_name: r.ship_owner.company_name,
    owner_total: sumOf(ownerKey, r),
    payable_due_date: r.payable_due_date,
    seafarer_name: r.seafarer.full_name,
    pic_name: r.pic?.name ?? null,
    receivable: r.bill.total_usd,
    payable: r.payout.total_usd,
    margin: round2(r.bill.total_usd - r.payout.total_usd),
    period_start: r.bill.period_start,
    period_end: r.bill.period_end,
    _span: { day: daySpans[i], owner: ownerSpans[i] },
    _links: links(r),
  }))
}

async function baseReport(pool, rows, month) {
  const contractIds = [...new Set(rows.map((r) => r.contract.id))]
  const [contracts] = await pool.query(
    'SELECT c.id, c.start_date, c.end_date FROM seafarer_contract c WHERE c.id IN (?)', [contractIds])
  const [terms] = await pool.query(
    'SELECT contract_id, side, closing_day, pay_day, pay_month_offset, holiday_rule FROM contract_payment_term WHERE contract_id IN (?)', [contractIds])
  const [contractItems] = await pool.query(
    'SELECT ci.contract_id, ci.item_code, ci.receivable_usd, ci.payable_usd FROM contract_item ci WHERE ci.contract_id IN (?)', [contractIds])
  const contractBy = new Map(contracts.map((c) => [c.id, c]))
  const termOf = (id, side) => terms.find((t) => t.contract_id === id && t.side === side)
  const itemsOf = (id) => contractItems.filter((item) => item.contract_id === id)
  const sorted = [...rows].sort((a, b) => byName(a.ship_owner.company_name, b.ship_owner.company_name)
    || byName(a.seafarer.full_name, b.seafarer.full_name) || a.bill.code.localeCompare(b.bill.code))
  return sorted.map((r) => {
    const c = contractBy.get(r.contract.id) || {}
    const thu = splitAmounts(r.bill.amounts)
    const tra = splitAmounts(r.payout.amounts)
    const rt = termText(termOf(r.contract.id, 'RECEIVABLE'))
    const pt = termText(termOf(r.contract.id, 'PAYABLE'))
    // Dự kiến: khoản tiền ghi trong hợp đồng áp vào kỳ này. Lãi gộp dự kiến tính từ hai bên này (粗利（予測）).
    const planR = planAmounts(itemsOf(r.contract.id), 'receivable_usd', r.bill.seq)
    const planP = planAmounts(itemsOf(r.contract.id), 'payable_usd', r.bill.seq)
    const pr = splitAmounts(planR)
    const pp = splitAmounts(planP)
    const prefixed = (prefix, amounts) => Object.entries(amounts).map(([code, v]) => [`${prefix}_${code}`, v])
    const items = Object.fromEntries([
      ...prefixed('thu', r.bill.amounts), ...prefixed('tra', r.payout.amounts), ...prefixed('ri', planR), ...prefixed('pi', planP),
    ])
    return {
      month: monthLabel(month),
      contract_number: r.contract.contract_number,
      // Người phụ trách bill.
      pic_name: r.pic?.name ?? null,
      vessel_name: r.vessel.vessel_name,
      ship_owner_name: r.ship_owner.company_name,
      seafarer_name: r.seafarer.full_name,
      contract_start: iso(c.start_date),
      contract_end: iso(c.end_date),
      period_start: r.bill.period_start,
      period_end: r.bill.period_end,
      ...items,
      thu_monthly: thu.monthly, thu_one_time: thu.one_time, thu_total: thu.total,
      tra_monthly: tra.monthly, tra_one_time: tra.one_time, tra_total: tra.total,
      margin: round2(thu.total - tra.total),
      r_closing: rt.closing, r_pay: rt.pay, r_holiday: rt.holiday,
      ri_monthly: pr.monthly, ri_one_time: pr.one_time, ri_total: pr.total,
      p_closing: pt.closing, p_pay: pt.pay, p_holiday: pt.holiday,
      pi_monthly: pp.monthly, pi_one_time: pp.one_time, pi_total: pp.total,
      planned_margin: round2(pr.total - pp.total),
      _links: links(r),
    }
  })
}

// Dòng tổng: cộng cột tiền và số người, tỷ lệ 100%, chữ "Tổng" ở cột totalLabelKey.
function totalsOf(key, rows) {
  const def = REPORTS[key]
  const totals = {}
  for (const col of def.columns) {
    if (col.type === 'money' || (col.type === 'int' && col.key !== 'no')) totals[col.key] = sumBy(rows, (r) => r[col.key])
    if (col.type === 'percent') totals[col.key] = rows.length ? 100 : 0
  }
  // Hai cột gộp ô của Lịch thu chi: tổng = tổng thu, không cộng lặp các dòng trong nhóm.
  if (key === 'cashflow') totals.day_total = totals.owner_total = totals.receivable
  totals[def.totalLabelKey] = key === 'base' ? `Tổng · ${rows.length} dòng` : key === 'cashflow' ? 'Tổng' : 'Tổng cộng'
  return totals
}

const reportService = {
  // key ∈ REPORT_KEYS; query: { month, ownerId }. Tháng sai hoặc thiếu: bảng rỗng (luật bộ lọc không kiểm).
  async build(pool, key, { month, ownerId = null } = {}) {
    const def = REPORTS[key]
    const head = { key, title: def.title, sheet: def.sheet, month: validMonth(month) ? month : null, columns: def.columns }
    const data = validMonth(month) ? await monthRows(pool, { month, ownerId }) : []
    let rows = []
    if (data.length) {
      if (key === 'sales') rows = ownerReport(data, 'bill', month)
      else if (key === 'cost') rows = ownerReport(data, 'payout', month)
      else if (key === 'cashflow') rows = cashflowReport(data)
      else rows = await baseReport(pool, data, month)
    }
    return { ...head, rows, bill_count: data.length, totals: totalsOf(key, rows) }
  },
}

module.exports = { reportService }
