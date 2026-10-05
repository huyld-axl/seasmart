const pool = require('../config/db')
const XLSX = require('xlsx')

// TASK-B5: training_center chỉ thấy các field này khi GET /seafarers hoặc GET /seafarers/:id
const TRAINING_CENTER_ALLOWED_FIELDS = [
  's.id',
  's.seafarer_code',
  's.full_name',
  's.date_of_birth',
  's.nationality_id',
  's.current_rank_id',
  's.english_level',
  's.english_score',
  's.status as current_status',
  'r.name_vi as rank_name',
  'r.code as rank_code',
  'c.name_vi as nationality_name',
]
const TRAINING_CENTER_SELECT = TRAINING_CENTER_ALLOWED_FIELDS.join(', ')

function filterCertificateFieldsForTC(rows) {
  return rows.map((c) => ({
    id: c.id,
    certificate_type: c.certificate_type_name || c.certificate_type,
    certificate_number: c.certificate_number,
    issued_date: c.issued_date,
    expiry_date: c.expiry_date,
    status: c.status,
  }))
}

// Whitelist các fields được phép INSERT/UPDATE từ client
const ALLOWED_FIELDS = [
  'full_name',
  'full_name_en',
  'date_of_birth',
  'gender',
  'nationality_id',
  'seafarer_code',
  'national_id',
  'national_id_issued_date',
  'national_id_issued_place',
  'passport_number',
  'passport_issued_date',
  'seaman_book_number',
  'current_rank_id',
  'rank_name_vi',
  'phone_primary',
  'phone_secondary',
  'email',
  'permanent_address',
  'permanent_ward',
  'permanent_district',
  'permanent_province',
  'temporary_address',
  'social_insurance_number',
  'social_insurance_joined',
  'bank_account_number',
  'bank_name',
  'bank_account_holder',
  'marital_status',
  'children_count',
  'children_info',
  'children_ages',
  'height_cm',
  'weight_kg',
  'shirt_size',
  'pants_size',
  'vessel_group',
  'vessel_name_raw',
  'contract_flight_date',
  'contract_start_date',
  'contract_end_date',
  'contract_return_date',
  'contract_duration_raw',
  'contract_salary_raw',
  'status',
  'notes',
]

function pickAllowed(data) {
  const result = {}
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) result[key] = data[key]
  }
  return result
}

