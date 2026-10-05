'use strict'

const ExcelJS = require('exceljs')
const path = require('path')
const fs = require('fs')
const pool = require('../config/db')
const config = require('../config')

const CV_TEMPLATE_PATH = path.resolve(__dirname, '../../forms/CV china.xlsx')

const fmt = (d) => {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt)) return ''
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

const fmtDate = (d) => {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt)) return ''
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}

const CERT_ROWS = [
  { codes: ['PASSPORT'], row: 17 },
  { codes: ['SEAMAN_BOOK'], row: 18 },
  { codes: ['SEAFARER_ID_CARD'], row: 19 },
  {
    codes: [
      'MASTER',
      'CHIEF-MATE',
      'CHIEF-ENGINEER',
      'SECOND-ENGINEER',
      'OOW-DECK',
      'OOW-ENGINE',
      'WATCHKEEPING-DECK',
      'COMPETENCY_DECK',
      'COMPETENCY_ENGINE',
      'COMPETENCY_RADIO',
    ],
    row: 20,
  },
  { codes: ['GMDSS-GOC'], row: 21 },
  { codes: ['CERT_PROF_SEAFARERS'], row: 22 },
  { codes: ['BASIC_TRAINING'], row: 23 },
  { codes: ['PSCRB'], row: 24 },
  { codes: ['AFF'], row: 25 },
  { codes: ['MEFA'], row: 26 },
  { codes: ['MC'], row: 27 },
  { codes: ['SECURITY_AWARENESS'], row: 28 },
  { codes: ['SECURITY_DUTIES'], row: 29 },
  { codes: ['SSO'], row: 30 },
  { codes: ['MEDICAL_FITNESS'], row: 31 },
  { codes: ['TANKER_CHEMICAL'], row: 32 },
  { codes: ['TANKER-CHEM-ADV'], row: 33 },
  { codes: ['TANKER_OIL'], row: 34 },
  { codes: ['TANKER-OIL-ADV'], row: 35 },
  { codes: ['INERT_GAS_CRUDE_OIL_WASHING'], row: 36 },
  { codes: ['RADAR_OBSERVATION'], row: 37 },
  { codes: ['ELECTRONIC_NAV_AIDS'], row: 38 },
  { codes: ['ARPA'], row: 39 },
  { codes: ['SHIPBOARD_MANAGEMENT'], row: 40 },
  { codes: ['COVID19_VACCINATION'], row: 41 },
]

async function getSeafarerFull(seafarerId) {
  const [[s]] = await pool.query(
    `SELECT s.*,
            r.name_en AS rank_name_en,
            r.name_vi AS rank_name_vi,
            c.name_en AS nationality_name_en
     FROM seafarer s
     LEFT JOIN \`rank\` r ON r.id = s.current_rank_id
     LEFT JOIN country c ON c.id = s.nationality_id
     WHERE s.id = ? AND s.deleted_at IS NULL`,
    [seafarerId]
  )
  if (!s) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
  return s
}

async function getCertificates(seafarerId) {
  const [rows] = await pool.query(
    `SELECT sc.*, ct.name_vi, ct.name_en, ct.code
     FROM seafarer_certificate sc
     LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
       AND (sc.expiry_date IS NULL OR sc.expiry_date >= CURDATE())
     ORDER BY sc.issued_date ASC`,
    [seafarerId]
  )
  return rows
}

async function getNextOfKin(seafarerId) {
  const [rows] = await pool.query(
    `SELECT full_name, relationship, address, phone
     FROM seafarer_contact
     WHERE seafarer_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [seafarerId]
  )
  return rows[0] || null
}

async function getDeployments(seafarerId) {
  const [rows] = await pool.query(
    `SELECT sd.*, r.name_en AS rank_name_en,
            v.vessel_type, v.flag_country AS vessel_flag,
            v.gross_tonnage AS vessel_grt, v.deadweight AS vessel_dwt,
            v.engine_type AS vessel_engine_type, v.engine_power_kw AS main_engine_kw,
            v.trade_area AS operating_area,
            v.year_built AS vessel_year_built,
            v.ship_owner_name AS vessel_ship_owner
     FROM seafarer_deployment sd
     LEFT JOIN \`rank\` r ON r.id = sd.rank_id
     LEFT JOIN vessel v ON v.id = sd.vessel_id
     WHERE sd.seafarer_id = ?
     ORDER BY sd.join_date DESC
     LIMIT 5`,
    [seafarerId]
  )
  return rows
}

