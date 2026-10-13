// Chuẩn hoá bằng code các giá trị AI đọc ra: ngày, chức danh, tên người. Hàm thuần, không đụng DB.

const MONTHS = {
  JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4, MAY: 5, JUN: 6, JUNE: 6,
  JUL: 7, JULY: 7, AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9, OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
}

// Bỏ dấu tiếng Việt, đ → d, viết hoa.
function stripAccents(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
}

function expandTwoDigitYear(yy, today) {
  // Năm hai chữ số luôn chỉ là đoán: nhỏ hơn hoặc bằng năm hiện tại + 15 thì thuộc thế kỷ này.
  const current = today.getUTCFullYear() % 100
  return (yy <= current + 15 ? 2000 : 1900) + yy
}

// Đọc một ngày viết theo các kiểu gặp trên sổ và chứng chỉ.
// Trả { status, value, iso }: status là OK, DATE_AMBIGUOUS (đoán được nhưng người duyệt phải xem),
// INVALID (không ra ngày hợp lệ) hoặc EMPTY. value dạng dd/mm/yyyy.
// options.numericOrderUnknown: coi dd/mm và mm/dd là chưa chắc khi cả hai ≤ 12 (giấy của nước ngoài).
function normalizeDate(text, { today = new Date(), numericOrderUnknown = false } = {}) {
  const source = String(text ?? '').trim()
  if (!source) return { status: 'EMPTY', value: null, iso: null }

  let t = stripAccents(source)
    .replace(/(\d)\s*(ST|ND|RD|TH)\b/g, '$1')
    .replace(/\b(NGAY|THANG|NAM)\b/g, ' ')
  const tokens = t.split(/[^A-Z0-9]+/).filter(Boolean)
  if (tokens.length !== 3) return { status: 'INVALID', value: null, iso: null }

  const monthIndex = tokens.findIndex((token) => MONTHS[token])
  let day
  let month
  let yearToken
  let numericMonth = true
  if (monthIndex === 0) {
    ;[, day, yearToken] = tokens
    month = MONTHS[tokens[0]]
    numericMonth = false
  } else if (monthIndex === 1) {
    ;[day, , yearToken] = tokens
    month = MONTHS[tokens[1]]
    numericMonth = false
  } else if (monthIndex === -1) {
    if (tokens[0].length === 4) {
      ;[yearToken, month, day] = tokens
    } else {
      ;[day, month, yearToken] = tokens
    }
  } else {
    return { status: 'INVALID', value: null, iso: null }
  }
  if (![day, month, yearToken].every((part) => /^\d+$/.test(String(part)))) return { status: 'INVALID', value: null, iso: null }

  let ambiguous = false
  let year
  if (yearToken.length === 4) {
    year = Number(yearToken)
  } else if (yearToken.length === 2) {
    year = expandTwoDigitYear(Number(yearToken), today)
    ambiguous = true
  } else {
    return { status: 'INVALID', value: null, iso: null }
  }
  const d = Number(day)
  const m = Number(month)
  const date = new Date(Date.UTC(year, m - 1, d))
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { status: 'INVALID', value: null, iso: null }
  }
  if (numericOrderUnknown && numericMonth && d <= 12 && m <= 12 && d !== m) ambiguous = true

  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return { status: ambiguous ? 'DATE_AMBIGUOUS' : 'OK', value: `${dd}/${mm}/${year}`, iso: `${year}-${mm}-${dd}` }
}

