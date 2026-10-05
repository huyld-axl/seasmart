const pool = require('../config/db')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const config = require('../config')

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
    certificate_type:
      (c.certificate_type_name_en && String(c.certificate_type_name_en).trim()) ||
      c.certificate_type_name ||
      c.certificate_type,
    certificate_number: c.certificate_number,
    issued_date: c.issued_date,
    expiry_date: c.expiry_date,
    status: c.status,
  }))
}

// Whitelist các fields được phép INSERT/UPDATE từ client
const ALLOWED_FIELDS = [
  'full_name',
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
  'shoe_size',
  'protective_size',
  'current_rank_id',
  'phone_primary',
  'marital_status',
  'email',
  'permanent_address',
  'permanent_ward',
  'permanent_district',
  'permanent_province',
  'social_insurance_number',
  'social_insurance_joined',
  'bank_account_number',
  'bank_name',
  'bank_account_holder',
  'height_cm',
  'weight_kg',
  'vessel_group',
  'vessel_name_raw',
  'avatar_url',
  'personal_bank_account_holder',
  'personal_bank_name',
  'personal_bank_branch',
  'personal_bank_account_number',
  'salary_bank_account_holder',
  'salary_bank_name',
  'salary_bank_branch',
  'salary_bank_account_number',
  'status',
  'notes',
  'english_level',
  'english_score',
  'english_listening',
  'english_spoken',
  'english_reading',
  'english_writing',
  'education_school',
  'education_major',
  'full_name_cn',
  'place_of_birth',
  'blood_type',
  'education_graduation_date',
  'passport_expiry',
]

function pickAllowed(data) {
  const result = {}
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) result[key] = data[key]
  }
  return result
}

function normalizeEducationFields(safeData) {
  const limits = {
    education_school: 200,
    education_major: 150,
  }
  for (const key of Object.keys(limits)) {
    if (!(key in safeData)) continue
    const v = safeData[key]
    if (v === null) continue
    if (typeof v === 'string') {
      const t = v.trim()
      safeData[key] = t === '' ? null : t.slice(0, limits[key])
    }
  }
}

const ENGLISH_CV_LEVELS = new Set(['A', 'B', 'C'])

const LATEST_DEPLOYMENT_SELECT = `
  (
    SELECT sd.vessel_name
    FROM seafarer_deployment sd
    WHERE sd.seafarer_id = s.id
    ORDER BY
      COALESCE(sd.join_date, '1000-01-01') DESC,
      COALESCE(sd.sign_off_date, '1000-01-01') DESC,
      sd.created_at DESC,
      sd.id DESC
    LIMIT 1
  ) AS latest_vessel_name,
  (
    SELECT sd.join_date
    FROM seafarer_deployment sd
    WHERE sd.seafarer_id = s.id
    ORDER BY
      COALESCE(sd.join_date, '1000-01-01') DESC,
      COALESCE(sd.sign_off_date, '1000-01-01') DESC,
      sd.created_at DESC,
      sd.id DESC
    LIMIT 1
  ) AS latest_join_date,
  (
    SELECT sd.sign_off_date
    FROM seafarer_deployment sd
    WHERE sd.seafarer_id = s.id
    ORDER BY
      COALESCE(sd.join_date, '1000-01-01') DESC,
      COALESCE(sd.sign_off_date, '1000-01-01') DESC,
      sd.created_at DESC,
      sd.id DESC
    LIMIT 1
  ) AS latest_sign_off_date
`

function normalizeEnglishProfileFields(safeData) {
  if (!('english_level' in safeData) || safeData.english_level === undefined) return
  const v = safeData.english_level
  if (v === null) return
  if (typeof v !== 'string') return
  const t = v.trim().slice(0, 50)
  if (t === '') {
    safeData.english_level = null
    return
  }
  const u = t.toUpperCase()
  safeData.english_level = ENGLISH_CV_LEVELS.has(u) ? u : t
}

