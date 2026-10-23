// form_export.service.js
// Fills HD-Hong form templates with seafarer data per QUY UOC mapping
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')
const pool = require('../config/db')
const { sheetToHtml, parseRange } = require('../utils/sheet_html')
const { fillCvTq } = require('./cv_tq_form.service')
const { vndWords, parseAmount } = require('../utils/vnd_words')
const { markCell, markParts, fillMarkedText, markInput } = require('../utils/form_fields')

// Thư mục mẫu Excel ở forms/ tại root dự án. Đặt FORMS_DIR nếu muốn dùng thư mục khác.
const FORMS_DIR = process.env.FORMS_DIR || path.resolve(__dirname, '../../../forms')

// Dòng thuyền viên thứ 2 trở đi trong QĐ điều động, QĐ rời tàu, Thư bảo lãnh: bộ giấy một người thì để trống.
const EXTRA_ROWS_BLANK = Object.fromEntries(
  [[67, 78], [86, 89], [111, 118]].flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => [`HD${from + i}`, '']))
)

// DATA column index (1-based, matching Excel columns A=1, B=2, ...)
// We map field names from DB to QUY UOC column letters
function buildSeafarerRow(s, owner) {
  // owner = row from danh_sach_chu_tau matched by s.ten_tau (ship name)
  const fmt = (d) => {
    if (!d) return ''
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt)) return String(d)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yyyy = dt.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  const addDays = (d, n) => {
    if (!d) return ''
    const dt = new Date(d instanceof Date ? d : new Date(d))
    dt.setDate(dt.getDate() + n)
    return fmt(dt)
  }
  const addYears = (d, n) => {
    if (!d) return ''
    const dt = new Date(d instanceof Date ? d : new Date(d))
    dt.setFullYear(dt.getFullYear() + n)
    return fmt(dt)
  }
  const ngayBay = s.contract_flight_date
  const ngayCap = s.passport_issued_date
  const now = new Date()
  const ddmm = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`
  const yyyy = String(now.getFullYear())

  return {
    ...EXTRA_ROWS_BLANK,
    // HĐ1
    HD1: s.seafarer_code || '',
    HD2: ngayBay ? String(new Date(ngayBay).getFullYear()).slice(-2) : '',
    HD3: addDays(ngayBay, -20),
    HD4: s.full_name || '',
    HD5: fmt(s.date_of_birth),
    HD6: s.permanent_address || '',
    HD7: s.passport_number || '',
    HD8: fmt(ngayCap),
    HD9: 'CỤC QUẢN LÝ XUẤT NHẬP CẢNH',
    HD10: s.national_id || '',
    HD11: fmt(s.national_id_issued_date),
    HD12: s.national_id_issued_place || '',
    HD13: '', // emergency_contact_name — not in current schema
    HD14: s.permanent_address || '',
    HD15: '', // emergency_contact_relation
    HD16: '', // emergency_contact_phone
    HD17: owner ? fmt(owner.contract_date) : '',
    HD18: owner ? owner.name || '' : '',
    HD19: s.vessel_name_raw || '',
    HD20: s.rank_name_vi || '',
    HD21: s.vessel_name_raw || '',
    HD22: owner ? owner.name || '' : '',
    HD23: owner ? owner.representative || '' : '',
    HD24: owner ? owner.rep_title || '' : '',
    HD25: owner ? owner.address || '' : '',
    HD26: s.contract_salary_raw != null ? String(s.contract_salary_raw) : '',
    HD27: s.bank_account_holder || '',
    HD28: s.bank_name || '',
    HD29: s.bank_account_number || '',
    // Bao hiem
    HD30: s.full_name || '',
    HD31: fmt(s.date_of_birth),
    HD32: s.permanent_address || '',
    HD33: s.permanent_address || '',
    HD34: s.national_id || '',
    HD35: fmt(s.national_id_issued_date),
    HD36: s.rank_name_vi || '',
    // Don tham gia BH (QUY UOC: H37=tên, H38=địa chỉ, H39=tàu, H40=CCCD, H41=ngày cấp)
    H37: s.full_name || '',
    H38: s.permanent_address || '',
    H39: s.vessel_name_raw || '',
    H40: s.national_id || '',
    H41: fmt(s.national_id_issued_date),
    // UY QUYEN
    HD42: s.full_name || '',
    H43: s.vessel_name_raw || '',
    HD44: fmt(s.date_of_birth),
    HD45: owner ? owner.name || '' : '',
    HD46: s.rank_name_vi || '',
    HD47: s.bank_account_holder || '',
    HD48: s.bank_account_number || '',
    HD49: s.bank_name || '',
    // UY QUYEN CA NHAN
    HD50: s.full_name || '',
    HD51: fmt(s.date_of_birth),
    HD52: s.national_id || '',
    HD53: fmt(s.national_id_issued_date),
    HD54: s.national_id_issued_place || '',
    HD55: s.permanent_address || '',
    HD56: s.bank_account_holder || '',
    HD57: s.bank_account_number || '',
    HD58: s.bank_name || '',
    // QD dieu dong
    HD59: fmt(ngayBay),
    HD60: ddmm,
    HD61: yyyy,
    HD62: s.vessel_name_raw || '',
    HD63: s.full_name || '',
    HD64: s.rank_name_vi || '',
    HD65: fmt(s.date_of_birth),
    HD66: s.passport_number || '',
    HD79: '', // điền tay
    HD80: s.vessel_name_raw || '',
    HD81: owner ? owner.name || '' : '',
    // Thu bao lanh
    HD82: s.full_name || '',
    HD83: fmt(s.date_of_birth),
    HD84: s.passport_number || '',
    HD85: addYears(ngayCap, 10),
    HD90: s.vessel_name_raw || '',
    HD91: owner ? owner.name || '' : '',
    HD92: '', // điền tay
    HD93: '', // điền tay
    // Phieu thu
    H94: ngayBay ? String(new Date(ngayBay).getDate()).padStart(2, '0') : '',
    H95: ngayBay ? String(new Date(ngayBay).getMonth() + 1).padStart(2, '0') : '',
    H96: ngayBay ? String(new Date(ngayBay).getFullYear()) : '',
    H97: s.full_name || '',
    H98: s.permanent_address || '',
    // TB trung tuyen
    HD99: addDays(ngayBay, -50),
    HD100: s.full_name || '',
    // KQ thi tuyen
    HD101: s.full_name || '',
    HD102: s.rank_name_vi || '',
    // QD roi tau
    HD103: fmt(s.contract_end_date || now),
    HD104: ddmm,
    HD105: yyyy,
    HD106: s.vessel_name_raw || '',
    HD107: s.full_name || '',
    HD108: s.rank_name_vi || '',
    HD109: fmt(s.date_of_birth),
    HD110: s.passport_number || '',
    HD119: s.vessel_name_raw || '',
    HD120: owner ? owner.name || '' : '',
    // Thanh ly
    HD121: s.full_name || '',
    HD122: fmt(s.date_of_birth),
    HD123: s.passport_number || '',
    HD124: s.permanent_address || '',
    HD125: s.rank_name_vi || '',
    HD126: owner ? owner.name || '' : '',
    HD127: s.vessel_name_raw || '',
  }
}

// Multi-seafarer placeholders for QD dieu dong (rows 2-4) and QD roi tau (rows 2-3)
// and Thu bao lanh (row 2)
function buildMultiRow(s, idx) {
  const fmt = (d) => {
    if (!d) return ''
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt)) return String(d)
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
  }
  const addYears = (d, n) => {
    if (!d) return ''
    const dt = new Date(d instanceof Date ? d : new Date(d))
    dt.setFullYear(dt.getFullYear() + n)
    return fmt(dt)
  }
  const ngayCap = s.passport_issued_date || s.ngay_cap_hc
  const base = (idx - 1) * 4
  return {
    [`HD${63 + base}`]: s.full_name || '',
    [`HD${64 + base}`]: s.rank_name_vi || s.rank_name || '',
    [`HD${65 + base}`]: fmt(s.date_of_birth),
    [`HD${66 + base}`]: s.passport_number || '',
    // QD roi tau rows 2-3 (HD111-118)
    [`HD${107 + (idx - 1) * 4}`]: s.full_name || '',
    [`HD${108 + (idx - 1) * 4}`]: s.rank_name_vi || s.rank_name || '',
    [`HD${109 + (idx - 1) * 4}`]: fmt(s.date_of_birth),
    [`HD${110 + (idx - 1) * 4}`]: s.passport_number || '',
    // Thu bao lanh row 2
    HD86: s.full_name || '',
    HD87: fmt(s.date_of_birth),
    HD88: s.passport_number || '',
    HD89: addYears(ngayCap, 10),
  }
}

async function getSeafarerData(seafarerId) {
  const [rows] = await pool.query(
    `SELECT s.*,
            r.name_vi as rank_name_vi,
            r.name_en as rank_name_en
     FROM seafarer s
     LEFT JOIN "rank" r ON r.id = s.current_rank_id
     WHERE s.id = ? AND s.deleted_at IS NULL`,
    [seafarerId]
  )
  if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
  return rows[0]
}

async function getOwnerByVessel(vesselName) {
  if (!vesselName) return null
  // Try DB first, fall back to static data from the Excel file
  try {
    const [rows] = await pool.query('SELECT * FROM ship_owner WHERE unaccent(vessel_name::text) ILIKE unaccent(?) LIMIT 1', [
      `%${vesselName}%`,
    ])
    if (rows[0]) return rows[0]
  } catch {
    /* table may not exist */
  }

  // Static fallback from danh sách chủ tàu.xlsx (single entry currently)
  return {
    name: 'SINOSTAR CREW MANNING CO.,LIMITED',
    representative: 'Mr.Tan Jun',
    rep_title: 'Giám Đốc',
    address:
      '1602&1603 Room, 23F, Block B, 3rd Building, No 20 Zhuzhou road, Qingdao, Shandong, P.R. China',
    contract_date: new Date('2023-12-15'),
  }
}

// Chủ tàu chọn ở ô "Nộp cho" của bộ giấy.
async function getOwnerById(shipOwnerId) {
  const [[row]] = await pool.query(
    `SELECT o.company_name, o.address,
            (SELECT ct.name FROM ship_owner_contact ct WHERE ct.ship_owner_id = o.id ORDER BY ct.is_primary DESC, ct.sort_order, ct.id LIMIT 1) AS contact_person
     FROM ship_owner o WHERE o.id = ? AND o.deleted_at IS NULL`,
    [shipOwnerId]
  )
  if (!row) return null
  return { name: row.company_name, representative: row.contact_person || '', rep_title: '', address: row.address || '', contract_date: null }
}

// Mã điền trong mẫu: HD4, H37, và cả kiểu viết rời "HD 101". Mã không có trong dữ liệu thì giữ nguyên.
function fillText(text, data) {
  return fillMarkedText(text, data).value
}

// Sheet in ra: sheet đầu tiên đang hiện và có nội dung (mẫu CV có một sheet ẩn đứng trước).
const mainSheet = (wb) => wb.worksheets.find((ws) => ws.state === 'visible' && ws.rowCount > 0) || wb.worksheets[0]

async function openTemplate(formFileName) {
  const templatePath = path.join(FORMS_DIR, formFileName)
  if (!fs.existsSync(templatePath)) throw { statusCode: 404, message: 'Chưa có file mẫu trên máy chủ' }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(templatePath)
  if (!mainSheet(wb)) throw { statusCode: 422, message: 'Không đọc được file mẫu' }
  return wb
}

async function fillWorkbook(formFileName, data) {
  const wb = await openTemplate(formFileName)
  const ws = mainSheet(wb)

  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.isMerged && cell.master !== cell) return
      const v = cell.value
      if (typeof v === 'string') {
        const filled = fillMarkedText(v, data, new Set(Object.keys(EXTRA_ROWS_BLANK)))
        if (filled.value !== v) cell.value = filled.value
        markParts(cell, filled.parts)
      } else if (v?.richText) {
        let offset = 0
        const parts = []
        cell.value = { richText: v.richText.map((run) => {
          const filled = fillMarkedText(run.text, data, new Set(Object.keys(EXTRA_ROWS_BLANK)))
          parts.push(...filled.parts.map((part) => ({ ...part, start: part.start + offset, end: part.end + offset })))
          offset += filled.value.length
          return { ...run, text: filled.value }
        }) }
        markParts(cell, parts)
      }
    })
  })
  return wb
}

async function loadFormData(seafarerId, { shipOwnerId, inputs = {} } = {}) {
  const seafarer = seafarerId ? await getSeafarerData(seafarerId) : {}
  if (inputs['Tên tàu']) seafarer.vessel_name_raw = inputs['Tên tàu']
  const owner = (shipOwnerId && (await getOwnerById(shipOwnerId))) || (await getOwnerByVessel(seafarer.vessel_name_raw))
  return { seafarer, data: buildSeafarerRow(seafarer, owner) }
}

// "Thông tin điền thêm" của từng giấy → ô trên mẫu đó. Mỗi đích: [địa chỉ ô, (giá trị gõ, nội dung ô hiện có) => nội dung mới].
// "Tên tàu" không nằm ở đây: nó thay tên tàu của hồ sơ nên đi qua các mã HDxx.
const set = (cell) => [cell, (value) => value]
const after = (cell) => [cell, (value, current) => `${String(current ?? '').trimEnd()} ${value}`]
const DOTS = '[….]+'
function fillDate(value, current) {
  const date = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim())
  const written = date ? `ngày ${date[1].padStart(2, '0')} tháng ${date[2].padStart(2, '0')} năm ${date[3]}` : `ngày ${value}`
  return String(current ?? '').replace(new RegExp(`ngày\\s*${DOTS}\\s*tháng\\s*${DOTS}\\s*năm\\s*${DOTS}`, 'i'), written)
}
// Số tiền không đọc được thì trả undefined: giữ nguyên ô của mẫu.
const amount = (format) => (value) => {
  const number = parseAmount(value)
  return number === null ? undefined : format(number)
}
const INPUT_CELLS = {
  tb_trung_tuyen: { 'Ngày có mặt': [after('A15')] },
  phieu_thu: {
    'Số tiền': [['B7', amount((n) => n)], ['A8', amount((n) => `(${vndWords(n)})`)], ['F10', amount((n) => `${vndWords(n)}./.`)]],
    'Lý do thu': [set('C6')],
  },
  qd_dieu_dong: { 'Ngày xuống tàu': [after('B25')] },
  don_bh: { 'Mức đóng': [['E17', (value) => `Mức đóng : ${value}`]] },
  uy_quyen_cn: { 'Người được ủy quyền': [set('B16')] },
  uy_quyen: { 'Người nhận lương': [set('C31')] },
  qd_roi_tau: { 'Cảng rời tàu': [after('B22')], 'Ngày rời tàu': [after('B23')] },
  thanh_ly: { 'Ngày thanh lý': [['A13', fillDate]] },
}

function applyInputs(ws, formKey, inputs = {}) {
  for (const [label, targets] of Object.entries(INPUT_CELLS[formKey] || {})) {
    const value = typeof inputs[label] === 'string' ? inputs[label].trim() : ''
    for (const [address, write] of targets) {
      const cell = ws.getCell(address)
      const before = cell.text
      const next = value ? write(value, before) : undefined
      if (next !== undefined) {
        cell.value = next
        if (typeof next === 'number') markCell(cell, next)
        else markInput(cell, before, cell.text, true)
      } else markInput(cell, before, before, false)
    }
  }
}

// Ô người dùng sửa tay trên giấy: { 'B7': 'nội dung mới' }. Ghi sau cùng nên thắng mọi cách điền khác.
// Giá trị là mảng đoạn [{ text, bold, italic, underline, strike, color, size }] thì ghi thành rich text trên nền phông của ô.
// Giá trị { runs, align } thì đổi thêm căn lề ngang của ô.
// Ô đang là số thì giữ kiểu số nếu nội dung mới vẫn đọc được thành số.
function runFont(base, run) {
  const font = { ...base, bold: !!run.bold, italic: !!run.italic, underline: !!run.underline, strike: !!run.strike }
  if (run.color) font.color = { argb: `FF${run.color.slice(1).toUpperCase()}` }
  if (run.size) font.size = run.size
  return font
}

function applyEdits(ws, edits = {}) {
  for (const [address, edit] of Object.entries(edits)) {
    const at = ws.getCell(address)
    const cell = at.isMerged ? at.master : at
    const { runs: text, align } = edit && typeof edit === 'object' && !Array.isArray(edit) ? edit : { runs: edit }
    if (align) cell.alignment = { ...cell.alignment, horizontal: align }
    if (Array.isArray(text)) {
      cell.value = { richText: text.map((run) => ({ text: run.text, font: runFont(cell.font, run) })) }
      markCell(cell, text.map((run) => run.text).join(''))
      continue
    }
    const current = cell.value?.formula || cell.value?.sharedFormula ? cell.value.result : cell.value
    const plain = /#,##0/.test(cell.numFmt || '') ? text.replace(/\./g, '').replace(',', '.') : text
    cell.value = typeof current === 'number' && text.trim() && Number.isFinite(Number(plain)) ? Number(plain) : text
    markCell(cell, text)
  }
}

// Điền một mẫu cho một thuyền viên: mẫu có `fill` điền theo ô, còn lại điền theo mã HDxx.
async function buildForm(meta, seafarerId, options) {
  if (meta.fill) {
    const wb = await openTemplate(meta.file)
    const seafarer = await meta.fill(wb, mainSheet(wb), seafarerId, pool)
    applyEdits(mainSheet(wb), options?.edits)
    return { wb, seafarer }
  }
  const { seafarer, data } = await loadFormData(seafarerId, options)
  const wb = await fillWorkbook(meta.file, data)
  applyInputs(mainSheet(wb), meta.key, options?.inputs)
  applyEdits(mainSheet(wb), options?.edits)
  return { wb, seafarer }
}

// Bản dùng để chuyển PDF: chỉ in sheet chính và đúng vùng in như bản xem trước, khổ A4, co cho vừa bề ngang một trang.
function layoutForPdf(wb, gridlines) {
  const main = mainSheet(wb)
  for (const ws of wb.worksheets) if (ws !== main && ws.state === 'visible') ws.state = 'hidden'
  // LibreOffice không đọc vùng in exceljs ghi ra, nên ẩn hẳn cột và dòng nằm ngoài vùng in (ghi chú, mã tra cứu của mẫu).
  const area = parseRange(main.pageSetup?.printArea)
  if (area) {
    for (let c = 1; c <= main.dimensions.right; c += 1) if (c < area.left || c > area.right) main.getColumn(c).hidden = true
    for (let r = 1; r <= main.dimensions.bottom; r += 1) if (r < area.top || r > area.bottom) main.getRow(r).hidden = true
  }
  main.pageSetup = { ...main.pageSetup, paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, showGridLines: gridlines }
}

function formMeta(formKey) {
  const meta = FORM_META.find((f) => f.key === formKey)
  if (!meta) throw { statusCode: 400, message: `Form không hợp lệ: ${formKey}` }
  return meta
}

const FORM_META = [
  { key: 'hd1', label: 'Hợp đồng lao động', file: 'HĐ1.xlsx' },
  { key: 'bao_hiem', label: 'Đơn không tham gia BHXH', file: 'Bao hiem.xlsx' },
  { key: 'don_bh', label: 'Đơn tham gia BHXH', file: 'Đơn tham gia BH.xlsx' },
  { key: 'uy_quyen', label: 'Ủy quyền nhận lương', file: 'UY QUYEN.xlsx' },
  { key: 'uy_quyen_cn', label: 'Ủy quyền cá nhân', file: 'UY QUYEN CA NHAN.xlsx' },
  { key: 'qd_dieu_dong', label: 'Quyết định điều động', file: 'Quyết định điều động.xlsx' },
  { key: 'thu_bao_lanh', label: 'Thư bảo lãnh', file: 'Thư bão lãnh.xlsx' },
  { key: 'phieu_thu', label: 'Phiếu thu', file: 'Phiếu thu.xlsx' },
  { key: 'tb_trung_tuyen', label: 'TB Trúng tuyển', file: 'TB TRUNG TUYEN.xlsx' },
  { key: 'kq_thi_tuyen', label: 'KQ Thi tuyển', file: 'KQ thi tuyển.xlsx' },
  { key: 'qd_roi_tau', label: 'Quyết định rời tàu', file: 'Quyết định rời tàu.xlsx' },
  { key: 'thanh_ly', label: 'Thanh lý hợp đồng', file: 'Thanh lý.xlsx' },
  { key: 'cv_tq', label: 'CV chủ tàu Trung Quốc', file: 'CV TQ.xlsx', fill: fillCvTq },
]

module.exports = {
  FORM_META,
  fillText,
  applyInputs,
  applyEdits,
  // options: { shipOwnerId, inputs, edits } lấy từ bộ giấy; bỏ trống thì suy chủ tàu từ tên tàu trên hồ sơ.
  // options.pdfSource: trả thêm một bản Excel đã chỉnh khổ in, dùng để chuyển PDF.
  async exportForm(seafarerId, formKey, options) {
    const meta = formMeta(formKey)
    const { wb, seafarer } = await buildForm(meta, seafarerId, options)
    // options.gridlines: có/không đường lưới ô, khi mở trong Excel và khi in ra PDF. Bỏ trống thì theo file mẫu.
    if (typeof options?.gridlines === 'boolean') {
      const main = mainSheet(wb)
      main.views = [{ ...(main.views?.[0] || {}), showGridLines: options.gridlines }]
    }
    const buf = await wb.xlsx.writeBuffer()
    let pdfSource
    if (options?.pdfSource) {
      layoutForPdf(wb, !!options.gridlines)
      pdfSource = await wb.xlsx.writeBuffer()
    }
    return { buffer: buf, pdfSource, filename: `${meta.label} - ${seafarer.full_name}.xlsx` }
  },
  // Xem trước: cùng file mẫu và cùng cách điền như lúc xuất. Chưa chọn thuyền viên thì ra mẫu trống.
  async previewForm(seafarerId, formKey, options) {
    const meta = formMeta(formKey)
    const { wb } = await buildForm(meta, seafarerId, options)
    return sheetToHtml(mainSheet(wb), wb)
  },
  async listForms() {
    return FORM_META.map(({ key, label }) => ({ key, label }))
  },
}
