// CV chủ tàu Trung Quốc: mẫu này không dùng mã HDxx mà điền thẳng vào ô theo địa chỉ.
// Sheet chính: thông tin cá nhân (dòng 5-14), giấy tờ và chứng chỉ (17-41), 5 lần đi tàu gần nhất (cột C-G, dòng 43-57).
// Sheet "CREW LIST": một dòng thuyền viên.

const SERVICE_COLUMNS = ['C', 'D', 'E', 'F', 'G']
const { markCell } = require('../utils/form_fields')

// Dòng chứng chỉ trên mẫu ← mã certificate_type.
const CERTIFICATE_ROWS = {
  17: ['PASSPORT'],
  18: ['SEAMAN-BOOK', 'SEAMAN_BOOK'],
  20: ['COMPETENCY_DECK', 'COMPETENCY_ENGINE', 'OOW-DECK', 'OOW-ENGINE', 'CHIEF-MATE', 'MASTER', 'CHIEF-ENGINEER', 'SECOND-ENGINEER'],
  21: ['GOC', 'GMDSS-GOC', 'GMDSS-ROC', 'COMPETENCY_RADIO'],
  23: ['BASIC_TRAINING', 'STCW-BASIC'],
  24: ['PSCRB'],
  25: ['AFF'],
  26: ['MFA', 'MEFA'],
  27: ['MC'],
  28: ['SECURITY_AWARENESS', 'SECURITY-AWARE'],
  29: ['SECURITY_DUTIES', 'DESIGNATED-SEC'],
  30: ['SSO'],
  31: ['MEDICAL-FITNESS', 'MEDICAL_FITNESS'],
  32: ['TANKER_CHEMICAL', 'TANKER-CHEM-BASIC'],
  33: ['TANKER-CHEM-ADV'],
  34: ['TANKER_OIL', 'TANKER-OIL-BASIC'],
  35: ['TANKER-OIL-ADV'],
  37: ['RADAR_OBSERVATION'],
  39: ['ARPA', 'RADAR-ARPA'],
}

const pad = (n) => String(n).padStart(2, '0')
const fmt = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}
const text = (value) => (value === null || value === undefined ? '' : String(value))

// Số tháng trên tàu, tối thiểu 1; chưa rời tàu thì để trống.
function monthsOnBoard(signOn, signOff) {
  if (!signOn || !signOff) return ''
  const a = new Date(signOn)
  const b = new Date(signOff)
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0)
  return String(Math.max(1, months))
}

// Mỗi dòng chứng chỉ lấy bản cấp gần nhất trong các loại khớp.
function certificateByRow(certificates) {
  const rows = {}
  for (const [row, codes] of Object.entries(CERTIFICATE_ROWS)) {
    const found = certificates.filter((c) => codes.includes(c.type_code))
    if (found.length) rows[row] = found[found.length - 1]
  }
  return rows
}

async function loadCvData(pool, seafarerId) {
  const [[seafarer]] = await pool.query(
    `SELECT s.*, r.name_en AS rank_name_en, r.name_vi AS rank_name_vi, c.name_en AS nationality_name
     FROM seafarer s LEFT JOIN rank r ON r.id = s.current_rank_id LEFT JOIN country c ON c.id = s.nationality_id
     WHERE s.id = ? AND s.deleted_at IS NULL`,
    [seafarerId]
  )
  if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
  const [certificates] = await pool.query(
    `SELECT sc.certificate_number, sc.issued_date, sc.expiry_date, sc.issued_by, t.code AS type_code
     FROM seafarer_certificate sc JOIN certificate_type t ON t.id = sc.certificate_type_id
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL AND sc.status <> 'REVOKED'
     ORDER BY sc.issued_date, sc.id`,
    [seafarerId]
  )
  const [services] = await pool.query(
    `SELECT ss.*, r.name_en AS rank_name_en FROM sea_service ss LEFT JOIN rank r ON r.id = ss.rank_id
     WHERE ss.seafarer_id = ? AND ss.deleted_at IS NULL
     ORDER BY ss.sign_on_date DESC, ss.id DESC LIMIT ?`,
    [seafarerId, SERVICE_COLUMNS.length]
  )
  const [contacts] = await pool.query(
    'SELECT full_name, relationship, phone_primary, address FROM seafarer_contact WHERE seafarer_id = ? AND is_guarantor = 0 ORDER BY is_emergency_contact DESC, id LIMIT 1',
    [seafarerId]
  )
  return { seafarer, certificates, services, kin: contacts[0] || null }
}