function matchCert(certs, codes) {
  const codeSet = new Set(codes.map((c) => c.toUpperCase()))
  return certs.find((c) => codeSet.has((c.code || '').toUpperCase()))
}

function getCvSheet(wb) {
  const byName = wb.getWorksheet('大副李庆光')
  if (byName) return byName
  const fallback = wb.worksheets.find((ws) => ws.actualRowCount > 1)
  if (!fallback) throw { statusCode: 500, message: 'Không tìm thấy sheet CV trong template' }
  return fallback
}

function setCell(ws, ref, value) {
  ws.getCell(ref).value = value ?? ''
}

function clearRange(ws, startRow, endRow, cols) {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      ws.getCell(`${c}${r}`).value = ''
    }
  }
}

const MARITAL_STATUS_EN = {
  'Độc thân': 'Single',
  'Đã kết hôn': 'Married',
}

function fillHeaderAndPersonal(ws, s, kin) {
  // C and E hold bilingual labels; F5 holds the date title — preserve all three
  clearRange(ws, 5, 14, ['B', 'D'])
  clearRange(ws, 6, 14, ['F'])

  setCell(ws, 'B5', s.rank_name_en || s.rank_name_vi || '')
  setCell(ws, 'G5', fmtDate(new Date()))
  setCell(ws, 'B7', s.full_name_cn || '')
  setCell(ws, 'D7', (s.full_name || '').toUpperCase())
  setCell(ws, 'F7', s.nationality_name_en || 'VIET NAM')
  setCell(
    ws,
    'B8',
    [s.permanent_ward, s.permanent_district, s.permanent_province].filter(Boolean).join(', ')
  )
  setCell(ws, 'D8', fmt(s.date_of_birth))
  setCell(ws, 'F8', s.national_id || '')
  setCell(ws, 'B9', s.height_cm ? String(s.height_cm) : '')
  setCell(ws, 'D9', s.shoe_size || '')
  setCell(ws, 'F9', (MARITAL_STATUS_EN[s.marital_status] || s.marital_status || '').toUpperCase())
  setCell(ws, 'B10', s.weight_kg ? String(s.weight_kg) : '')
  setCell(ws, 'D10', s.protective_size || '')
  setCell(ws, 'F10', s.blood_type || '')
  setCell(ws, 'B11', s.permanent_address || '')
  setCell(ws, 'F11', s.phone_primary || '')
  setCell(ws, 'B12', s.education_school || '')
  setCell(ws, 'F12', s.education_major || '')
  setCell(ws, 'B13', s.education_graduation_date ? fmt(s.education_graduation_date) : '')

  if (kin) {
    setCell(ws, 'D13', kin.full_name || '')
    setCell(ws, 'F13', kin.phone || '')
    setCell(ws, 'B14', kin.address || '')
  }
}

function fillCertificates(ws, certs, s) {
  // Clear sample certificate values first
  clearRange(ws, 17, 41, ['D', 'E', 'F', 'G'])

  for (const item of CERT_ROWS) {
    const cert = matchCert(certs, item.codes)
    setCell(ws, `D${item.row}`, cert?.certificate_number || '')
    setCell(ws, `E${item.row}`, cert?.issued_date ? fmt(cert.issued_date) : '')
    setCell(ws, `F${item.row}`, cert?.expiry_date ? fmt(cert.expiry_date) : '')
    setCell(ws, `G${item.row}`, cert?.place_of_issue || '')
  }

  setCell(ws, 'D17', s.passport_number || ws.getCell('D17').value || '')
  setCell(
    ws,
    'E17',
    s.passport_issued_date ? fmt(s.passport_issued_date) : ws.getCell('E17').value || ''
  )
  setCell(ws, 'F17', s.passport_expiry ? fmt(s.passport_expiry) : ws.getCell('F17').value || '')
  setCell(ws, 'D18', s.seaman_book_number || ws.getCell('D18').value || '')
  setCell(
    ws,
    'F18',
    s.seaman_book_expiry ? fmt(s.seaman_book_expiry) : ws.getCell('F18').value || ''
  )
}

