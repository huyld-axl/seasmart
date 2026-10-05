// form_export.service.js
// Fills HD-Hong form templates with seafarer data per QUY UOC mapping
const ExcelJS = require('exceljs')
const path = require('path')
const pool = require('../config/db')

const FORMS_DIR = path.resolve(__dirname, '../../../../forms')

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
     LEFT JOIN rank r ON r.id = s.current_rank_id
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
    const [rows] = await pool.query('SELECT * FROM ship_owner WHERE vessel_name LIKE ? LIMIT 1', [
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

async function fillForm(formFileName, data) {
  const templatePath = path.join(FORMS_DIR, formFileName)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(templatePath)

  const ws = wb.worksheets[0]

  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value
      if (typeof v !== 'string') return

      // Replace exact placeholder (whole cell = placeholder)
      const trimmed = v.trim()
      if (data[trimmed] !== undefined) {
        cell.value = data[trimmed]
        return
      }

      // Replace inline placeholder within text (e.g. "Ông HD100", "MV HD80 do Công ty : H81")
      let replaced = v
      let changed = false
      for (const [key, val] of Object.entries(data)) {
        if (replaced.includes(key)) {
          replaced = replaced.split(key).join(String(val))
          changed = true
        }
      }
      if (changed) cell.value = replaced
    })
  })

  const buf = await wb.xlsx.writeBuffer()
  return buf
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
]

module.exports = {
  FORM_META,
  async exportForm(seafarerId, formKey) {
    const meta = FORM_META.find((f) => f.key === formKey)
    if (!meta) throw { statusCode: 400, message: `Form không hợp lệ: ${formKey}` }

    const seafarer = await getSeafarerData(seafarerId)
    const owner = await getOwnerByVessel(seafarer.vessel_name_raw)
    const data = buildSeafarerRow(seafarer, owner)

    const buf = await fillForm(meta.file, data)
    return { buffer: buf, filename: `${meta.label} - ${seafarer.full_name}.xlsx` }
  },
  async listForms() {
    return FORM_META.map(({ key, label }) => ({ key, label }))
  },
}
