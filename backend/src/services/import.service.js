const XLSX = require('xlsx')
const pool = require('../config/db')

const COL_MAP = {
  'MÃ TV': 'seafarer_code',
  'HỌ VÀ TÊN': 'full_name',
  'NGÀY SINH': 'date_of_birth',
  'HỘ CHIẾU': 'passport_number',
  'Số CMTND': 'national_id',
  'SỐ ĐIỆN THOẠI ': 'phone_primary',
  'SỐ SỔ BHXH': 'social_insurance_number',
  'SỐ TÀI KHOẢN': 'bank_account_number',
  'NGÂN HÀNG': 'bank_name',
  'QUÊ QUÁN-Xã': 'permanent_ward',
  'QUÊ QUÁN-huyện': 'permanent_district',
  'QUÊ QUÁN-tỉnh': 'permanent_province',
  'NƠI THƯỜNG TRÚ': 'permanent_address',
  'Chiều cao': 'height_cm',
  'Cân nặng': 'weight_kg',
  // Cột mới — map trực tiếp
  'KHỐI ': 'vessel_group',
  'TÊN TÀU': 'vessel_name_raw',
  'Nơi cấp': 'national_id_issued_place',
  'CHỦ TK': 'bank_account_holder',
  'TÌNH TRẠNG': 'marital_status',
  'SỐ CON': 'children_count',
  'THÔNG TIN CON': 'children_info',
  'TUỔI CON': 'children_ages',
  'Size áo': 'shirt_size',
  'Size quần': 'pants_size',
}

// Cột cần xử lý riêng (không map trực tiếp)
const SPECIAL_COLS = [
  'CHỨC DANH', // → current_rank_id (lookup)
  'THAM GIA BH (Y/N)', // → social_insurance_joined (Y/N → 1/0)
  'THỜI GIAN \r\nHD)', // → contract_duration_raw (header có \r\n)
  'Lương hợp đồng', // → contract_salary_raw
  'NGƯỜI LIÊN LẠC', // → seafarer_contact
  'QUAN HỆ VỚI TV', // → seafarer_contact
  'HỌ TÊN NGƯỜI BẢO LÃNH', // → seafarer_contact
  'CCCD/CMT', // → seafarer_contact
  'SỐ ĐIỆN THOẠI NGƯỜI BẢO LÃNH', // → seafarer_contact
]

// Cột bắt buộc và khuyến nghị
const REQUIRED_COLS = ['HỌ VÀ TÊN', 'NGÀY SINH']
const EXPECTED_COLS = [
  'HỌ VÀ TÊN',
  'NGÀY SINH',
  'Số CMTND',
  'HỘ CHIẾU',
  'MÃ TV',
  'SỐ ĐIỆN THOẠI ',
  'CHỨC DANH',
  'QUÊ QUÁN-Xã',
  'QUÊ QUÁN-huyện',
  'QUÊ QUÁN-tỉnh',
]

// Index cứng cho các cột trùng tên hoặc có ký tự đặc biệt trong header
// (0-based, tính từ đầu mỗi row — khớp với cấu trúc HD-Hong.xlsx sheet data)
const FIXED_IDX = {
  PASSPORT_ISSUED_DATE: 11, // cột 12: "ngày cấp" (hộ chiếu)
  NATIONAL_ID_ISSUED_DATE: 14, // cột 15: "Ngày cấp" (CMTND)
  CONTRACT_FLIGHT_DATE: 6, // cột 7:  "NGÀY BAY"
  CONTRACT_START_DATE: 7, // cột 8:  "NGÀY NHẬP TÀU"
  CONTRACT_DURATION: 8, // cột 9:  "THỜI GIAN HĐ"
  CONTRACT_SALARY: 12, // cột 13: "Lương hợp đồng"
  CONTRACT_END_DATE: 41, // cột 42: "NGÀY RỜI TÀU"
  CONTRACT_RETURN_DATE: 42, // cột 43: "NGÀY VỀ TỚI VIỆT NAM"
  GUARANTOR_DOB: 35, // cột 36: "Ngày tháng năm sinh của người bảo lãnh"
  RANK_NAME_VI: 43, // cột 44: "CHỨC DANH" tên tiếng Việt (Máy ba, Đại phó...)
}

const norm = (s) => (s ? String(s).trim().normalize('NFC') : '')

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split('T')[0]
  }
  return null
}

function cleanPhone(val) {
  if (!val) return null
  return String(val).replace(/\D/g, '').slice(0, 20) || null
}

function parseBH(val) {
  if (!val) return null
  return ['Y', 'CÓ', 'CO', '1', 'YES'].includes(String(val).trim().toUpperCase()) ? 1 : 0
}

async function getRankMap() {
  const [rows] = await pool.query('SELECT id, code FROM `rank`')
  const map = {}
  rows.forEach((r) => {
    map[r.code.toUpperCase()] = r.id
  })
  return map
}

