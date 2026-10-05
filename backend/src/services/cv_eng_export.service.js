'use strict'

const ExcelJS = require('exceljs')
const path = require('path')
const fs = require('fs')
const pool = require('../config/db')
const config = require('../config')

/** Same folder convention as CV.xlsx - typically `Marine projects/forms/` */
const CV_ENG_TEMPLATE_PATH = path.resolve(__dirname, '../../forms/CV eng.xlsx')

const SHEET_NAME = 'application form'

function fmtDdMmYy(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

/** Parse ngày về {y, mo, da} theo UTC+7 (local). Trả null nếu không hợp lệ. */
function parseDateParts(val) {
  if (val == null || val === '') return null
  if (typeof val === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(val.trim())
    if (m) {
      const y = Number(m[1])
      const mo = Number(m[2])
      const da = Number(m[3])
      if (y < 1900 || mo < 1 || da < 1) return null
      return { y, mo, da }
    }
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return { y: val.getFullYear(), mo: val.getMonth() + 1, da: val.getDate() }
  }
  const dt = new Date(val)
  if (Number.isNaN(dt.getTime())) return null
  return { y: dt.getFullYear(), mo: dt.getMonth() + 1, da: dt.getDate() }
}

/** Dùng cho isCertificateCurrentlyValid — so sánh ngày theo local. */
function toExcelDateOnly(val) {
  const p = parseDateParts(val)
  if (!p) return null
  return new Date(p.y, p.mo - 1, p.da)
}

/** Hộ chiếu thường 10 năm - dùng khi không có expiry trong DB/cert. */
function addCalendarYears(rawDate, years) {
  const p = parseDateParts(rawDate)
  if (!p || !Number.isFinite(years)) return null
  return { y: p.y + years, mo: p.mo, da: p.da }
}

/** Gán ô chứng chỉ dạng text dd/mm/yyyy theo UTC+7 — tránh ExcelJS convert timezone. */
function setExcelDateCell(ws, address, raw) {
  const cell = ws.getCell(address)
  const p = raw && typeof raw === 'object' && 'y' in raw ? raw : parseDateParts(raw)
  if (!p) {
    cell.value = ''
    return
  }
  cell.value = `${String(p.da).padStart(2, '0')}/${String(p.mo).padStart(2, '0')}/${p.y}`
}

function ageYears(dob) {
  if (!dob) return ''
  const d = dob instanceof Date ? dob : new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1
  return String(a)
}

async function getSeafarerFull(seafarerId) {
  const [[s]] = await pool.query(
    `SELECT s.*,
            r.name_en AS rank_name_en,
            r.name_vi AS rank_name_vi,
            c.name_en AS nationality_name_en,
            c.code AS nationality_code
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
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL`,
    [seafarerId]
  )
  return rows
}

async function getDeployments(seafarerId) {
  const [rows] = await pool.query(
    `SELECT sd.*,
            r.name_en AS rank_name_en,
            p.company_name_en AS partner_company_en,
            p.company_name AS partner_company_vi,
            v.vessel_type AS vessel_type,
            v.flag_country AS vessel_flag,
            v.gross_tonnage AS vessel_grt,
            v.deadweight AS vessel_dwt,
            v.engine_power_kw AS main_engine_kw,
            v.trade_area AS operating_area
     FROM seafarer_deployment sd
     LEFT JOIN \`rank\` r ON r.id = sd.rank_id
     LEFT JOIN \`job\` j ON j.id = sd.job_id AND j.deleted_at IS NULL
     LEFT JOIN partner p ON p.id = j.partner_id AND p.deleted_at IS NULL
     LEFT JOIN vessel v ON v.id = sd.vessel_id AND v.deleted_at IS NULL
     WHERE sd.seafarer_id = ? AND sd.status <> 'cancelled'
     ORDER BY sd.join_date DESC
     LIMIT 6`,
    [seafarerId]
  )
  return rows
}

function matchCert(certs, pattern) {
  const p = pattern.toUpperCase()
  return certs.find((c) => {
    const nameEn = (c.name_en || '').toUpperCase()
    const nameVi = (c.name_vi || '').toUpperCase()
    const code = (c.code || '').toUpperCase()
    return nameEn.includes(p) || nameVi.includes(p) || code.includes(p)
  })
}

function setCell(ws, address, value) {
  ws.getCell(address).value = value ?? ''
}

const ENGLISH_CV_LEVELS = new Set(['A', 'B', 'C'])

/** CV EN: Level tiếng Anh tổng quan - A / B / C (ô ENGLISH trong mẫu). */
function englishLevelLabel(s) {
  const fromLevel = String(s?.english_level ?? '')
    .trim()
    .toUpperCase()
  if (ENGLISH_CV_LEVELS.has(fromLevel)) return fromLevel
  const fromScoreCol = String(s?.english_score ?? '')
    .trim()
    .toUpperCase()
  if (ENGLISH_CV_LEVELS.has(fromScoreCol)) return fromScoreCol
  return ''
}

/** Type / GRT / DWT snapshot line */
function typeGrtLine(dep) {
  const parts = []
  if (dep.vessel_type) parts.push(dep.vessel_type)
  const grt =
    dep.vessel_grt != null && dep.vessel_grt !== ''
      ? Number(dep.vessel_grt)
      : dep.grt != null && dep.grt !== ''
        ? Number(dep.grt)
        : null
  const dwt =
    dep.vessel_dwt != null && dep.vessel_dwt !== ''
      ? Number(dep.vessel_dwt)
      : dep.dwt != null && dep.dwt !== ''
        ? Number(dep.dwt)
        : null
  const tg = []
  if (grt != null && !Number.isNaN(grt)) tg.push(`GRT ${grt}`)
  if (dwt != null && !Number.isNaN(dwt)) tg.push(`DWT ${dwt}`)
  return [parts.filter(Boolean).join(' '), tg.join(' / ')].filter(Boolean).join('\n')
}

function engineLine(dep) {
  if (dep.main_engine_kw == null || dep.main_engine_kw === '') return ''
  return `${dep.main_engine_kw} kW`
}

/** CV EN - cột Ship's Name / Company: dòng 1 «name /», dòng 2 tên đối tác (ưu tiên EN). */
function partnerCompanyLabelCvEng(dep) {
  const en = String(dep.partner_company_en ?? '').trim()
  const vi = String(dep.partner_company_vi ?? '').trim()
  return en || vi || ''
}

function shipNameCompanyCell(dep) {
  const ship = String(dep.vessel_name ?? '').trim()
  const partner = partnerCompanyLabelCvEng(dep)
  if (ship && partner) return `${ship} /\n${partner}`
  return ship || partner || ''
}

function trimAddressParts(s) {
  return (
    [s.permanent_address, s.permanent_ward, s.permanent_district, s.permanent_province]
      .filter(Boolean)
      .join(', ') ||
    s.permanent_address ||
    ''
  )
}

function fillBiodata(ws, s) {
  const rankTxt = (s.rank_name_en || s.rank_name_vi || '').trim()
  const nameEn = (s.full_name || '').trim().toUpperCase()
  const nat = (s.nationality_code || (s.nationality_name_en || '').slice(0, 8) || '').toUpperCase()

  setCell(ws, 'K4', rankTxt)
  setCell(ws, 'W4', nameEn)

  setCell(ws, 'K5', nat)
  if (s.date_of_birth) {
    const p = parseDateParts(s.date_of_birth)
    setCell(
      ws,
      'W5',
      p ? `${String(p.da).padStart(2, '0')}/${String(p.mo).padStart(2, '0')}/${p.y}` : ''
    )
  } else setCell(ws, 'W5', '')

  setCell(ws, 'AD5', ageYears(s.date_of_birth))

  setCell(ws, 'K6', trimAddressParts(s))
  setCell(ws, 'K7', s.phone_primary ? String(s.phone_primary) : '')
  fillMaritalCvEng(ws, s.marital_status)
  setCell(ws, 'K8', '')
}

/** CV eng: «Độc thân» → X tại AB7; «Đã kết hôn» → X tại AG7 (đúng ô checkbox mẫu). */
function fillMaritalCvEng(ws, maritalStatusRaw) {
  const ms =
    maritalStatusRaw == null || maritalStatusRaw === '' ? '' : String(maritalStatusRaw).trim()

  setCell(ws, 'AB7', '')
  setCell(ws, 'AG7', '')

  if (!ms) return

  /** Form admin và giá trị tiếng Anh thông dụng */
  const married = ms === 'Đã kết hôn' || /^married$/i.test(ms)
  const single = ms === 'Độc thân' || /^single$/i.test(ms)

  if (married) setCell(ws, 'AG7', 'X')
  else if (single) setCell(ws, 'AB7', 'X')
}

async function getLatestEducation(seafarerId) {
  const [rows] = await pool.query(
    `SELECT school_name, graduation_level, degree_rating, major, graduation_year, enrollment_year
     FROM seafarer_education
     WHERE seafarer_id = ? AND deleted_at IS NULL
     ORDER BY graduation_year DESC, id DESC
     LIMIT 1`,
    [seafarerId]
  )
  return rows[0] || null
}

function fillEducation(ws, s, edu) {
  setCell(ws, 'C11', (edu?.school_name || s.education_school || '').trim())
  setCell(ws, 'S11', (edu?.major || s.education_major || '').trim())
  if (edu?.enrollment_year) setCell(ws, 'AA11', String(edu.enrollment_year))
  if (edu?.graduation_year) setCell(ws, 'AE11', String(edu.graduation_year))
  setCell(ws, 'AI11', (edu?.degree_rating || edu?.graduation_level || '').trim())
}

function fillEnglish(ws, s) {
  const overall = englishLevelLabel(s).toUpperCase()
  const normalizeSkill = (raw) => {
    const v = String(raw ?? '')
      .trim()
      .toUpperCase()
    return v || overall || ''
  }

  /** Cột Level tổng quan */
  setCell(ws, 'M14', overall || '')

  /** Hàng 14: ưu tiên kỹ năng riêng, fallback về english_level (A/B/C). */
  setCell(ws, 'S14', normalizeSkill(s.english_listening))
  setCell(ws, 'Y14', normalizeSkill(s.english_spoken))
  setCell(ws, 'AE14', normalizeSkill(s.english_reading))
  setCell(ws, 'AK14', normalizeSkill(s.english_writing))
}

function fillSizes(ws, s) {
  setCell(ws, 'C18', s.height_cm != null ? String(s.height_cm) : '')
  setCell(ws, 'M18', s.weight_kg != null ? String(s.weight_kg) : '')
  setCell(ws, 'W18', s.protective_size || '')
  setCell(ws, 'AG18', s.shoe_size || '')
}

/**
 * Mẫu CV EN: 2 dòng cố định (PASSPORT 21, SEAMAN 22), sau đó là các dòng động cho
 * tất cả chứng chỉ còn hạn (bao gồm COC). Template mặc định có 2 slot động (23–24),
 * sea service bắt đầu từ row 25. Chèn dòng TRƯỚC tiêu đề sea khi cert nhiều hơn slot.
 */
const CERT_ROW_PASSPORT = 21
const CERT_ROW_SEAMAN = 22
const CERT_ROW_DYNAMIC_FIRST = 23
const CERT_ROW_DYNAMIC_LAST = 24
const CERT_DYNAMIC_SLOT_COUNT = CERT_ROW_DYNAMIC_LAST - CERT_ROW_DYNAMIC_FIRST + 1
/** Fallback khi không detect được khối sea. */
const SEA_HEADER_ROW_FALLBACK = CERT_ROW_DYNAMIC_LAST + 1
const SEA_SERVICE_ROW_COUNT = 6

function cellToPlainString(val) {
  if (val == null || val === '') return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val).trim()
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText
        .map((p) => p.text || '')
        .join('')
        .trim()
    }
    if (val.text != null) return String(val.text).trim()
    if (val.result != null) return String(val.result).trim()
  }
  return String(val).trim()
}