// Chức danh viết tắt hoặc viết khác nhau → mã chức danh trong bảng rank. Khoá đã bỏ dấu và bỏ ký tự phân cách.
const RANK_ALIASES = {
  CAPT: 'CAPT', CAPTAIN: 'CAPT', MASTER: 'CAPT', THUYENTRUONG: 'CAPT',
  CO: 'CO', COFFICER: 'CO', CHIEFOFFICER: 'CO', CHIEFMATE: 'CO', '1O': 'CO', '1STOFFICER': 'CO', FIRSTOFFICER: 'CO', '1STMATE': 'CO', DAIPHO: 'CO',
  '2O': '2O', '2NDOFFICER': '2O', SECONDOFFICER: '2O', '2NDMATE': '2O', PHOHAI: '2O',
  '3O': '3O', '3RDOFFICER': '3O', THIRDOFFICER: '3O', '3RDMATE': '3O', PHOBA: '3O',
  BSN: 'BSN', BOSUN: 'BSN', BOATSWAIN: 'BSN', THUYTHUTRUONG: 'BSN',
  CARP: 'CARP', CARPENTER: 'CARP', THUYTHUPHO: 'CARP',
  AB: 'AB', ABLESEAMAN: 'AB', ABLEBODIED: 'AB', ABLEBODIEDSEAMAN: 'AB', THUYTHUTRUCCA: 'AB',
  OS: 'OS', ORDINARYSEAMAN: 'OS', OSD: 'OSD',
  DCADET: 'DCADET', DECKCADET: 'DCADET', DCDT: 'DCADET', THUCTAPSYQUANBOONG: 'DCADET',
  CE: 'CE', CHIEFENGINEER: 'CE', MAYTRUONG: 'CE',
  '2E': '2E', '2NDENGINEER': '2E', SECONDENGINEER: '2E', MAYHAI: '2E',
  '3E': '3E', '3RDENGINEER': '3E', THIRDENGINEER: '3E', MAYBA: '3E',
  '4E': '4E', '4THENGINEER': '4E', FOURTHENGINEER: '4E', MAYTU: '4E',
  ETO: 'ETO', ELECTROTECHNICALOFFICER: 'ETO',
  ELECT: 'ELECT', ELECTRICIAN: 'ELECT', EL: 'ELECT', THODIEN: 'ELECT',
  FTR: 'FTR', FITTER: 'FTR', THOCA: 'FTR',
  OLR: 'OLR', OILER: 'OLR', THOMAY: 'OLR',
  WPR: 'WPR', WIPER: 'WPR',
  OSE: 'OSE', ORDINARYSEAMANENGINE: 'OSE',
  'ENGINE CADET': 'ENGINE CADET', ENGINECADET: 'ENGINE CADET', ECDT: 'ENGINE CADET', ECADET: 'ENGINE CADET', THUCTAPSYQUANMAY: 'ENGINE CADET',
  COOK: 'COOK', BEPTRUONG: 'COOK', CHIEFCOOK: 'COOK',
  MESS: 'MESS', MESSMAN: 'MESS', MESSBOY: 'MESS', PHUCVU: 'MESS',
}

function compactKey(text) {
  return stripAccents(text).replace(/[^A-Z0-9]+/g, '')
}

// ranks: các dòng bảng rank { id, code, name_vi, name_en }. Trả dòng khớp duy nhất hoặc null.
function normalizeRank(text, ranks) {
  const key = compactKey(text)
  if (!key) return null
  const byCode = (code) => ranks.find((rank) => compactKey(rank.code) === compactKey(code)) || null
  const alias = RANK_ALIASES[key]
  if (alias) {
    const found = byCode(alias)
    if (found) return found
  }
  const exactCode = byCode(key)
  if (exactCode) return exactCode
  for (const field of ['name_en', 'name_vi']) {
    const matches = ranks.filter((rank) => compactKey(rank[field]) === key)
    if (matches.length === 1) return matches[0]
  }
  return null
}

// Tên người để so sánh: bỏ dấu, viết hoa, bỏ dấu câu, gộp khoảng trắng.
function normalizeName(text) {
  return stripAccents(text).replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Hai tên cùng một người: giống nhau sau chuẩn hoá, hoặc cùng bộ chữ khác thứ tự (HOAI DO VAN ~ DO VAN HOAI).
function sameName(a, b) {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  if (x === y) return true
  return x.split(' ').sort().join(' ') === y.split(' ').sort().join(' ')
}

// Số sổ, số chứng chỉ: chỉ so chữ và số.
function normalizeNumber(text) {
  return stripAccents(text).replace(/[^A-Z0-9]+/g, '')
}

module.exports = { normalizeDate, normalizeRank, normalizeName, sameName, normalizeNumber, stripAccents }
