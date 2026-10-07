// Số IMO: 7 chữ số, chữ số cuối là số kiểm tra = tổng (chữ số i × (7 − i)) cho 6 chữ số đầu, lấy hàng đơn vị
function isValidImo(value) {
  if (!/^\d{7}$/.test(String(value || ''))) return false
  const digits = String(value).split('').map(Number)
  const sum = digits.slice(0, 6).reduce((total, digit, index) => total + digit * (7 - index), 0)
  return sum % 10 === digits[6]
}

module.exports = { isValidImo }
