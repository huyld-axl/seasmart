// Quy tắc dữ liệu nhập: hồ sơ thuyền viên, đối tác, tàu, danh mục. Bản sao phía giao diện: frontend/src/utils/fieldRules.js (sửa một bên thì sửa cả hai).
// Ô trống luôn hợp lệ; chỉ kiểm khi có giá trị.

const text = (v) => (v === undefined || v === null ? '' : String(v).trim())

const REGEX = {
  idNumber: /^(?!0+$)(\d{9}|\d{12})$/,
  passport: /^[A-Z0-9]{6,20}$/i,
  seamanBook: /^[A-Z0-9][A-Z0-9\-/ ]{2,29}$/i,
  shoe: /^\d{2}(\.5)?$/,
  pants: /^[0-9A-Za-z/. ]{1,10}$/,
  phone: /^\+?[\d\s.\-()]{8,20}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  bankAccount: /^\d{6,30}$/,
  socialInsurance: /^\d{10}$/,
  personName: /^(?=.*\p{L})[^\d]+$/u,
}

function check(value, regex, message) {
  const v = text(value)
  return v && !regex.test(v) ? message : null
}

function phoneCheck(value, message, rejectAllZeros = false) {
  const v = text(value)
  if (!v) return null
  const digits = v.replace(/\D/g, '')
  const validFormat = REGEX.phone.test(v) && digits.length >= 8 && digits.length <= 15
  const allZeros = rejectAllZeros && /^0+$/.test(digits)
  return validFormat && !allZeros ? null : message
}

// Số trong khoảng; 0 và rỗng coi là chưa nhập.
function rangeCheck(value, min, max, message) {
  if (value === undefined || value === null || value === '' || Number(value) === 0) return null
  const n = Number(value)
  return !Number.isFinite(n) || n < min || n > max ? message : null
}

const day = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : '')

// Trả danh sách lỗi (chuỗi) của một bản ghi thuyền viên gửi lên.
function seafarerErrors(data, today = new Date().toISOString().slice(0, 10)) {
  const errors = [
    check(data.national_id, REGEX.idNumber, 'Số CCCD không hợp lệ: gồm 12 chữ số (CMND cũ 9 chữ số) và không được toàn số 0'),
    check(data.passport_number, REGEX.passport, 'Số hộ chiếu gồm 6–20 chữ và số, không có ký tự lạ'),
    check(data.seaman_book_number, REGEX.seamanBook, 'Số sổ thuyền viên gồm 3–30 chữ, số hoặc dấu - /'),
    check(data.shoe_size, REGEX.shoe, 'Size giày là số từ 30 đến 55 (VD: 42 hoặc 42.5)'),
    rangeCheck(data.shoe_size, 30, 55, 'Size giày là số từ 30 đến 55 (VD: 42 hoặc 42.5)'),
    check(data.pants_size, REGEX.pants, 'Size quần chỉ gồm số, chữ, dấu / và dấu chấm (VD: 30 / 32)'),
    rangeCheck(data.height_cm, 50, 300, 'Chiều cao từ 50 đến 300 cm'),
    rangeCheck(data.weight_kg, 20, 500, 'Cân nặng từ 20 đến 500 kg'),
    rangeCheck(data.children_count, 0, 30, 'Số con từ 0 đến 30'),
    phoneCheck(data.phone_primary, 'Số điện thoại không hợp lệ: gồm 8–15 chữ số và không được toàn số 0', true),
    phoneCheck(data.phone_secondary, 'Số điện thoại phụ không hợp lệ: gồm 8–15 chữ số và không được toàn số 0', true),
    check(data.email, REGEX.email, 'Email chưa đúng dạng'),
    check(data.social_insurance_number, REGEX.socialInsurance, 'Số BHXH gồm 10 chữ số'),
    check(data.full_name, REGEX.personName, 'Họ và tên phải có ít nhất một chữ cái và không chứa chữ số'),
    check(data.bank_account_number, REGEX.bankAccount, 'Số tài khoản gồm 6–30 chữ số'),
  ]
  if (Number(data.children_count) < 0 || Number(data.height_cm) < 0 || Number(data.weight_kg) < 0) errors.push('Số không được âm')
  for (const key of ['date_of_birth', 'passport_issued_date', 'national_id_issued_date']) {
    if (day(data[key]) > today) errors.push('Ngày sinh và ngày cấp không được sau hôm nay')
  }
  if (day(data.passport_issued_date) && day(data.passport_expiry) && day(data.passport_expiry) < day(data.passport_issued_date)) {
    errors.push('Ngày hết hạn hộ chiếu phải sau ngày cấp')
  }
  if (day(data.date_of_birth) && day(data.passport_issued_date) && day(data.passport_issued_date) < day(data.date_of_birth)) {
    errors.push('Ngày cấp hộ chiếu không được trước ngày sinh')
  }
  if (day(data.date_of_birth) && day(data.national_id_issued_date) && day(data.national_id_issued_date) < day(data.date_of_birth)) {
    errors.push('Ngày cấp CCCD không được trước ngày sinh')
  }
  for (const [i, row] of (Array.isArray(data.bank_accounts) ? data.bank_accounts : []).entries()) {
    const e = check(row?.account_number, REGEX.bankAccount, `Tài khoản ${i + 1}: số tài khoản gồm 6–30 chữ số`) || check(row?.account_holder, REGEX.personName, `Tài khoản ${i + 1}: tên chủ tài khoản phải có ít nhất một chữ cái và không chứa chữ số`)
    if (e) errors.push(e)
  }
  for (const [i, row] of (Array.isArray(data.contacts) ? data.contacts : []).entries()) {
    const e =
      phoneCheck(row?.phone_primary, `Người thân ${i + 1}: số điện thoại không hợp lệ, gồm 8–15 chữ số và không được toàn số 0`, true) ||
      check(row?.guarantor_id_number, REGEX.idNumber, `Người thân ${i + 1}: số CCCD không hợp lệ, gồm 12 chữ số (CMND cũ 9 chữ số) và không được toàn số 0`) ||
      check(row?.full_name, REGEX.personName, `Người thân ${i + 1}: họ tên phải có ít nhất một chữ cái và không chứa chữ số`)
    if (e) errors.push(e)
  }
  return [...new Set(errors.filter(Boolean))]
}