/** Chuẩn hóa id chứng chỉ (MYSQL bigint vs number) vào Set. */
function normalizedCertRowId(id) {
  if (id == null || id === '') return null
  if (typeof id === 'bigint') return id.toString()
  return String(id)
}

/**
 * Ghép toàn bộ text một hàng (cột 1–40) để tìm tiêu đề bảng sea service trong mẫu.
 */
function rowPlainText(ws, rowIdx) {
  let line = ''
  for (let c = 1; c <= 40; c += 1) {
    line += ` ${cellToPlainString(ws.getRow(rowIdx).getCell(c).value)}`
  }
  return line.toLowerCase()
}

/**
 * { seaHeaderRow, seaDataFirstRow } — chỉ đọc từ workbook mẫu, trước khi insert.
 * seaHeaderRow: insertRows nhận hàng tiêu đề sea; chứng chỉ thừa chèn tại chỉ số này.
 * seaDataFirstRow: hàng điền voyage đầu tiên trong mẫu (không có chèn — thường +1 sau header).
 */
function detectSeaSectionLayout(ws) {
  for (let r = CERT_ROW_DYNAMIC_FIRST; r <= 52; r += 1) {
    const s = rowPlainText(ws, r)
    if (!/\S/.test(s)) continue

    const reasonLeave = /reason\s*(?:of|for)\s+leaving/i.test(s)
    const tradingRank =
      /\btrading\s*area\b/i.test(s) && /\brank\b/i.test(s) && /\bratings?\b/i.test(s)
    const shipCompany =
      /\bship\b/i.test(s) &&
      (/\bcompany\b|công\s*ty/i.test(s) ||
        /\bship'?s\b\s*\bname\b/i.test(s) ||
        /\bname\b\s*\/\s*company\b/i.test(s))
    const seaServiceLbl = /\bsea\s*service\b/i.test(s)

    if (!(reasonLeave || tradingRank || shipCompany || seaServiceLbl)) continue

    /**
     * Nếu dòng detect là title section (“6. Sea Service”) chứ không phải
     * column header, thì column header ở r+1 và data bắt đầu từ r+2.
     * Nếu detect thẳng column header (có ship/company/rank/...) → data từ r+1.
     */
    const isColumnHeader = reasonLeave || tradingRank || shipCompany
    return { seaHeaderRow: r, seaDataFirstRow: isColumnHeader ? r + 1 : r + 2 }
  }
  return {
    seaHeaderRow: SEA_HEADER_ROW_FALLBACK,
    seaDataFirstRow: SEA_HEADER_ROW_FALLBACK + 2,
  }
}