const seafarerService = {
  async list({ page = 1, limit = 20, search, status, rank_id, available_for_training }, userRole) {
    const offset = (page - 1) * limit
    const where = ['s.deleted_at IS NULL']
    const params = []

    if (search) {
      where.push(
        '(s.full_name LIKE ? OR s.national_id LIKE ? OR s.seaman_book_number LIKE ? OR s.seafarer_code LIKE ?)'
      )
      const q = `${search}%`
      params.push(q, q, q, q)
    }
    if (status) {
      where.push('s.status = ?')
      params.push(status)
    }
    if (rank_id) {
      where.push('s.current_rank_id = ?')
      params.push(rank_id)
    }
    // TASK-B5: chỉ thuyền viên sẵn sàng cho đào tạo (AVAILABLE hoặc ON_LEAVE)
    if (available_for_training === 'true') {
      where.push('s.status IN (\'AVAILABLE\', \'ON_LEAVE\')')
    }

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM seafarer s ${whereStr}`,
      params
    )

    const isTC = userRole === 'training_center'
    const selectFields = isTC
      ? TRAINING_CENTER_SELECT
      : `s.id, s.seafarer_code, s.full_name, s.national_id, s.date_of_birth,
         s.phone_primary, s.email, s.status, s.user_id,
         r.name_vi as rank_name, r.code as rank_code`

    const [rows] = await pool.query(
      `SELECT ${selectFields}
       FROM seafarer s
       LEFT JOIN rank r ON r.id = s.current_rank_id
       ${isTC ? 'LEFT JOIN country c ON c.id = s.nationality_id' : ''}
       ${whereStr}
       ORDER BY s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows, total, page, limit }
  },

  async getById(id, userRole) {
    const isTC = userRole === 'training_center'
    const selectFields = isTC
      ? TRAINING_CENTER_SELECT
      : 's.*, r.name_vi as rank_name, c.name_vi as nationality_name'

    const [rows] = await pool.query(
      `SELECT ${selectFields}
       FROM seafarer s
       LEFT JOIN rank r ON r.id = s.current_rank_id
       LEFT JOIN country c ON c.id = s.nationality_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }

    let result = rows[0]
    if (isTC) {
      const [certs] = await pool.query(
        `SELECT sc.id, sc.certificate_number, sc.issued_date, sc.expiry_date, sc.status,
                ct.name_vi as certificate_type_name
         FROM seafarer_certificate sc
         LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
         WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL ORDER BY sc.expiry_date ASC`,
        [id]
      )
      result.certificates = filterCertificateFieldsForTC(certs)
    }
    return result
  },

  async create(data, created_by) {
    const safeData = pickAllowed(data)
    const [result] = await pool.query(
      'INSERT INTO seafarer SET ?, created_by = ?, updated_by = ?',
      [safeData, created_by, created_by]
    )
    return this.getById(result.insertId)
  },

  async update(id, data, updated_by) {
    await this.getById(id)
    const { rank_name, nationality_name, ...rest } = data
    const safeData = pickAllowed(rest)
    if (Object.keys(safeData).length === 0) {
      throw { statusCode: 400, message: 'Không có trường hợp lệ để cập nhật' }
    }
    await pool.query('UPDATE seafarer SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?', [
      safeData,
      updated_by,
      id,
    ])
    return this.getById(id)
  },

  async softDelete(id, updated_by) {
    await this.getById(id)
    await pool.query('UPDATE seafarer SET deleted_at = NOW(), updated_by = ? WHERE id = ?', [
      updated_by,
      id,
    ])
    return { success: true }
  },

  async getContacts(id) {
    const [rows] = await pool.query(
      'SELECT * FROM seafarer_contact WHERE seafarer_id = ? ORDER BY is_guarantor ASC, id ASC',
      [id]
    )
    return rows
  },

  async createContact(seafarerId, data) {
    const allowed = [
      'relationship',
      'is_emergency_contact',
      'is_guarantor',
      'full_name',
      'date_of_birth',
      'national_id',
      'phone_primary',
      'phone_secondary',
      'email',
      'address',
      'occupation',
      'workplace',
      'guarantor_id_number',
      'guarantor_id_issued_date',
      'guarantor_id_issued_place',
    ]
    const fields = {}
    for (const k of allowed) {
      if (data[k] !== undefined) fields[k] = data[k]
    }
    const [result] = await pool.query('INSERT INTO seafarer_contact SET ?, seafarer_id = ?', [
      fields,
      seafarerId,
    ])
    const [rows] = await pool.query('SELECT * FROM seafarer_contact WHERE id = ?', [
      result.insertId,
    ])
    return rows[0]
  },

  async deleteContact(seafarerId, contactId) {
    const [result] = await pool.query(
      'DELETE FROM seafarer_contact WHERE id = ? AND seafarer_id = ?',
      [contactId, seafarerId]
    )
    if (result.affectedRows === 0) throw { statusCode: 404, message: 'Không tìm thấy liên hệ' }
    return { success: true }
  },

  async exportExcel({ search, status, rank_id }) {
    const where = ['s.deleted_at IS NULL']
    const params = []

    if (search) {
      where.push('(s.full_name LIKE ? OR s.national_id LIKE ? OR s.seafarer_code LIKE ?)')
      const q = `${search}%`
      params.push(q, q, q)
    }
    if (status) {
      where.push('s.status = ?')
      params.push(status)
    }
    if (rank_id) {
      where.push('s.current_rank_id = ?')
      params.push(parseInt(rank_id))
    }

    const EXPORT_LIMIT = 10000
    const [rows] = await pool.query(
      `SELECT
        s.seafarer_code,
        s.full_name,
        r.code            AS rank_code,
        s.vessel_group,
        s.vessel_name_raw,
        s.contract_flight_date,
        s.contract_start_date,
        s.contract_duration_raw,
        s.date_of_birth,
        s.passport_number,
        s.passport_issued_date,
        s.contract_salary_raw,
        s.national_id,
        s.national_id_issued_date,
        s.national_id_issued_place,
        s.permanent_ward,
        s.permanent_district,
        s.permanent_province,
        s.permanent_address,
        s.phone_primary,
        s.social_insurance_joined,
        s.social_insurance_number,
        s.bank_account_number,
        s.bank_name,
        s.bank_account_holder,
        s.marital_status,
        s.children_count,
        s.children_info,
        s.children_ages,
        s.height_cm,
        s.weight_kg,
        s.shirt_size,
        s.pants_size,
        s.contract_end_date,
        s.contract_return_date,
        s.rank_name_vi
       FROM seafarer s
       LEFT JOIN \`rank\` r ON r.id = s.current_rank_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.seafarer_code ASC
       LIMIT ${EXPORT_LIMIT}`,
      params
    )

    const fmt = (d) => {
      if (!d) return ''
      const dt = new Date(d)
      if (isNaN(dt)) return ''
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
    }

    // Header row khớp với sheet "data" trong HD-Hong.xlsx
    const headers = [
      'STT',
      'MÃ TV',
      'HỌ VÀ TÊN',
      'CHỨC DANH',
      'KHỐI ',
      'TÊN TÀU',
      'NGÀY BAY',
      'NGÀY NHẬP TÀU',
      'THỜI GIAN HĐ',
      'NGÀY SINH',
      'HỘ CHIẾU',
      'Ngày cấp',
      'Lương hợp đồng',
      'Số CMTND',
      'Ngày cấp',
      'Nơi cấp',
      'QUÊ QUÁN-Xã',
      'QUÊ QUÁN-huyện',
      'QUÊ QUÁN-tỉnh',
      'NƠI THƯỜNG TRÚ',
      'SỐ ĐIỆN THOẠI ',
      'THAM GIA BH (Y/N)',
      'SỐ SỔ BHXH',
      'SỐ TÀI KHOẢN',
      'NGÂN HÀNG',
      'CHỦ TK',
      'TÌNH TRẠNG',
      'SỐ CON',
      'THÔNG TIN CON',
      'TUỔI CON',
      'Chiều cao',
      'Cân nặng',
      'Size áo',
      'Size quần',
      'NGÀY RỜI TÀU',
      'NGÀY VỀ TỚI VIỆT NAM',
      'CHỨC DANH',
    ]

    const dataRows = rows.map((s, i) => [
      i + 1,
      s.seafarer_code || '',
      s.full_name || '',
      s.rank_code || '',
      s.vessel_group || '',
      s.vessel_name_raw || '',
      fmt(s.contract_flight_date),
      fmt(s.contract_start_date),
      s.contract_duration_raw || '',
      fmt(s.date_of_birth),
      s.passport_number || '',
      fmt(s.passport_issued_date),
      s.contract_salary_raw != null ? Number(s.contract_salary_raw) : '',
      s.national_id || '',
      fmt(s.national_id_issued_date),
      s.national_id_issued_place || '',
      s.permanent_ward || '',
      s.permanent_district || '',
      s.permanent_province || '',
      s.permanent_address || '',
      s.phone_primary || '',
      s.social_insurance_joined === 1 ? 'Y' : s.social_insurance_joined === 0 ? 'N' : '',
      s.social_insurance_number || '',
      s.bank_account_number || '',
      s.bank_name || '',
      s.bank_account_holder || '',
      s.marital_status || '',
      s.children_count != null ? s.children_count : '',
      s.children_info || '',
      s.children_ages || '',
      s.height_cm != null ? s.height_cm : '',
      s.weight_kg != null ? s.weight_kg : '',
      s.shirt_size || '',
      s.pants_size || '',
      fmt(s.contract_end_date),
      fmt(s.contract_return_date),
      s.rank_name_vi || '',
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

    // Độ rộng cột
    ws['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 22 },
      { wch: 8 },
      { wch: 6 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 12 },
      { wch: 6 },
      { wch: 24 },
      { wch: 12 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'data')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  },
}

module.exports = seafarerService