// Ném 400 với lỗi đầu tiên (kèm số lỗi còn lại) khi dữ liệu sai quy tắc.
function assertSeafarerData(data) {
  const errors = seafarerErrors(data || {})
  if (errors.length) throw { statusCode: 400, message: errors.length > 1 ? `${errors[0]} (còn ${errors.length - 1} lỗi nữa)` : errors[0] }
}


REGEX.taxId = /^[0-9A-Za-z\-. ]{5,50}$/
REGEX.website = /^https?:\/\/[^\s/]+\.[^\s/]+\S*$/i
REGEX.callSign = /^[A-Z0-9]{3,10}$/i
REGEX.mmsi = /^(?!0{9}$)\d{9}$/
REGEX.code = /^[A-Za-z0-9_.-]{1,30}$/
REGEX.unLocode = /^[A-Za-z]{2}[A-Za-z0-9]{3}$/

function websiteCheck(value) {
  const website = text(value)
  if (!website) return null
  const message = 'URL không hợp lệ. Website phải dùng http:// hoặc https:// và có cổng hợp lệ.'
  if (!REGEX.website.test(website)) return message
  try {
    new URL(website)
    return null
  } catch {
    return message
  }
}

// Có chữ thật (không chỉ khoảng trắng) khi có giá trị.
function blankCheck(value, message) {
  return value !== undefined && value !== null && String(value) !== '' && !String(value).trim() ? message : null
}

function maxCheck(value, max, message) {
  return value !== undefined && value !== null && Number(value) > max ? message : null
}

function throwFirst(errors) {
  const list = [...new Set(errors.filter(Boolean))]
  if (list.length) throw { statusCode: 400, message: list.length > 1 ? `${list[0]} (còn ${list.length - 1} lỗi nữa)` : list[0] }
}

