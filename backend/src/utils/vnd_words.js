// Đọc số tiền bằng chữ tiếng Việt: 100000 → "Một trăm nghìn đồng chẵn".

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const UNITS = ['', 'nghìn', 'triệu', 'tỷ']

// Một nhóm ba chữ số; `full` khi phía trước còn nhóm lớn hơn (phải đọc cả "không trăm", "lẻ").
function readGroup(n, full) {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  const words = []
  if (hundreds || full) words.push(DIGITS[hundreds], 'trăm')
  if (tens > 1) {
    words.push(DIGITS[tens], 'mươi')
    if (ones) words.push(ones === 1 ? 'mốt' : ones === 5 ? 'lăm' : DIGITS[ones])
  } else if (tens === 1) {
    words.push('mười')
    if (ones) words.push(ones === 5 ? 'lăm' : DIGITS[ones])
  } else if (ones) {
    if (words.length) words.push('lẻ')
    words.push(DIGITS[ones])
  }
  return words.join(' ')
}

// "100.000 đ" → 100000; không đọc được thì null.
function parseAmount(text) {
  const digits = String(text ?? '').replace(/[^\d]/g, '')
  if (!digits || digits.length > 12) return null
  return Number(digits)
}

function vndWords(amount) {
  if (!Number.isInteger(amount) || amount < 0 || amount >= 1e12) return ''
  if (amount === 0) return 'Không đồng'
  const groups = []
  for (let rest = amount; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000)
  const words = groups
    .map((group, i) => (group ? `${readGroup(group, i < groups.length - 1)} ${UNITS[i]}`.trim() : ''))
    .reverse()
    .filter(Boolean)
    .join(' ')
  return `${words[0].toUpperCase()}${words.slice(1)} đồng chẵn`
}

module.exports = { vndWords, parseAmount }