function resolveSeaSectionLayout(ws) {
  let { seaHeaderRow, seaDataFirstRow } = detectSeaSectionLayout(ws)
  /** Không được coi hàng chứng chỉ động làm tiêu đề sea. */
  if (seaHeaderRow <= CERT_ROW_DYNAMIC_LAST) {
    seaHeaderRow = SEA_HEADER_ROW_FALLBACK
    seaDataFirstRow = SEA_HEADER_ROW_FALLBACK
  }
  /** Hậu-fix: không bao giờ data trước header (ví dụ sheet lệch ít cell). */
  if (seaDataFirstRow < seaHeaderRow) seaDataFirstRow = seaHeaderRow + 1
  return { seaHeaderRow, seaDataFirstRow }
}

function clearCertificateDataRow(ws, row) {
  setCell(ws, `C${row}`, '')
  setCell(ws, `Q${row}`, '')
  setExcelDateCell(ws, `AC${row}`, null)
  setExcelDateCell(ws, `AJ${row}`, null)
}

function certificateTypeLabelEn(c) {
  const en = (c.name_en || '').trim()
  if (en) return en
  const vi = (c.name_vi || '').trim()
  if (vi) return vi
  const code = (c.code || '').trim()
  return code || 'Certificate'
}

function isCertificateCurrentlyValid(c) {
  if (String(c.status || '').toUpperCase() === 'REVOKED') return false
  if (c.expiry_date == null || c.expiry_date === '') return true
  const exp = toExcelDateOnly(c.expiry_date)
  if (!exp) return true
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return exp >= today
}