function ownerErrors(data) {
  const errors = [
    blankCheck(data.company_name, 'Tên công ty không được để trống'),
    check(data.tax_id, REGEX.taxId, 'Mã số thuế gồm 5–50 chữ, số hoặc dấu - .'),
    text(data.tax_id) && !/[0-9A-Za-z]/.test(text(data.tax_id)) ? 'Mã số thuế phải có ít nhất một chữ hoặc số' : null,
    /^0+$/.test(text(data.tax_id).replace(/[\s.-]/g, '')) ? 'Mã số thuế không hợp lệ: không được toàn số 0' : null,
    phoneCheck(data.phone, 'Số điện thoại công ty không hợp lệ: gồm 8–15 chữ số và không được toàn số 0', true),
    phoneCheck(data.fax, 'Fax gồm 8–15 chữ số'),
    check(data.email, REGEX.email, 'Email phải có dạng ten@congty.com'),
    websiteCheck(data.website),
  ]
  for (const [i, row] of (Array.isArray(data.contacts) ? data.contacts : []).entries()) {
    errors.push(
      phoneCheck(row?.phone, `Người liên hệ ${i + 1}: điện thoại gồm 8–15 chữ số`) ||
        check(row?.email, REGEX.email, `Người liên hệ ${i + 1}: email chưa đúng dạng`) ||
        blankCheck(row?.name, `Người liên hệ ${i + 1}: họ tên không được để trống`)
    )
  }
  return errors.filter(Boolean)
}

function vesselErrors(data, year = new Date().getFullYear()) {
  const positive = (key, label, max, zeroIsEmpty = true) => {
    const v = data[key]
    if (v === undefined || v === null || v === '' || (zeroIsEmpty && Number(v) === 0)) return null
    return !(Number(v) > 0) || Number(v) > max ? `${label} phải là số dương, không quá ${max.toLocaleString('en-US')}` : null
  }
  const errors = [
    blankCheck(data.vessel_name, 'Tên tàu không được để trống'),
    check(data.call_sign, REGEX.callSign, 'Call Sign gồm 3–10 chữ và số'),
    check(data.mmsi, REGEX.mmsi, 'MMSI không hợp lệ: phải gồm 9 chữ số và không được toàn số 0'),
    maxCheck(data.year_built, year + 10, `Năm đóng không quá ${year + 10}`),
    positive('gross_tonnage', 'GRT', 1000000),
    positive('net_tonnage', 'NT', 1000000),
    positive('deadweight', 'DWT', 1000000),
    positive('length_overall', 'LOA', 600, false),
    positive('engine_power_kw', 'Công suất máy', 500000),
    maxCheck(data.passenger_capacity, 20000, 'Sức chứa hành khách không quá 20,000'),
    maxCheck(data.crew_capacity, 10000, 'Định biên thuyền viên không quá 10,000'),
  ]
  if (Number(data.net_tonnage) > 0 && Number(data.gross_tonnage) > 0 && Number(data.net_tonnage) > Number(data.gross_tonnage)) errors.push('NT không được lớn hơn GRT')
  return errors.filter(Boolean)
}

const MASTER_NAME_MAX = { certificate_type: 200, vessel_type: 100, contract_type: 100, country: 100, port: 150 }

// Danh mục: mã, tên, cảng. Chỉ kiểm trường có trong body.
function masterErrors(table, body) {
  const max = MASTER_NAME_MAX[table] || 100
  const errors = []
  if (table !== 'country' && 'code' in body) {
    errors.push(!REGEX.code.test(String(body.code ?? '').trim()) ? 'Mã gồm 1–30 chữ, số hoặc dấu _ . -' : null)
  }
  for (const key of ['name_vi', 'name_en', 'name']) {
    if (!(key in body)) continue
    const v = body[key] == null ? '' : String(body[key]).trim()
    if (v.length > max) errors.push(`Tên không quá ${max} ký tự`)
    if (key === 'name' && !v) errors.push('Nhập tên cảng')
  }
  if ('issuing_authority' in body && String(body.issuing_authority ?? '').trim().length > 200) errors.push('Cơ quan cấp không quá 200 ký tự')
  if ('validity_years' in body && body.validity_years != null && body.validity_years !== '') {
    const n = Number(body.validity_years)
    if (!Number.isInteger(n) || n < 1 || n > 99) errors.push('Hiệu lực là số năm nguyên từ 1 đến 99')
  }
  if ('un_locode' in body && body.un_locode && !REGEX.unLocode.test(String(body.un_locode).trim())) errors.push('UN/LOCODE gồm 5 ký tự: 2 chữ rồi 3 chữ hoặc số')
  return errors.filter(Boolean)
}

const assertOwnerData = (data) => throwFirst(ownerErrors(data || {}))
const assertVesselData = (data) => throwFirst(vesselErrors(data || {}))
const assertMasterData = (table, body) => throwFirst(masterErrors(table, body || {}))

module.exports = { seafarerErrors, assertSeafarerData, ownerErrors, assertOwnerData, vesselErrors, assertVesselData, masterErrors, assertMasterData }
