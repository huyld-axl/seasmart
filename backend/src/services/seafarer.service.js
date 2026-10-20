const { OVERVIEW_FIELDS, TAB_CONDITIONS, TABS, shapeRow } = require('../utils/crew_overview')
const pool = require('../config/db')
const { withTransaction } = require('../utils/transaction')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')

// Whitelist các fields được phép INSERT/UPDATE từ client
const ALLOWED_FIELDS = [
  'full_name',
  'full_name_en',
  'full_name_zh',
  'date_of_birth',
  'place_of_birth',
  'place_of_origin',
  'gender',
  'nationality_id',
  'seafarer_code',
  'national_id',
  'national_id_issued_date',
  'national_id_issued_place',
  'passport_number',
  'passport_issued_date',
  'passport_expiry',
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
  'blood_type',
  'education_school',
  'education_level',
  'education_major',
  'english_level',
  'shoe_size',
  'ppe_size',
  'vessel_group',
  'vessel_name_raw',
  'contract_flight_date',
  'contract_start_date',
  'contract_end_date',
  'contract_return_date',
  'contract_duration_raw',
  'contract_salary_raw',
  'notes',
]

// So giá trị cũ và mới (ngày so theo YYYY-MM-DD, số so như chuỗi); chỉ giữ trường thật sự đổi.
function comparable(value) {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text
}

function diffFields(before, after) {
  const changes = {}
  for (const [key, value] of Object.entries(after)) {
    const from = comparable(before[key])
    const to = comparable(value)
    if (from !== to) changes[key] = [from, to]
  }
  return changes
}

function pickAllowed(data) {
  const result = {}
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) result[key] = data[key]
  }
  return result
}

// Danh sách đi kèm hồ sơ (form gửi cả mảng): tài khoản ngân hàng và gia quyến.
// Dòng có id thì sửa đúng các cột của form (giữ cột khác do nhập Excel ghi), dòng mới thì thêm, dòng bị bỏ thì xóa.
const BANK_FIELDS = ['bank_name', 'account_number', 'account_holder']
const CONTACT_FIELDS = [
  'is_emergency_contact',
  'is_guarantor',
  'full_name',
  'relationship',
  'phone_primary',
  'guarantor_id_number',
  'guarantor_id_issued_date',
  'guarantor_id_issued_place',
  'address',
]
const CONTACT_FLAGS = ['is_emergency_contact', 'is_guarantor']

function cleanRows(rows, fields) {
  if (!Array.isArray(rows)) return null
  return rows
    .map((row) => {
      const clean = { id: Number.isInteger(row?.id) ? row.id : null }
      for (const key of fields) {
        const value = row?.[key]
        clean[key] = value === undefined || value === '' ? null : typeof value === 'string' ? value.trim() || null : value
      }
      return clean
    })
    .filter((row) => fields.some((key) => !CONTACT_FLAGS.includes(key) && row[key] !== null))
}

function cleanContacts(rows) {
  const clean = cleanRows(rows, CONTACT_FIELDS)
  if (!clean) return null
  return clean.map((row) => {
    if (!row.full_name) throw { statusCode: 400, message: 'Ghi họ tên người thân' }
    return {
      ...row,
      relationship: row.relationship || '',
      is_emergency_contact: row.is_emergency_contact ? 1 : 0,
      is_guarantor: row.is_guarantor ? 1 : 0,
    }
  })
}

function sameRows(before, after, fields) {
  const shape = (rows) => JSON.stringify(rows.map((row) => fields.map((key) => comparable(row[key]))))
  return shape(before) === shape(after)
}

const describeBanks = (rows) => rows.map((r) => [r.bank_name, r.account_number].filter(Boolean).join(' · ')).join('; ') || null
const describeContacts = (rows) => rows.map((r) => [r.full_name, r.relationship].filter(Boolean).join(' · ')).join('; ') || null

async function syncRows(db, table, seafarerId, rows, fields, extra = () => ({})) {
  const [existing] = await db.query(`SELECT * FROM ${table} WHERE seafarer_id = ? ORDER BY ${table === 'seafarer_bank_account' ? 'sort_order, ' : ''}id`, [seafarerId])
  const ownIds = new Set(existing.map((row) => row.id))
  const kept = []
  for (const [index, row] of rows.entries()) {
    const values = { ...Object.fromEntries(fields.map((key) => [key, row[key]])), ...extra(index) }
    if (row.id && ownIds.has(row.id)) {
      await db.query(`UPDATE ${table} SET ? WHERE id = ? AND seafarer_id = ?`, [values, row.id, seafarerId])
      kept.push(row.id)
    } else {
      const [result] = await db.query(`INSERT INTO ${table} SET ?`, [{ ...values, seafarer_id: seafarerId }])
      kept.push(result.insertId)
    }
  }
  const removed = existing.filter((row) => !kept.includes(row.id)).map((row) => row.id)
  if (removed.length) await db.query(`DELETE FROM ${table} WHERE seafarer_id = ? AND id IN (?)`, [seafarerId, removed])
  return existing
}