function getCertificateDynamicPayload(certs) {
  const passportCert = matchCert(certs, 'PASSPORT')
  const seamanCert = matchCert(certs, 'SEAMAN')
  const passportId = normalizedCertRowId(passportCert?.id)
  const seamanId = normalizedCertRowId(seamanCert?.id)
  const fixedIds = new Set([passportId, seamanId].filter((id) => id != null))
  /** Tất cả cert còn hạn ngoài PASSPORT và SEAMAN đều vào dynamic rows (kể cả COC). */
  const extraValid = certs
    .filter((c) => {
      const kid = normalizedCertRowId(c.id)
      return kid != null && !fixedIds.has(kid) && isCertificateCurrentlyValid(c)
    })
    .sort((a, b) =>
      certificateTypeLabelEn(a).localeCompare(certificateTypeLabelEn(b), 'en', {
        sensitivity: 'base',
      })
    )
  return { passportCert, seamanCert, extraValid }
}

/**
 * Xóa stale merge entries tại các row vừa insert — ExcelJS không shift đúng
 * merge của các row ngay trước insertion point (bug ExcelJS 4.x).
 */
function clearStaleMergesAtRows(ws, fromRow, toRow) {
  Object.keys(ws._merges).forEach((addr) => {
    const r = ws._merges[addr]
    if (r.top < fromRow || r.top > toRow) return
    for (let row = r.top; row <= r.bottom; row++) {
      for (let col = r.left; col <= r.right; col++) {
        const cell = ws.getRow(row).getCell(col)
        cell._isMerged = false
        cell._mergeCount = 0
        delete cell._master
      }
    }
    delete ws._merges[addr]
  })
}