function calcDurationMonths(joinDate, signOffDate) {
  if (!joinDate || !signOffDate) return ''
  const start = new Date(joinDate)
  const end = new Date(signOffDate)
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return String(Math.max(1, months))
}

function fillService(ws, deployments) {
  // Clear sample service records from template
  clearRange(ws, 43, 57, ['C', 'D', 'E', 'F', 'G'])

  const cols = ['C', 'D', 'E', 'F', 'G']
  for (let i = 0; i < Math.min(cols.length, deployments.length); i++) {
    const col = cols[i]
    const dep = deployments[i]
    setCell(ws, `${col}43`, dep.vessel_ship_owner || '')
    setCell(ws, `${col}44`, dep.vessel_name || '')
    setCell(ws, `${col}45`, dep.rank_name_en || '')
    setCell(ws, `${col}46`, dep.vessel_type || '')
    setCell(ws, `${col}47`, dep.vessel_flag || '')
    setCell(ws, `${col}48`, dep.operating_area || '')
    setCell(ws, `${col}49`, dep.vessel_grt != null ? Number(dep.vessel_grt) : '')
    setCell(ws, `${col}50`, dep.vessel_dwt != null ? Number(dep.vessel_dwt) : '')
    setCell(ws, `${col}51`, dep.vessel_year_built != null ? Number(dep.vessel_year_built) : '')
    setCell(ws, `${col}52`, dep.vessel_engine_type || '')
    setCell(ws, `${col}53`, dep.main_engine_kw != null ? Number(dep.main_engine_kw) : '')
    setCell(ws, `${col}54`, dep.join_date ? fmt(dep.join_date) : '')
    setCell(ws, `${col}55`, dep.sign_off_date ? fmt(dep.sign_off_date) : '')
    setCell(ws, `${col}56`, calcDurationMonths(dep.join_date, dep.sign_off_date))
    setCell(ws, `${col}57`, dep.notes || '')
  }
}

function getAvatarLocalPath(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null

  if (/^https?:\/\//i.test(avatarUrl)) return null

  const normalized = avatarUrl.replace(/\\/g, '/')
  const relative = normalized.startsWith('/uploads/')
    ? normalized.replace('/uploads/', '')
    : normalized.startsWith('uploads/')
      ? normalized.replace('uploads/', '')
      : normalized.replace(/^\/+/, '')

  const uploadRoot = path.resolve(process.cwd(), config.upload.dir)
  const fullPath = path.join(uploadRoot, relative)
  return fs.existsSync(fullPath) ? fullPath : null
}

function getImageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'png'
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg'
  return null
}

function fillAvatar(wb, ws, s) {
  const avatarPath = getAvatarLocalPath(s.avatar_url)
  if (!avatarPath) return

  const extension = getImageExtension(avatarPath)
  if (!extension) return

  // Clear "PHOTO" placeholder text in merged cell before inserting image
  setCell(ws, 'G7', '')

  const imageId = wb.addImage({
    filename: avatarPath,
    extension,
  })

  // Merge area is G:H and rows 7..11
  ws.addImage(imageId, {
    tl: { col: 6, row: 6 },
    br: { col: 8, row: 11 },
    editAs: 'oneCell',
  })
}

async function buildCV(seafarerId) {
  const [s, certs, deployments, kin] = await Promise.all([
    getSeafarerFull(seafarerId),
    getCertificates(seafarerId),
    getDeployments(seafarerId),
    getNextOfKin(seafarerId),
  ])

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(CV_TEMPLATE_PATH)
  const ws = getCvSheet(wb)

  fillHeaderAndPersonal(ws, s, kin)
  fillAvatar(wb, ws, s)
  fillCertificates(ws, certs, s)
  fillService(ws, deployments)

  const buffer = await wb.xlsx.writeBuffer()
  return { buffer, filename: `CV - ${s.full_name}.xlsx` }
}

module.exports = { buildCV }