async function getVietnamCountryId() {
  const [rows] = await pool.query('SELECT id FROM country WHERE code = \'VN\' LIMIT 1')
  if (rows[0]) return rows[0].id
  const [r] = await pool.query(
    'INSERT INTO country (code, name_en, name_vi) VALUES (\'VN\', \'Vietnam\', \'Việt Nam\')'
  )
  return r.insertId
}

async function importExcel(filePath, createdBy = null, sheetName = null) {
  let wb
  try {
    wb = XLSX.readFile(filePath)
  } catch (e) {
    throw new Error('Không thể đọc file — file bị hỏng hoặc không phải định dạng Excel hợp lệ')
  }

  const targetSheet = sheetName || wb.SheetNames[0]
  const ws = wb.Sheets[targetSheet]
  if (!ws) {
    throw new Error(
      `Không tìm thấy sheet "${targetSheet}". File có các sheet: ${wb.SheetNames.join(', ')}`
    )
  }

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const headerIdx = raw.findIndex(
    (row) => row && row.some((cell) => norm(cell) === norm('HỌ VÀ TÊN'))
  )
  if (headerIdx === -1) {
    throw new Error(
      `Sheet "${targetSheet}" không có cột "HỌ VÀ TÊN". ` +
        'File upload phải có sheet đầu tiên chứa dữ liệu thuyền viên với các cột: HỌ VÀ TÊN, NGÀY SINH.'
    )
  }

  const headers = raw[headerIdx].map((h) => norm(h))

  const missingRequired = REQUIRED_COLS.filter((col) => !headers.includes(norm(col)))
  if (missingRequired.length > 0) {
    throw new Error(`File thiếu cột bắt buộc: ${missingRequired.join(', ')}`)
  }

  const missingExpected = EXPECTED_COLS.filter((col) => !headers.includes(norm(col)))
  const warnings =
    missingExpected.length > 0
      ? [
          `Các cột sau không có trong file, dữ liệu tương ứng sẽ bị bỏ qua: ${missingExpected.join(', ')}`,
        ]
      : []

  const dataRows = raw.slice(headerIdx + 1)
  const vietnamId = await getVietnamCountryId()
  const rankMap = await getRankMap()
  const results = { success: 0, skipped: 0, skipped_detail: [], errors: [], warnings }

  for (const row of dataRows) {
    const nameIdx = headers.indexOf(norm('HỌ VÀ TÊN'))
    if (!row || !row[nameIdx]) continue

    const rowNum = row[0] || '?'

    try {
      const get = (colName) => {
        const idx = headers.indexOf(norm(colName))
        return idx >= 0 ? row[idx] : null
      }

      const fullName = get('HỌ VÀ TÊN')
      if (!fullName) {
        results.skipped++
        results.skipped_detail.push({ row: rowNum, reason: 'Thiếu họ tên' })
        continue
      }

      const dobRaw = get('NGÀY SINH')
      const dob = parseDate(dobRaw)
      if (!dob) {
        results.skipped++
        results.skipped_detail.push({
          row: rowNum,
          name: String(fullName),
          reason: `Ngày sinh không hợp lệ: "${dobRaw}"`,
        })
        continue
      }

      const nationalId = get('Số CMTND') ? String(get('Số CMTND')) : null
      const seafarerCode = get('MÃ TV') ? String(get('MÃ TV')) : null

      if (nationalId) {
        const [dup] = await pool.query(
          'SELECT id FROM seafarer WHERE national_id = ? AND deleted_at IS NULL LIMIT 1',
          [nationalId]
        )
        if (dup.length > 0) {
          results.skipped++
          results.skipped_detail.push({
            row: rowNum,
            name: String(fullName),
            reason: `CCCD "${nationalId}" đã tồn tại trong hệ thống`,
          })
          continue
        }
      }

      // Rank lookup
      const rankCode = get('CHỨC DANH')
      const rankId = rankCode ? rankMap[String(rankCode).trim().toUpperCase()] || null : null
      if (rankCode && !rankId) {
        results.warnings.push(
          `Row ${rowNum} (${String(fullName)}): Chức danh "${rankCode}" không tìm thấy trong hệ thống`
        )
      }

      const seafarerData = {
        full_name: String(fullName).trim(),
        date_of_birth: dob,
        nationality_id: vietnamId,
        seafarer_code: seafarerCode,
        national_id: nationalId,
        national_id_issued_date: parseDate(row[FIXED_IDX.NATIONAL_ID_ISSUED_DATE]),
        national_id_issued_place: get('Nơi cấp') ? String(get('Nơi cấp')) : null,
        passport_number: get('HỘ CHIẾU') ? String(get('HỘ CHIẾU')) : null,
        passport_issued_date: parseDate(row[FIXED_IDX.PASSPORT_ISSUED_DATE]),
        current_rank_id: rankId,
        phone_primary: cleanPhone(get('SỐ ĐIỆN THOẠI ')),
        social_insurance_number: get('SỐ SỔ BHXH') ? String(get('SỐ SỔ BHXH')) : null,
        social_insurance_joined: parseBH(get('THAM GIA BH (Y/N)')),
        bank_account_number: get('SỐ TÀI KHOẢN') ? String(get('SỐ TÀI KHOẢN')) : null,
        bank_account_holder: get('CHỦ TK') ? String(get('CHỦ TK')).slice(0, 150) : null,
        bank_name: get('NGÂN HÀNG') ? String(get('NGÂN HÀNG')).slice(0, 100) : null,
        permanent_ward: get('QUÊ QUÁN-Xã') ? String(get('QUÊ QUÁN-Xã')) : null,
        permanent_district: get('QUÊ QUÁN-huyện') ? String(get('QUÊ QUÁN-huyện')) : null,
        permanent_province: get('QUÊ QUÁN-tỉnh') ? String(get('QUÊ QUÁN-tỉnh')) : null,
        permanent_address: get('NƠI THƯỜNG TRÚ') ? String(get('NƠI THƯỜNG TRÚ')) : null,
        marital_status: get('TÌNH TRẠNG') ? String(get('TÌNH TRẠNG')).slice(0, 30) : null,
        children_count: get('SỐ CON') ? parseInt(get('SỐ CON')) || null : null,
        children_info: get('THÔNG TIN CON') ? String(get('THÔNG TIN CON')) : null,
        children_ages: get('TUỔI CON') ? String(get('TUỔI CON')).slice(0, 100) : null,
        height_cm: get('Chiều cao') ? parseInt(get('Chiều cao')) || null : null,
        weight_kg: get('Cân nặng') ? parseInt(get('Cân nặng')) || null : null,
        shirt_size: get('Size áo') ? String(get('Size áo')).slice(0, 10) : null,
        pants_size: get('Size quần') ? String(get('Size quần')).slice(0, 10) : null,
        vessel_group: get('KHỐI ') ? String(get('KHỐI ')).slice(0, 20) : null,
        vessel_name_raw: get('TÊN TÀU') ? String(get('TÊN TÀU')).slice(0, 150) : null,
        contract_flight_date: parseDate(row[FIXED_IDX.CONTRACT_FLIGHT_DATE]),
        contract_start_date: parseDate(row[FIXED_IDX.CONTRACT_START_DATE]),
        contract_duration_raw: row[FIXED_IDX.CONTRACT_DURATION]
          ? String(row[FIXED_IDX.CONTRACT_DURATION]).slice(0, 30)
          : null,
        contract_salary_raw: row[FIXED_IDX.CONTRACT_SALARY]
          ? parseFloat(row[FIXED_IDX.CONTRACT_SALARY]) || null
          : null,
        contract_end_date: parseDate(row[FIXED_IDX.CONTRACT_END_DATE]),
        contract_return_date: parseDate(row[FIXED_IDX.CONTRACT_RETURN_DATE]),
        rank_name_vi: row[FIXED_IDX.RANK_NAME_VI]
          ? String(row[FIXED_IDX.RANK_NAME_VI]).slice(0, 100)
          : null,
        status: 'AVAILABLE',
        created_by: createdBy,
        updated_by: createdBy,
      }

      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()

        const [ins] = await conn.query('INSERT INTO seafarer SET ?', [seafarerData])
        const seafarerId = ins.insertId

        // Emergency contact
        const contactName = get('NGƯỜI LIÊN LẠC')
        if (contactName) {
          await conn.query('INSERT INTO seafarer_contact SET ?', [
            {
              seafarer_id: seafarerId,
              full_name: String(contactName).trim(),
              relationship: get('QUAN HỆ VỚI TV') ? String(get('QUAN HỆ VỚI TV')) : 'Khác',
              is_emergency_contact: 1,
              is_guarantor: 0,
            },
          ])
        }

        // Guarantor
        const guarantorName = get('HỌ TÊN NGƯỜI BẢO LÃNH')
        if (guarantorName) {
          await conn.query('INSERT INTO seafarer_contact SET ?', [
            {
              seafarer_id: seafarerId,
              full_name: String(guarantorName).trim(),
              relationship: 'Người bảo lãnh',
              is_emergency_contact: 0,
              is_guarantor: 1,
              national_id: get('CCCD/CMT') ? String(get('CCCD/CMT')) : null,
              phone_primary: cleanPhone(get('SỐ ĐIỆN THOẠI NGƯỜI BẢO LÃNH')),
              guarantor_id_number: get('CCCD/CMT') ? String(get('CCCD/CMT')) : null,
              guarantor_id_issued_date: parseDate(get('NGÀY CẤP')),
              date_of_birth: parseDate(row[FIXED_IDX.GUARANTOR_DOB]),
            },
          ])
        }

        await conn.commit()
        results.success++
      } catch (txErr) {
        await conn.rollback()
        throw txErr
      } finally {
        conn.release()
      }
    } catch (err) {
      // Sanitize error message — không lộ DB schema ra client
      let safeMsg = 'Lỗi khi lưu dữ liệu'
      if (err.code === 'ER_DUP_ENTRY') safeMsg = 'Dữ liệu bị trùng lặp'
      else if (err.code === 'ER_DATA_TOO_LONG') safeMsg = 'Dữ liệu quá dài cho một trường'
      else if (err.code === 'ER_BAD_NULL_ERROR') safeMsg = 'Thiếu dữ liệu bắt buộc'
      else if (err.statusCode) safeMsg = err.message // lỗi business logic từ code
      results.errors.push({
        row: rowNum,
        name: row[headers.indexOf(norm('HỌ VÀ TÊN'))] || '',
        error: safeMsg,
      })
    }
  }

  return results
}