/**
 * Chèn dòng trước hàng tiêu đề sea, copy merge + border + alignment từ dòng cert.
 * insertRows('i') copy style nhưng ExcelJS để lại stale merges → cần fix thủ công.
 */
function insertCertificateOverflowRows(ws, rowCount, insertBeforeRow) {
  if (!rowCount || insertBeforeRow < 1) return

  const srcMerges = Object.values(ws._merges)
    .filter((r) => r.top === CERT_ROW_DYNAMIC_LAST)
    .sort((a, b) => a.left - b.left)
    .map((range) => {
      const master = ws.getRow(CERT_ROW_DYNAMIC_LAST).getCell(range.left)
      return {
        left: range.left,
        right: range.right,
        font: master.font ? { ...master.font } : {},
        border: master.border ? { ...master.border } : {},
        alignment: master.alignment ? { ...master.alignment } : { vertical: 'middle' },
      }
    })

  ws.insertRows(
    insertBeforeRow,
    Array.from({ length: rowCount }, () => []),
    'i'
  )

  clearStaleMergesAtRows(ws, insertBeforeRow, insertBeforeRow + rowCount - 1)

  for (let i = 0; i < rowCount; i++) {
    const r = insertBeforeRow + i
    for (const { left, right, font, border, alignment } of srcMerges) {
      ws.mergeCells(r, left, r, right)
      const master = ws.getRow(r).getCell(left)
      master.font = font
      master.border = border
      master.alignment = alignment
    }
  }
}