const seafarerService = {
  async list(
    {
      page = 1,
      limit = 20,
      search,
      status,
      vessel_name,
      rank_id,
      rank_ids = [],
      sort_by = 'updated_at',
      sort_order = 'desc',
      // sort_by = 'rank',
      // sort_order = 'asc',
      available_for_training,
    },
    userRole
  ) {
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
    if (vessel_name && vessel_name.trim()) {
      where.push(
        `(
          SELECT sd.vessel_name
          FROM seafarer_deployment sd
          WHERE sd.seafarer_id = s.id
          ORDER BY
            COALESCE(sd.join_date, '1000-01-01') DESC,
            COALESCE(sd.sign_off_date, '1000-01-01') DESC,
            sd.created_at DESC,
            sd.id DESC
          LIMIT 1
        ) LIKE ?`
      )
      params.push(`%${vessel_name.trim()}%`)
    }
    if (Array.isArray(rank_ids) && rank_ids.length) {
      const placeholders = rank_ids.map(() => '?').join(', ')
      where.push(`s.current_rank_id IN (${placeholders})`)
      params.push(...rank_ids)
    } else if (rank_id) {
      where.push('s.current_rank_id = ?')
      params.push(rank_id)
    }
    // TASK-B5: chỉ thuyền viên sẵn sàng cho đào tạo (STANDBY)
    if (available_for_training === 'true') {
      where.push('s.status = \'STANDBY\'')
    }

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM seafarer s ${whereStr}`,
      params
    )

    const isTC = userRole === 'accountant'
    const selectFields = isTC
      ? `${TRAINING_CENTER_SELECT}, s.updated_at, ${LATEST_DEPLOYMENT_SELECT}`
      : `s.id, s.seafarer_code, s.full_name, s.national_id, s.date_of_birth,
         s.phone_primary, s.email, s.status, s.user_id, s.permanent_province,
         s.current_rank_id, s.updated_at,
         r.name_vi as rank_name, r.code as rank_code,
         ${LATEST_DEPLOYMENT_SELECT}`

    const RANK_FIELD_ORDER =
      '\'CAPT\',\'CO\',\'2O\',\'3O\',\'BSN\',\'CARP\',\'AB\',\'OSD\',\'DCADET\',\'COOK\',\'MESS\',\'CE\',\'2E\',\'3E\',\'4E\',\'ETO\',\'ELECT\',\'FTR\',\'ABE\',\'OSE\',\'ENGINE CADET\''
    const normalizedSortBy = String(sort_by || 'updated_at').toLowerCase()
    const normalizedSortOrder = String(sort_order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const orderBy =
      normalizedSortBy === 'rank'
        ? `ORDER BY FIELD(r.code,${RANK_FIELD_ORDER}) = 0, FIELD(r.code,${RANK_FIELD_ORDER}), s.full_name ASC`
        : `ORDER BY s.updated_at ${normalizedSortOrder}, s.id DESC`

    const [rows] = await pool.query(
      `SELECT ${selectFields}
       FROM seafarer s
       LEFT JOIN rank r ON r.id = s.current_rank_id
       ${isTC ? 'LEFT JOIN country c ON c.id = s.nationality_id' : ''}
       ${whereStr}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows, total, page, limit }
  },

  async getById(id, userRole) {
    const isTC = userRole === 'accountant'
    const selectFields = isTC
      ? TRAINING_CENTER_SELECT
      : 's.*, r.name_vi as rank_name, r.code as rank_code, c.name_vi as nationality_name'

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
                ct.name_vi as certificate_type_name,
                ct.name_en as certificate_type_name_en
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
    normalizeEducationFields(safeData)
    normalizeEnglishProfileFields(safeData)
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
    normalizeEducationFields(safeData)
    normalizeEnglishProfileFields(safeData)
    if (Object.keys(safeData).length === 0) {
      throw { statusCode: 400, message: 'Không có trường hợp lệ để cập nhật' }
    }
    await pool.query('UPDATE seafarer SET ?, updated_by = ?, updated_at = NOW() WHERE id = ?', [
      safeData,
      updated_by,
      id,
    ])
    if (safeData.status === 'ONBOARD') {
      await pool.query('DELETE FROM seafarer_call_log WHERE seafarer_id = ?', [id])
    }
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
      'address',
      'phone',
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

  async updateContact(seafarerId, contactId, data) {
    const allowed = [
      'relationship',
      'is_emergency_contact',
      'is_guarantor',
      'full_name',
      'date_of_birth',
      'address',
      'phone',
    ]

    const fields = {}
    for (const k of allowed) {
      if (data[k] !== undefined) fields[k] = data[k]
    }
    if (Object.keys(fields).length === 0) {
      throw { statusCode: 400, message: 'Không có trường hợp lệ để cập nhật' }
    }

    const [result] = await pool.query(
      'UPDATE seafarer_contact SET ? WHERE id = ? AND seafarer_id = ?',
      [fields, contactId, seafarerId]
    )
    if (result.affectedRows === 0) throw { statusCode: 404, message: 'Không tìm thấy liên hệ' }

    const [rows] = await pool.query('SELECT * FROM seafarer_contact WHERE id = ?', [contactId])
    return rows[0]
  },

  async getEducations(seafarerId) {
    const [rows] = await pool.query(
      `SELECT id, graduation_level, degree_rating, school_name, major, graduation_year, enrollment_year
       FROM seafarer_education
       WHERE seafarer_id = ? AND deleted_at IS NULL
       ORDER BY graduation_year DESC, id ASC`,
      [seafarerId]
    )
    return rows
  },

  _normalizeDegreeRating(v) {
    const allowed = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR']
    if (v == null || v === '') return null
    const u = String(v).trim().toUpperCase()
    return allowed.includes(u) ? u : null
  },

  async replaceEducations(seafarerId, educations = [], updated_by) {
    const items = Array.isArray(educations) ? educations : []
    const normalized = items
      .map((item) => ({
        graduation_level: item?.graduation_level || null,
        degree_rating: this._normalizeDegreeRating(item?.degree_rating),
        school_name: (item?.school_name || '').trim(),
        major: item?.major || null,
        graduation_year: item?.graduation_year ? Number(item.graduation_year) : null,
        enrollment_year: item?.enrollment_year ? Number(item.enrollment_year) : null,
      }))
      .filter((item) => item.school_name)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        `UPDATE seafarer_education
         SET deleted_at = NOW(), updated_at = NOW(), updated_by = ?
         WHERE seafarer_id = ? AND deleted_at IS NULL`,
        [updated_by || null, seafarerId]
      )

      for (const item of normalized) {
        await conn.query(
          `INSERT INTO seafarer_education
          (seafarer_id, graduation_level, degree_rating, school_name, major, graduation_year, enrollment_year, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            seafarerId,
            item.graduation_level,
            item.degree_rating,
            item.school_name,
            item.major,
            item.graduation_year,
            item.enrollment_year,
            updated_by || null,
            updated_by || null,
          ]
        )
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    return this.getEducations(seafarerId)
  },

  async uploadAvatar(id, file, updated_by) {
    await this.getById(id)

    const ext = path.extname(file.filename || '').toLowerCase()
    const allowedExts = ['.jpg', '.jpeg', '.png']
    if (!allowedExts.includes(ext)) {
      throw { statusCode: 400, message: 'Chỉ chấp nhận ảnh JPG, JPEG, PNG' }
    }

    const fileBuffer = await file.toBuffer()
    const magic = fileBuffer.slice(0, 4)
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff
    const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47
    if (!isJpeg && !isPng) {
      throw { statusCode: 400, message: 'Nội dung file ảnh không hợp lệ' }
    }

    const uploadDir = path.join(config.upload.dir, 'seafarers', String(id))
    fs.mkdirSync(uploadDir, { recursive: true })

    const filename = `avatar_${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)
    fs.writeFileSync(filepath, fileBuffer)

    const avatarUrl = `/uploads/seafarers/${id}/${filename}`
    await pool.query(
      'UPDATE seafarer SET avatar_url = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [avatarUrl, updated_by, id]
    )

    return this.getById(id)
  },

  async exportExcel({ search, status, rank_id, rank_ids = [] }) {
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
    if (Array.isArray(rank_ids) && rank_ids.length) {
      const placeholders = rank_ids.map(() => '?').join(', ')
      where.push(`s.current_rank_id IN (${placeholders})`)
      params.push(...rank_ids)
    } else if (rank_id) {
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
        s.date_of_birth,
        s.passport_number,
        s.passport_issued_date,
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
        s.height_cm,
        s.weight_kg
       FROM seafarer s
       LEFT JOIN \`rank\` r ON r.id = s.current_rank_id
       WHERE ${where.join(' AND ')}
       ORDER BY FIELD(r.code,'CAPT','CO','2O','3O','BSN','CARP','AB','OSD','DCADET','COOK','MESS','CE','2E','3E','4E','ETO','ELECT','FTR','ABE','OSE','ENGINE CADET') = 0, FIELD(r.code,'CAPT','CO','2O','3O','BSN','CARP','AB','OSD','DCADET','COOK','MESS','CE','2E','3E','4E','ETO','ELECT','FTR','ABE','OSE','ENGINE CADET'), s.full_name ASC
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
      'NGÀY SINH',
      'HỘ CHIẾU',
      'Ngày cấp',
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
      'Chiều cao',
      'Cân nặng',
      'CHỨC DANH',
    ]

    const dataRows = rows.map((s, i) => [
      i + 1,
      s.seafarer_code || '',
      s.full_name || '',
      s.rank_code || '',
      s.vessel_group || '',
      s.vessel_name_raw || '',
      fmt(s.date_of_birth),
      s.passport_number || '',
      fmt(s.passport_issued_date),
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
      s.height_cm != null ? s.height_cm : '',
      s.weight_kg != null ? s.weight_kg : '',
      s.rank_code || '',
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
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'data')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  },
}

module.exports = seafarerService