// TASK-B4: Import enrollment hàng loạt — Excel có cột seafarer_code hoặc full_name, rank?, notes?
async function importEnrollments(courseId, fileBuffer, userId, userRole, linkedEntityId) {
  const pool = require('../config/db')
  const [[course]] = await pool.query(
    'SELECT id, max_students, training_center_id FROM training_course WHERE id = ? AND deleted_at IS NULL',
    [courseId]
  )
  if (!course) throw { statusCode: 404, message: 'Khóa học không tồn tại' }
  if (
    userRole === 'training_center' &&
    Number(course.training_center_id) !== Number(linkedEntityId)
  ) {
    throw { statusCode: 403, message: 'Chỉ được import vào khóa học của trung tâm mình' }
  }

  const wb = XLSX.read(fileBuffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  const results = { total: rows.length, success: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    const seafarerCode = row.seafarer_code != null ? String(row.seafarer_code).trim() : null
    const fullName = row.full_name != null ? String(row.full_name).trim() : null
    if (!seafarerCode && !fullName) {
      results.errors.push({
        row: rowNum,
        seafarer_code: seafarerCode || '',
        error: 'Thiếu seafarer_code hoặc full_name',
      })
      continue
    }

    try {
      let seafarer = null
      if (seafarerCode) {
        const [[s]] = await pool.query(
          'SELECT id FROM seafarer WHERE seafarer_code = ? AND deleted_at IS NULL LIMIT 1',
          [seafarerCode]
        )
        seafarer = s
      }
      if (!seafarer && fullName) {
        const [[s]] = await pool.query(
          'SELECT id FROM seafarer WHERE full_name = ? AND deleted_at IS NULL LIMIT 1',
          [fullName]
        )
        seafarer = s
      }
      if (!seafarer) {
        results.errors.push({
          row: rowNum,
          seafarer_code: seafarerCode || fullName,
          error: 'Seafarer không tồn tại',
        })
        continue
      }

      const [[existing]] = await pool.query(
        'SELECT id FROM training_enrollment WHERE course_id = ? AND seafarer_id = ? AND deleted_at IS NULL',
        [courseId, seafarer.id]
      )
      if (existing) {
        results.errors.push({
          row: rowNum,
          seafarer_code: seafarerCode || fullName,
          error: 'Đã đăng ký khóa học này rồi',
        })
        continue
      }

      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM training_enrollment WHERE course_id = ? AND deleted_at IS NULL AND status IN (\'PENDING\',\'APPROVED\',\'ACTIVE\',\'COMPLETED\')',
        [courseId]
      )
      if (course.max_students && cnt >= course.max_students) {
        results.errors.push({
          row: rowNum,
          seafarer_code: seafarerCode || fullName,
          error: 'Khóa học đã đủ số học viên',
        })
        continue
      }

      const notes = row.notes != null ? String(row.notes).trim() : null
      await pool.query(
        'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date, notes) VALUES (?, ?, \'PENDING\', CURDATE(), ?)',
        [courseId, seafarer.id, notes]
      )
      results.success++
    } catch (err) {
      results.errors.push({
        row: rowNum,
        seafarer_code: seafarerCode || fullName || '',
        error: err.message || 'Lỗi khi lưu',
      })
    }
  }

  return results
}

function getEnrollmentImportTemplateBuffer() {
  const headers = [['seafarer_code', 'full_name', 'rank', 'notes']]
  const sample = [
    ['SF001', 'Nguyễn Văn A', 'Captain', ''],
    ['SF002', 'Trần Văn B', 'Chief Officer', 'Ưu tiên'],
  ]
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Enrollments')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

module.exports = { importExcel, importEnrollments, getEnrollmentImportTemplateBuffer }