function fillCertificatesPassport(ws, s, certPayload, dynamicLastRow) {
  const lastDyn = dynamicLastRow ?? CERT_ROW_DYNAMIC_LAST
  const { passportCert, seamanCert, extraValid } = certPayload

  for (let r = CERT_ROW_DYNAMIC_FIRST; r <= lastDyn; r += 1) {
    clearCertificateDataRow(ws, r)
  }

  const docPass = passportCert?.certificate_number || s.passport_number || ''
  const issPass = passportCert?.issued_date
    ? passportCert.issued_date
    : s.passport_issued_date || null
  let expPass = passportCert?.expiry_date || s.passport_expiry || null
  if (!expPass && issPass) expPass = addCalendarYears(issPass, 10)

  setCell(ws, `C${CERT_ROW_PASSPORT}`, 'Passport')
  setCell(ws, `Q${CERT_ROW_PASSPORT}`, docPass)
  setExcelDateCell(ws, `AC${CERT_ROW_PASSPORT}`, issPass)
  setExcelDateCell(ws, `AJ${CERT_ROW_PASSPORT}`, expPass)

  const docSb = seamanCert?.certificate_number || s.seaman_book_number || ''
  const issSb = seamanCert?.issued_date ?? null
  const expSb = seamanCert?.expiry_date ?? null

  setCell(ws, `C${CERT_ROW_SEAMAN}`, 'Seaman\'s book')
  setCell(ws, `Q${CERT_ROW_SEAMAN}`, docSb)
  setExcelDateCell(ws, `AC${CERT_ROW_SEAMAN}`, issSb)
  setExcelDateCell(ws, `AJ${CERT_ROW_SEAMAN}`, expSb)

  let dynRow = CERT_ROW_DYNAMIC_FIRST
  for (const c of extraValid) {
    if (dynRow > lastDyn) break
    setCell(ws, `C${dynRow}`, certificateTypeLabelEn(c))
    setCell(ws, `Q${dynRow}`, c.certificate_number || '')
    setExcelDateCell(ws, `AC${dynRow}`, c.issued_date ?? null)
    setExcelDateCell(ws, `AJ${dynRow}`, c.expiry_date ?? null)
    dynRow += 1
  }
}