// Ô → giá trị cho sheet chính. Tách riêng để test không cần DB.
function cvCells({ seafarer: s, certificates, services, kin }, today = new Date()) {
  const cells = {
    B5: text(s.rank_name_en || s.rank_name_vi),
    G5: `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`,
    D7: text(s.full_name_en || s.full_name).toUpperCase(),
    F7: text(s.nationality_name),
    B8: text(s.place_of_birth),
    D8: fmt(s.date_of_birth),
    F8: text(s.national_id),
    B9: text(s.height_cm),
    D9: text(s.shoe_size),
    F9: text(s.marital_status),
    B10: text(s.weight_kg),
    D10: text(s.shirt_size),
    F10: text(s.blood_type),
    B11: text(s.permanent_address),
    F11: text(s.phone_primary),
    B12: text(s.education_school),
    F12: text(s.education_major),
    D13: kin ? `${kin.full_name}${kin.relationship ? ` (${kin.relationship})` : ''}` : '',
    F13: text(kin?.phone_primary),
    B14: text(kin?.address || s.contact_address),
  }
  // Hộ chiếu, sổ thuyền viên, giấy khám sức khỏe có sẵn trên hồ sơ; chứng chỉ cùng loại (nếu có) ghi đè.
  const papers = {
    17: { certificate_number: s.passport_number, issued_date: s.passport_issued_date, expiry_date: s.passport_expiry },
    18: { certificate_number: s.seaman_book_number, expiry_date: s.seaman_book_expiry },
    31: { certificate_number: s.medical_cert_number, expiry_date: s.medical_cert_expiry },
    ...certificateByRow(certificates),
  }
  for (const [row, paper] of Object.entries(papers)) {
    cells[`D${row}`] = text(paper.certificate_number)
    cells[`E${row}`] = fmt(paper.issued_date)
    cells[`F${row}`] = fmt(paper.expiry_date)
    cells[`G${row}`] = text(paper.issued_by)
  }
  services.forEach((service, i) => {
    const col = SERVICE_COLUMNS[i]
    cells[`${col}43`] = text(service.owner_raw)
    cells[`${col}44`] = text(service.vessel_name_raw)
    cells[`${col}45`] = text(service.rank_name_en || service.rank_raw)
    cells[`${col}46`] = text(service.vessel_type_raw)
    cells[`${col}47`] = text(service.flag_raw)
    cells[`${col}49`] = text(service.gross_tonnage_raw)
    cells[`${col}53`] = text(service.engine_power_raw)
    cells[`${col}54`] = fmt(service.sign_on_date)
    cells[`${col}55`] = fmt(service.sign_off_date)
    cells[`${col}56`] = monthsOnBoard(service.sign_on_date, service.sign_off_date)
    cells[`${col}57`] = text(service.notes)
  })
  return cells
}

function crewListCells({ seafarer: s }) {
  return {
    B3: text(s.full_name_en || s.full_name).toUpperCase(),
    D3: text(s.rank_name_en || s.rank_name_vi),
    E3: fmt(s.date_of_birth),
    F3: text(s.place_of_birth),
    G3: text(s.seaman_book_number),
    I3: fmt(s.seaman_book_expiry),
    J3: text(s.passport_number),
    K3: fmt(s.passport_issued_date),
    L3: fmt(s.passport_expiry),
  }
}

// Điền workbook mẫu. Chưa chọn thuyền viên (xem trước mẫu trống) thì giữ nguyên mẫu.
async function fillCvTq(wb, sheet, seafarerId, pool) {
  if (!seafarerId) {
    for (const address of Object.keys(cvCells({ seafarer: {}, certificates: [], services: [], kin: null }))) markCell(sheet.getCell(address), '')
    return {}
  }
  const data = await loadCvData(pool, seafarerId)
  for (const [address, value] of Object.entries(cvCells(data))) {
    const cell = sheet.getCell(address)
    cell.value = value
    markCell(cell, value)
  }
  const crewList = wb.worksheets.find((ws) => /crew list/i.test(ws.name))
  if (crewList) for (const [address, value] of Object.entries(crewListCells(data))) crewList.getCell(address).value = value
  return data.seafarer
}

module.exports = { fillCvTq, cvCells, monthsOnBoard, certificateByRow, SERVICE_COLUMNS }
