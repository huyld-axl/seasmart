// Báo cáo tháng (docs/catoro-ke-hoach-bao-cao.md). Hàm thuần, không đọc DB.
const { DEFAULT_ITEMS } = require('../constants/voyage_contract')

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const sumBy = (rows, pick) => round2(rows.reduce((total, row) => total + Number(pick(row) || 0), 0))

// Tách 14 khoản thành tổng hằng tháng / một lần / tổng.
function splitAmounts(amounts = {}) {
  const monthly = sumBy(DEFAULT_ITEMS.filter((item) => item.kind === 'MONTHLY'), (item) => amounts[item.code])
  const oneTime = sumBy(DEFAULT_ITEMS.filter((item) => item.kind === 'ONE_TIME'), (item) => amounts[item.code])
  return { monthly, one_time: oneTime, total: round2(monthly + oneTime) }
}

// Khoản tiền ghi trong hợp đồng áp vào một kỳ (dự kiến), đủ 14 mã: khoản hằng tháng mọi kỳ, khoản một lần chỉ kỳ 1 (cùng quy tắc sinh bill).
// field: 'receivable_usd' | 'payable_usd'.
function planAmounts(contractItems = [], field, seq) {
  const byCode = Object.fromEntries(contractItems.map((item) => [item.item_code, Number(item[field]) || 0]))
  return Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.kind === 'MONTHLY' || seq === 1 ? round2(byCode[item.code] || 0) : 0]))
}

// Tỷ lệ số người (%), làm tròn 2 số lẻ; phần dư dồn vào dòng đông người nhất để tổng đúng 100.
function headcountShare(counts) {
  const n = counts.reduce((total, c) => total + c, 0)
  if (!n) return counts.map(() => 0)
  const shares = counts.map((c) => round2((c / n) * 100))
  const largest = counts.indexOf(Math.max(...counts))
  shares[largest] = round2(shares[largest] + 100 - shares.reduce((total, s) => total + s, 0))
  return shares
}

// Gộp các dòng tháng theo đối tác. side: 'bill' (Thu) | 'payout' (Trả). Sắp theo Tổng giảm dần, bằng nhau thì theo tên.
function groupByOwner(rows, side) {
  const groups = new Map()
  for (const row of rows) {
    const id = row.ship_owner.id
    const g = groups.get(id) || { ship_owner: row.ship_owner, monthly: 0, one_time: 0, total: 0, seafarers: new Set() }
    const part = splitAmounts(row[side].amounts)
    g.monthly = round2(g.monthly + part.monthly)
    g.one_time = round2(g.one_time + part.one_time)
    g.total = round2(g.total + part.total)
    g.seafarers.add(row.seafarer.id)
    groups.set(id, g)
  }
  const list = [...groups.values()].sort((a, b) => b.total - a.total || a.ship_owner.company_name.localeCompare(b.ship_owner.company_name, 'vi'))
  const shares = headcountShare(list.map((g) => g.seafarers.size))
  return list.map((g, i) => ({ ship_owner: g.ship_owner, monthly: g.monthly, one_time: g.one_time, total: g.total, headcount: g.seafarers.size, share: shares[i] }))
}

// Gộp ô: dòng đầu của mỗi nhóm liền nhau giữ số dòng của nhóm, các dòng sau là 0 (rowSpan / mergeCells).
function mergeSpans(rows, keyFn) {
  const spans = rows.map(() => 0)
  let start = 0
  rows.forEach((row, i) => {
    if (i > 0 && keyFn(row) === keyFn(rows[i - 1])) spans[start] += 1
    else {
      start = i
      spans[i] = 1
    }
  })
  return spans
}

// Chữ kỳ thanh toán, cùng cách nói với form hợp đồng (contractView.js). Không có kỳ thì "—".
function termText(term) {
  if (!term) return { closing: '—', pay: '—', holiday: '—' }
  const closing = term.closing_day === 31 ? 'Cuối tháng' : `Ngày ${term.closing_day}`
  const offset = term.pay_month_offset
  const pay = offset === 1
    ? (term.pay_day === 31 ? 'Cuối tháng sau' : `Ngày ${term.pay_day} tháng sau`)
    : (term.pay_day === 31 ? `Cuối tháng, sau ${offset} tháng` : `Ngày ${term.pay_day} sau ${offset} tháng`)
  return { closing, pay, holiday: term.holiday_rule === 'BEFORE' ? 'Làm trước' : 'Làm sau' }
}

// 'YYYY-MM' hợp lệ hay không (tháng sai thì báo cáo rỗng, không báo lỗi).
const validMonth = (month) => typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)

module.exports = { round2, sumBy, splitAmounts, planAmounts, headcountShare, groupByOwner, mergeSpans, termText, validMonth }