function fillSeaService(ws, deployments, seaFirstRow) {
  const seaRows = Array.from({ length: SEA_SERVICE_ROW_COUNT }, (_, i) => seaFirstRow + i)
  for (const row of seaRows) {
    setCell(ws, `C${row}`, '')
    setCell(ws, `L${row}`, '')
    setCell(ws, `R${row}`, '')
    setCell(ws, `X${row}`, '')
    setCell(ws, `AA${row}`, '')
    setCell(ws, `AD${row}`, '')
    setCell(ws, `AG${row}`, '')
    setCell(ws, `AL${row}`, '')
  }
  deployments.forEach((dep, idx) => {
    if (idx >= SEA_SERVICE_ROW_COUNT) return
    const row = seaRows[idx]
    const cSea = ws.getCell(`C${row}`)
    cSea.value = shipNameCompanyCell(dep)
    cSea.alignment = { ...cSea.alignment, wrapText: true }
    setCell(ws, `L${row}`, typeGrtLine(dep))
    setCell(ws, `R${row}`, engineLine(dep))
    setCell(ws, `X${row}`, dep.rank_name_en || '')
    setCell(ws, `AA${row}`, dep.vessel_flag || '')
    setCell(ws, `AD${row}`, dep.operating_area || '')
    const signBlock = [fmtDdMmYy(dep.join_date), fmtDdMmYy(dep.sign_off_date)]
      .filter(Boolean)
      .join('\n')
    const ag = ws.getCell(`AG${row}`)
    ag.value = signBlock
    ag.alignment = { ...ag.alignment, wrapText: true }
    setCell(ws, `AL${row}`, dep.notes || '')
  })
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

function fillAvatarEng(wb, ws, s) {
  const avatarPath = getAvatarLocalPath(s.avatar_url)
  if (!avatarPath) return

  const ext = path.extname(avatarPath).toLowerCase()
  let extension = null
  if (ext === '.png') extension = 'png'
  if (ext === '.jpg' || ext === '.jpeg') extension = 'jpeg'
  if (!extension) return

  try {
    if (wb.addImage && ws.addImage) {
      ws.getCell('AI2').value = ''
      const imageId = wb.addImage({ filename: avatarPath, extension })
      /** Ảnh phủ full ô merge avatar trong mẫu CV EN (AI2:AP8). */
      ws.addImage(imageId, 'AI2:AP8')
    }
  } catch {
    /** ảnh lỗi - bỏ qua để không chặn xuất file */
  }
}

async function ensureTemplate() {
  if (!fs.existsSync(CV_ENG_TEMPLATE_PATH)) {
    throw {
      statusCode: 500,
      message: `Không tìm thấy mẫu CV tiếng Anh tại ${CV_ENG_TEMPLATE_PATH}`,
    }
  }
}

async function buildCVEng(seafarerId) {
  await ensureTemplate()
  const [s, certs, deployments, edu] = await Promise.all([
    getSeafarerFull(seafarerId),
    getCertificates(seafarerId),
    getDeployments(seafarerId),
    getLatestEducation(seafarerId),
  ])

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(CV_ENG_TEMPLATE_PATH)
  /**
   * Tránh lỗi Excel Repair: một số template mang defined name không hợp lệ sau khi ghi lại.
   * Xóa defined names khỏi bản export để không phát sinh popup "Removed Records: Named range".
   */
  if (wb.definedNames && wb.definedNames.model) wb.definedNames.model = []
  /** ExcelJS tự sinh _xlnm.Print_Area/_xlnm.Print_Titles từ pageSetup.* khi ghi workbook.xml. */
  for (const sheet of wb.worksheets || []) {
    if (!sheet.pageSetup) continue
    delete sheet.pageSetup.printArea
    delete sheet.pageSetup.printTitlesRow
    delete sheet.pageSetup.printTitlesColumn
  }
  const ws = wb.getWorksheet(SHEET_NAME)
  if (!ws) throw { statusCode: 500, message: `Không tìm thấy sheet "${SHEET_NAME}" trong mẫu` }

  fillBiodata(ws, s)
  fillEducation(ws, s, edu)
  fillEnglish(ws, s)
  fillSizes(ws, s)
  const seaLayoutResolved = resolveSeaSectionLayout(ws)
  let { seaHeaderRow, seaDataFirstRow } = seaLayoutResolved
  let dynamicSlotsBaseline = seaHeaderRow - CERT_ROW_DYNAMIC_FIRST
  /** Không giảm dưới số slot mẫu (không đổi vị trí insert). */
  if (dynamicSlotsBaseline < CERT_DYNAMIC_SLOT_COUNT) dynamicSlotsBaseline = CERT_DYNAMIC_SLOT_COUNT

  const certPayload = getCertificateDynamicPayload(certs)
  const certOverflow = Math.max(0, certPayload.extraValid.length - dynamicSlotsBaseline)
  insertCertificateOverflowRows(ws, certOverflow, seaHeaderRow)
  const certDynamicLast = seaHeaderRow - 1 + certOverflow
  const seaFirstRow = seaDataFirstRow + certOverflow
  fillCertificatesPassport(ws, s, certPayload, certDynamicLast)
  fillSeaService(ws, deployments, seaFirstRow)
  fillAvatarEng(wb, ws, s)

  const buffer = await wb.xlsx.writeBuffer()
  const fname = (s.full_name || `seafarer-${seafarerId}`).trim()
  return { buffer, filename: `CV EN - ${fname}.xlsx` }
}

module.exports = { buildCVEng, CV_ENG_TEMPLATE_PATH }
