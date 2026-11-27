// Trả lương thuyền viên (docs/catoro-ke-hoach-tra-luong.md phần B). Hàm thuần, không đọc DB.
const { DEFAULT_ITEMS } = require('../constants/voyage_contract')

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Số trả mặc định của một kỳ bill, đủ 14 khoản: cột Phải chi của hợp đồng (trống = 0);
// khoản hằng tháng mọi kỳ, khoản một lần chỉ ở kỳ 1 (cùng quy tắc sinh bill).
function payoutDefaults({ contractItems = [], seq }) {
  const byCode = Object.fromEntries(contractItems.map((item) => [item.item_code, Number(item.payable_usd) || 0]))
  return Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.kind === 'MONTHLY' || seq === 1 ? round2(byCode[item.code] || 0) : 0]))
}

// Đủ 14 mã, thiếu là 0.
function fullAmounts(rows = []) {
  const byCode = Object.fromEntries(rows.map((row) => [row.item_code, round2(row.amount_usd || 0)]))
  return Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, byCode[item.code] || 0]))
}

const sumAmounts = (amounts) => round2(Object.values(amounts).reduce((total, value) => total + Number(value || 0), 0))

// Ngày đầu, ngày cuối của tháng 'YYYY-MM'.
function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

module.exports = { payoutDefaults, fullAmounts, sumAmounts, monthRange }