// Ảnh chân dung: chỉ JPG/PNG, nhận theo magic bytes, không tin MIME trình duyệt gửi.
function sniffImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  return null
}

const seafarerService = {
  async list({ page = 1, limit = 20, search, status, rank_id, available_for_training, tab, ownerId }) {
    const offset = (page - 1) * limit
    const where = ['s.deleted_at IS NULL']
    const params = []

    if (ownerId) {
      where.push('s.created_by = ?')
      params.push(ownerId)
    }
    if (search) {
      where.push(
        '(unaccent(s.full_name::text) ILIKE unaccent(?) OR unaccent(s.national_id::text) ILIKE unaccent(?) OR unaccent(s.seaman_book_number::text) ILIKE unaccent(?) OR unaccent(s.seafarer_code::text) ILIKE unaccent(?))'
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
    // TASK-B5: chỉ thuyền viên sẵn sàng cho đào tạo (đang ở bờ)
    if (available_for_training === 'true') {
      where.push('s.status = \'AVAILABLE\'')
    }

    // Số đếm của từng tab (màn A1) tính trên bộ lọc hiện tại, trước khi lọc theo tab.
    const baseWhere = 'WHERE ' + where.join(' AND ')
    const countCols = ['COUNT(*) AS all_count', ...TABS.map((key) => `SUM((${TAB_CONDITIONS[key]})::integer) AS ${key}`)].join(', ')
    const [[countRow]] = await pool.query(`SELECT ${countCols} FROM seafarer s ${baseWhere}`, params)
    const counts = { all: Number(countRow.all_count) || 0 }
    TABS.forEach((key) => { counts[key] = Number(countRow[key]) || 0 })
    if (tab && TAB_CONDITIONS[tab]) where.push(TAB_CONDITIONS[tab])

    const whereStr = 'WHERE ' + where.join(' AND ')

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM seafarer s ${whereStr}`,
      params
    )

    const selectFields = `s.id, s.seafarer_code, s.full_name, s.national_id, s.date_of_birth,
         s.gender, s.place_of_birth, s.phone_primary, s.email, s.status, s.user_id,
         r.name_vi as rank_name, r.code as rank_code, ${OVERVIEW_FIELDS}`

    const [rows] = await pool.query(
      `SELECT ${selectFields}
       FROM seafarer s
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
       ${whereStr}
       ORDER BY s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { data: rows.map(shapeRow), total, page, limit, counts }
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT s.*, r.name_vi as rank_name, c.name_vi as nationality_name
       FROM seafarer s
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
       LEFT JOIN country c ON c.id = s.nationality_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }

    let result = rows[0]
    const { photo_path, photo_mime, ...rest } = result
    const [banks] = await pool.query(
      'SELECT id, bank_name, account_number, account_holder FROM seafarer_bank_account WHERE seafarer_id = ? ORDER BY sort_order, id',
      [id]
    )
    result = { ...rest, has_photo: Boolean(photo_path), bank_accounts: banks }
    return result
  },

  // Tạo hồ sơ: chỉ bắt buộc họ tên. Thiếu quốc tịch thì lấy Việt Nam.
  async create(data, created_by) {
    const id = await withTransaction(pool, async (db) => {
      const safeData = pickAllowed(data)
      if (!safeData.nationality_id) {
        const [[vn]] = await db.query('SELECT id FROM country WHERE code = ?', ['VN'])
        if (!vn) throw { statusCode: 400, message: 'Chọn quốc tịch' }
        safeData.nationality_id = vn.id
      }
      const [result] = await db.query('INSERT INTO seafarer SET ?', [
        { ...safeData, created_by, updated_by: created_by },
      ])
      await this.saveLists(db, result.insertId, data)
      return result.insertId
    })
    return this.getById(id)
  },

  // Lưu tài khoản ngân hàng và gia quyến nếu form gửi kèm. Trả về thay đổi để ghi lịch sử.
  async saveLists(db, id, data) {
    const changes = {}
    const banks = cleanRows(data.bank_accounts, BANK_FIELDS)
    if (banks) {
      const before = await syncRows(db, 'seafarer_bank_account', id, banks, BANK_FIELDS, (index) => ({ sort_order: index }))
      if (!sameRows(before, banks, BANK_FIELDS)) changes.bank_accounts = [describeBanks(before), describeBanks(banks)]
      // Cột bank_* trên hồ sơ luôn bằng tài khoản đầu tiên (biểu mẫu Excel đọc từ đây).
      const first = banks[0] || {}
      await db.query('UPDATE seafarer SET bank_name = ?, bank_account_number = ?, bank_account_holder = ? WHERE id = ?', [
        first.bank_name ?? null,
        first.account_number ?? null,
        first.account_holder ?? null,
        id,
      ])
    }
    const contacts = cleanContacts(data.contacts)
    if (contacts) {
      const before = await syncRows(db, 'seafarer_contact', id, contacts, CONTACT_FIELDS)
      if (!sameRows(before, contacts, CONTACT_FIELDS)) changes.contacts = [describeContacts(before), describeContacts(contacts)]
    }
    return changes
  },

  async savePhoto(id, file, updated_by) {
    const buffer = await file.toBuffer()
    if (file.file?.truncated || buffer.length > config.upload.maxFileSize) {
      throw { statusCode: 413, message: 'Ảnh lớn hơn 10 MB, chọn ảnh nhỏ hơn' }
    }
    const mime = sniffImage(buffer)
    if (!mime) throw { statusCode: 400, message: 'Chỉ nhận ảnh JPG hoặc PNG' }
    const [[row]] = await pool.query('SELECT photo_path FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }

    const dir = path.join(config.upload.dir, 'photos')
    fs.mkdirSync(dir, { recursive: true })
    const storagePath = path.join(dir, `${id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${mime === 'image/png' ? '.png' : '.jpg'}`)
    fs.writeFileSync(storagePath, buffer)
    try {
      await pool.query('UPDATE seafarer SET photo_path = ?, photo_mime = ?, photo_updated_at = NOW(), updated_by = ? WHERE id = ?', [
        storagePath,
        mime,
        updated_by,
        id,
      ])
    } catch (err) {
      fs.rmSync(storagePath, { force: true })
      throw err
    }
    if (row.photo_path) fs.rmSync(row.photo_path, { force: true })
    return { has_photo: true }
  },

  async getPhoto(id) {
    const [[row]] = await pool.query('SELECT photo_path, photo_mime FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row?.photo_path || !fs.existsSync(row.photo_path)) throw { statusCode: 404, message: 'Chưa có ảnh chân dung' }
    return { path: row.photo_path, mime: row.photo_mime }
  },

  async removePhoto(id, updated_by) {
    const [[row]] = await pool.query('SELECT photo_path FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
    if (!row) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    await pool.query('UPDATE seafarer SET photo_path = NULL, photo_mime = NULL, photo_updated_at = NOW(), updated_by = ? WHERE id = ?', [updated_by, id])
    if (row.photo_path) fs.rmSync(row.photo_path, { force: true })
    return { has_photo: false }
  },

  // Sửa hồ sơ: bắt buộc lý do, ghi lại trường nào đổi từ gì sang gì; bộ giấy chưa xong thành "Cần làm lại".
  async update(id, data, updated_by, reason) {
    await withTransaction(pool, (conn) => this.applyUpdate(conn, id, data, updated_by, reason))
    return this.getById(id)
  },

  // Sửa hồ sơ trên một kết nối cho trước (để gói chung transaction với việc khác):
  // ghi lịch sử sửa kèm lý do, bộ giấy đang chờ thì chuyển STALE. Trả về các trường đã đổi.
  async applyUpdate(db, id, data, updated_by, reason) {
    const text = String(reason || '').trim()
    if (!text) throw { statusCode: 400, message: 'Ghi lý do sửa hồ sơ' }
    const [[before]] = await db.query('SELECT * FROM seafarer WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id])
    if (!before) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const { rank_name, nationality_name, ...rest } = data
    const safeData = pickAllowed(rest)
    const hasLists = Array.isArray(data.bank_accounts) || Array.isArray(data.contacts)
    if (Object.keys(safeData).length === 0 && !hasLists) {
      throw { statusCode: 400, message: 'Không có trường hợp lệ để cập nhật' }
    }
    // Cột bank_* đi theo danh sách tài khoản khi form gửi danh sách, không sửa riêng.
    if (Array.isArray(data.bank_accounts)) {
      delete safeData.bank_name
      delete safeData.bank_account_number
      delete safeData.bank_account_holder
    }
    const changes = diffFields(before, safeData)
    Object.assign(changes, await this.saveLists(db, id, data))
    if (!Object.keys(changes).length) return changes
    // updated_at do trigger touch_updated_at đặt.
    await db.query('UPDATE seafarer SET ? WHERE id = ?', [{ ...safeData, updated_by }, id])
    await db.query('INSERT INTO seafarer_revision (seafarer_id, changed_by, reason, changes) VALUES (?, ?, ?, ?)', [
      id,
      updated_by,
      text.slice(0, 500),
      JSON.stringify(changes),
    ])
    return changes
  },

  async revisions(id) {
    const [rows] = await pool.query(
      `SELECT r.id, r.reason, r.changes, r.created_at, u.email AS changed_by_email
       FROM seafarer_revision r LEFT JOIN "user" u ON u.id = r.changed_by
       WHERE r.seafarer_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`,
      [id]
    )
    return rows.map((row) => ({ ...row, changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes }))
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
    const [result] = await pool.query('INSERT INTO seafarer_contact SET ?', [
      { ...fields, seafarer_id: seafarerId },
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

  async exportExcel({ search, status, rank_id, ownerId }) {
    const where = ['s.deleted_at IS NULL']
    const params = []

    if (ownerId) {
      where.push('s.created_by = ?')
      params.push(ownerId)
    }

    if (search) {
      where.push('(unaccent(s.full_name::text) ILIKE unaccent(?) OR unaccent(s.national_id::text) ILIKE unaccent(?) OR unaccent(s.seafarer_code::text) ILIKE unaccent(?))')
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
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
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
module.exports.diffFields = diffFields
