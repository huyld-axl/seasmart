const fs = require('fs')
const path = require('path')
const pool = require('../config/db')
const config = require('../config')

const DEFAULT_CHECKLIST = [
  { key: 'BIEN_BAN', label: 'Biên Bản Giao Nhận Giấy tờ (2 bản)' },
  { key: 'KY_TEN_MAU', label: 'Chữ ký + họ tên mẫu trên giấy trắng' },
  { key: 'CHUP_ANH', label: 'Ảnh chụp thuyền viên (ngực trở lên)' },
  { key: 'VAX_COVID', label: 'Check + chụp màn hình vaccine COVID' },
  { key: 'CHECK_ONLINE', label: 'Check COC/GOC trên cổng Cục Hàng hải' },
  { key: 'SYLY', label: 'Sơ yếu lý lịch có dấu địa phương (2 bản)' },
  { key: 'CMND', label: 'CMND/CCCD công chứng (2 bản)' },
  { key: 'CAM_KET', label: 'Bản cam kết có xác nhận địa phương (3 bản)' },
  { key: 'ANH_3x4', label: 'Ảnh 3x4 nền trắng (4 ảnh)' },
  { key: 'ANH_4x6', label: 'Ảnh 4x6 áo sẫm nền trắng (4 ảnh)' },
  { key: 'KHAM_SUC_KHOE', label: 'Giấy khám sức khỏe theo cờ tàu' },
  { key: 'TEST_COVID', label: 'Kết quả test COVID (nếu chủ tàu yêu cầu)' },
  { key: 'CHUNG_CHI', label: 'Toàn bộ chứng chỉ thuyền viên' },
  { key: 'HD_XUAT_KHAU', label: 'Hợp đồng xuất khẩu lao động (4 bản: 2 xanh + 2 trắng)' },
  { key: 'HD_CONG_TY', label: 'Hợp đồng công ty (2 bản)' },
  { key: 'HD_SEA', label: 'Hợp đồng SEA (2 bản)' },
  { key: 'VE_MAY_BAY', label: 'Vé máy bay + Letter + Visa (nếu nhập tàu nước ngoài)' },
]

const VALID_STATUSES = [
  'collecting_docs',
  'confirmed',
  'pre_boarding',
  'onboard',
  'signed_off',
  'cancelled',
]

const ATTACHMENT_ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']
const ATTACHMENT_ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]

const STATUS_WARNING_RULES = {
  confirmed: ['BIEN_BAN', 'KY_TEN_MAU', 'CHUP_ANH', 'VAX_COVID', 'CHECK_ONLINE'],
  pre_boarding: ['SYLY', 'CMND', 'CAM_KET', 'ANH_3x4', 'ANH_4x6'],
  onboard: [
    'KHAM_SUC_KHOE',
    'TEST_COVID',
    'CHUNG_CHI',
    'HD_XUAT_KHAU',
    'HD_CONG_TY',
    'HD_SEA',
    'VE_MAY_BAY',
  ],
}

const STATUS_DISPLAY_LABELS = {
  collecting_docs: 'Thu giấy tờ',
  confirmed: 'Đã chốt tàu',
  pre_boarding: 'Chuẩn bị nhập tàu',
  onboard: 'Đang tàu',
  signed_off: 'Đã rời tàu',
  cancelled: 'Đã hủy',
}

function monthDiff(fromDate, toDate) {
  if (!fromDate || !toDate) return null
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const years = to.getFullYear() - from.getFullYear()
  const months = to.getMonth() - from.getMonth()
  const days = to.getDate() - from.getDate()
  const total = years * 12 + months + (days >= 0 ? 0 : -1)
  return total
}

function parseDocDateFromNote(note) {
  if (!note) return null
  const match = String(note).match(/DOC_DATE=(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function toPublicUploadUrl(fullPath) {
  const absoluteUploadDir = path.resolve(process.cwd(), config.upload.dir)
  const relativePath = path.relative(absoluteUploadDir, fullPath).replace(/\\/g, '/')
  return `/uploads/${relativePath}`
}

function hasMeaningfulCreateData(data = {}) {
  const stringFields = [
    'vessel_name',
    'vessel_type',
    'vessel_flag',
    'salary_currency',
    'notes',
    'contract_start_date',
    'contract_end_date',
    'join_date',
    'sign_off_date',
  ]
  const directFields = [
    'vessel_id',
    'vessel_grt',
    'vessel_dwt',
    'main_engine_kw',
    'rank_id',
    'salary',
    'salary_actual',
    'job_id',
    'commission_rate',
  ]

  const hasStringValue = stringFields.some((field) => {
    const value = data[field]
    return typeof value === 'string' ? value.trim() !== '' : value != null
  })

  const hasDirectValue = directFields.some((field) => data[field] != null)

  return hasStringValue || hasDirectValue
}

const deploymentService = {
  async list(seafarerId) {
    const [rows] = await pool.query(
      `SELECT sd.*, r.name_vi AS rank_name, r.code AS rank_code, s.full_name AS seafarer_name, j.status AS job_status,
              j.amount AS job_amount, j.currency AS job_currency, j.commission_rate AS job_commission_rate,
              v.imo_number AS vessel_imo_number,
              COALESCE(sd.vessel_type, v.vessel_type) AS vessel_type,
              COALESCE(sd.vessel_flag, v.flag_country) AS vessel_flag,
              COALESCE(sd.vessel_grt, v.gross_tonnage) AS vessel_grt,
              COALESCE(sd.vessel_dwt, v.deadweight) AS vessel_dwt,
              v.engine_type AS vessel_engine_type,
              COALESCE(sd.main_engine_kw, v.engine_power_kw) AS main_engine_kw,
              v.trade_area AS operating_area
       FROM seafarer_deployment sd
       LEFT JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN rank r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN vessel v ON v.id = COALESCE(sd.vessel_id, j.vessel_id)
       WHERE sd.seafarer_id = ?
       ORDER BY
         COALESCE(sd.join_date, '1000-01-01') DESC,
         COALESCE(sd.sign_off_date, '1000-01-01') DESC,
         sd.created_at DESC,
         sd.id DESC`,
      [seafarerId]
    )
    return rows
  },

  async listAll(filters = {}) {
    const { status, seafarer_id, job_id, source, from_date, to_date, vessel_name, rank_id } =
      filters
    const where = []
    const params = []
    if (vessel_name) {
      where.push('sd.vessel_name LIKE ?')
      params.push(`%${vessel_name}%`)
    }
    if (rank_id) {
      where.push('sd.rank_id = ?')
      params.push(parseInt(rank_id))
    }
    if (status) {
      where.push('sd.status = ?')
      params.push(status)
    }
    if (seafarer_id) {
      where.push('sd.seafarer_id = ?')
      params.push(parseInt(seafarer_id))
    }
    if (job_id) {
      where.push('sd.job_id = ?')
      params.push(parseInt(job_id))
    }
    if (source === 'job') {
      where.push('sd.job_id IS NOT NULL')
    } else if (source === 'manual') {
      where.push('sd.job_id IS NULL')
    }
    if (from_date) {
      where.push('sd.join_date >= ?')
      params.push(from_date)
    }
    if (to_date) {
      where.push('sd.join_date <= ?')
      params.push(to_date)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows] = await pool.query(
      `SELECT sd.*, r.name_vi AS rank_name, r.code AS rank_code, s.full_name AS seafarer_name, j.status AS job_status,
              j.amount AS job_amount, j.currency AS job_currency, j.commission_rate AS job_commission_rate,
              v.imo_number AS vessel_imo_number,
              COALESCE(sd.vessel_type, v.vessel_type) AS vessel_type,
              COALESCE(sd.vessel_flag, v.flag_country) AS vessel_flag,
              COALESCE(sd.vessel_grt, v.gross_tonnage) AS vessel_grt,
              COALESCE(sd.vessel_dwt, v.deadweight) AS vessel_dwt,
              v.engine_type AS vessel_engine_type,
              COALESCE(sd.main_engine_kw, v.engine_power_kw) AS main_engine_kw,
              v.trade_area AS operating_area
       FROM seafarer_deployment sd
       LEFT JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN rank r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN vessel v ON v.id = COALESCE(sd.vessel_id, j.vessel_id)
       ${whereSql}
       ORDER BY sd.created_at DESC`,
      params
    )
    return rows
  },

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT sd.*, r.name_vi AS rank_name, r.code AS rank_code, s.full_name AS seafarer_name, j.status AS job_status,
              j.amount AS job_amount, j.currency AS job_currency, j.commission_rate AS job_commission_rate,
              v.imo_number AS vessel_imo_number,
              v.vessel_type, v.flag_country AS vessel_flag,
              v.gross_tonnage AS vessel_grt, v.deadweight AS vessel_dwt,
              v.engine_type AS vessel_engine_type, v.engine_power_kw AS main_engine_kw,
              v.trade_area AS operating_area
       FROM seafarer_deployment sd
       LEFT JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN rank r ON r.id = sd.rank_id
       LEFT JOIN \`job\` j ON j.id = sd.job_id
       LEFT JOIN vessel v ON v.id = COALESCE(sd.vessel_id, j.vessel_id)
       WHERE sd.id = ?`,
      [id]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy điều động' }
    return rows[0]
  },

  async create(seafarerId, data) {
    if (!hasMeaningfulCreateData(data)) {
      throw { statusCode: 400, message: 'Không có dữ liệu hợp lệ để tạo quá trình đi biển' }
    }

    const {
      vessel_id,
      vessel_name,
      vessel_type,
      vessel_flag,
      vessel_grt,
      vessel_dwt,
      main_engine_kw,
      rank_id,
      join_date,
      sign_off_date,
      salary,
      salary_actual,
      salary_currency,
      notes,
      job_id,
      contract_start_date,
      contract_end_date,
      commission_rate,
    } = data
    const [result] = await pool.query(
      `INSERT INTO seafarer_deployment (
        seafarer_id, vessel_id, vessel_name, vessel_type, vessel_flag,
        vessel_grt, vessel_dwt, main_engine_kw,
        rank_id, join_date, sign_off_date,
        salary, salary_actual, salary_currency, notes, job_id,
        contract_start_date, contract_end_date, commission_rate
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seafarerId,
        vessel_id || null,
        vessel_name || null,
        vessel_type || null,
        vessel_flag || null,
        vessel_grt != null ? parseFloat(vessel_grt) : null,
        vessel_dwt != null ? parseFloat(vessel_dwt) : null,
        main_engine_kw != null ? parseFloat(main_engine_kw) : null,
        rank_id || null,
        join_date || null,
        sign_off_date || null,
        salary || null,
        salary_actual || null,
        salary_currency || null,
        notes || null,
        job_id || null,
        contract_start_date || null,
        contract_end_date || null,
        commission_rate != null ? parseFloat(commission_rate) : null,
      ]
    )
    const deploymentId = result.insertId
    // Insert default checklist
    if (DEFAULT_CHECKLIST.length > 0) {
      const values = DEFAULT_CHECKLIST.map((item) => [deploymentId, item.key, item.label])
      await pool.query(
        'INSERT IGNORE INTO deployment_checklist (deployment_id, item_key, item_label) VALUES ?',
        [values]
      )
    }
    return this.getById(deploymentId)
  },

  async createFromJob(job, overrides = {}) {
    if (!job?.seafarer_id) return null
    return this.create(job.seafarer_id, {
      vessel_id: job.vessel_id || null,
      job_id: job.id,
      vessel_name: job.vessel_name || null,
      rank_id: job.rank_id || null,
      join_date: overrides.join_date !== undefined ? overrides.join_date : job.start_date || null,
      sign_off_date:
        overrides.sign_off_date !== undefined ? overrides.sign_off_date : job.end_date || null,
      salary: overrides.salary || null,
      salary_actual: overrides.salary_actual || null,
      salary_currency: overrides.salary_currency || null,
      contract_start_date: overrides.contract_start_date || null,
      contract_end_date: overrides.contract_end_date || null,
      commission_rate: overrides.commission_rate ?? job.commission_rate ?? null,
      notes: 'Auto tạo từ công việc',
    })
  },

  async cancelByJobAndSeafarer(jobId, seafarerId, reason = 'Hủy do gỡ thuyền viên khỏi công việc') {
    if (!jobId || !seafarerId) return
    await pool.query(
      `UPDATE seafarer_deployment
       SET status = 'cancelled',
           notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE '\n' END, ?),
           updated_at = NOW()
       WHERE job_id = ? AND seafarer_id = ? AND status <> 'cancelled'`,
      [reason, jobId, seafarerId]
    )
  },

  async update(id, data) {
    await this.getById(id)
    const {
      vessel_id,
      vessel_name,
      rank_id,
      join_date,
      sign_off_date,
      salary,
      salary_actual,
      salary_currency,
      notes,
      contract_start_date,
      contract_end_date,
      commission_rate,
    } = data
    const updates = []
    const params = []
    if (vessel_id !== undefined) {
      updates.push('vessel_id = ?')
      params.push(vessel_id || null)
    }
    if (vessel_name !== undefined) {
      updates.push('vessel_name = ?')
      params.push(vessel_name)
    }
    if (rank_id !== undefined) {
      updates.push('rank_id = ?')
      params.push(rank_id || null)
    }
    if (join_date !== undefined) {
      updates.push('join_date = ?')
      params.push(join_date || null)
    }
    if (sign_off_date !== undefined) {
      updates.push('sign_off_date = ?')
      params.push(sign_off_date || null)
    }
    if (salary !== undefined) {
      updates.push('salary = ?')
      params.push(salary || null)
    }
    if (salary_actual !== undefined) {
      updates.push('salary_actual = ?')
      params.push(salary_actual || null)
    }
    if (salary_currency !== undefined) {
      updates.push('salary_currency = ?')
      params.push(salary_currency || null)
    }
    if (notes !== undefined) {
      updates.push('notes = ?')
      params.push(notes)
    }
    if (contract_start_date !== undefined) {
      updates.push('contract_start_date = ?')
      params.push(contract_start_date || null)
    }
    if (contract_end_date !== undefined) {
      updates.push('contract_end_date = ?')
      params.push(contract_end_date || null)
    }
    if (commission_rate !== undefined) {
      updates.push('commission_rate = ?')
      params.push(commission_rate != null ? parseFloat(commission_rate) : null)
    }
    if (updates.length === 0) return this.getById(id)
    params.push(id)
    await pool.query(
      `UPDATE seafarer_deployment SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    )
    return this.getById(id)
  },

  async changeStatus(id, newStatus, options = {}) {
    const dep = await this.getById(id)
    if (!VALID_STATUSES.includes(newStatus)) {
      throw { statusCode: 400, message: 'Trạng thái không hợp lệ' }
    }
    await this.saveDocumentDates(id, options.document_dates || {})
    const extra =
      newStatus === 'signed_off' ? ', sign_off_date = COALESCE(sign_off_date, CURDATE())' : ''
    await pool.query(
      `UPDATE seafarer_deployment SET status = ?${extra}, updated_at = NOW() WHERE id = ?`,
      [newStatus, id]
    )
    if (newStatus === 'signed_off' && dep.job_id) {
      await pool.query(
        'UPDATE `job` SET seafarer_id = NULL, status = \'OPEN\', updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [dep.job_id]
      )
    }
    return this.getById(id)
  },

  async saveDocumentDates(deploymentId, documentDates = {}) {
    const updatableKeys = ['SYLY', 'CMND', 'CAM_KET']
    for (const key of updatableKeys) {
      if (!Object.prototype.hasOwnProperty.call(documentDates, key)) continue
      const value = documentDates[key]
      const [rows] = await pool.query(
        'SELECT id, notes FROM deployment_checklist WHERE deployment_id = ? AND item_key = ? LIMIT 1',
        [deploymentId, key]
      )
      if (!rows[0]) continue
      const current = rows[0].notes || ''
      if (value === null || value === '') {
        if (!/DOC_DATE=\d{4}-\d{2}-\d{2}/.test(current)) continue
        let next = current.replace(/DOC_DATE=\d{4}-\d{2}-\d{2}/g, '')
        next = next
          .replace(/\n\n+/g, '\n')
          .replace(/^\n+|\n+$/g, '')
          .trim()
        await pool.query(
          'UPDATE deployment_checklist SET notes = ?, updated_at = NOW() WHERE id = ?',
          [next || null, rows[0].id]
        )
      } else {
        const next = current.match(/DOC_DATE=\d{4}-\d{2}-\d{2}/)
          ? current.replace(/DOC_DATE=\d{4}-\d{2}-\d{2}/, `DOC_DATE=${value}`)
          : `${current}${current ? '\n' : ''}DOC_DATE=${value}`
        await pool.query(
          'UPDATE deployment_checklist SET notes = ?, updated_at = NOW() WHERE id = ?',
          [next, rows[0].id]
        )
      }
    }
  },

  async evaluateSoftWarnings(deploymentId, targetStatus, options = {}) {
    const dep = await this.getById(deploymentId)
    const warnings = []
    const certWarningMonths =
      Number.isFinite(Number(options.cert_warning_months)) &&
      Number(options.cert_warning_months) > 0
        ? Number(options.cert_warning_months)
        : 12

    const requiredKeys = STATUS_WARNING_RULES[targetStatus] || []
    const [checklistRows] = await pool.query(
      `SELECT item_key, is_checked, notes
       FROM deployment_checklist
       WHERE deployment_id = ?`,
      [deploymentId]
    )
    if (requiredKeys.length > 0) {
      const checkedMap = Object.fromEntries(
        checklistRows.map((row) => [row.item_key, Number(row.is_checked) === 1])
      )
      const missing = requiredKeys.filter((key) => !checkedMap[key])
      if (missing.length > 0) {
        const statusLabel = STATUS_DISPLAY_LABELS[targetStatus] || targetStatus
        warnings.push({
          code: 'CHECKLIST_INCOMPLETE',
          level: 'warning',
          message: `Checklist chưa hoàn tất cho bước "${statusLabel}".`,
          details: missing,
        })
      }
    }

    const [[seafarer]] = await pool.query(
      `SELECT id, full_name, passport_expiry
       FROM seafarer
       WHERE id = ? AND deleted_at IS NULL`,
      [dep.seafarer_id]
    )
    if (seafarer?.passport_expiry) {
      const passMonths = monthDiff(new Date(), seafarer.passport_expiry)
      if (passMonths !== null && passMonths < 18) {
        warnings.push({
          code: 'PASSPORT_UNDER_18M',
          level: 'warning',
          message: `Passport của thuyền viên ${seafarer.full_name || ''} còn dưới 18 tháng.`,
          details: { passport_expiry: seafarer.passport_expiry, months_left: passMonths },
        })
      }
    }

    const certScope = options.cert_scope === 'rank_required' ? 'rank_required' : 'all'
    if (certScope === 'all') {
      const [certRows] = await pool.query(
        `SELECT id, expiry_date
         FROM seafarer_certificate
         WHERE seafarer_id = ?
           AND deleted_at IS NULL
           AND status = 'VALID'
           AND expiry_date IS NOT NULL`,
        [dep.seafarer_id]
      )
      const shortCerts = certRows.filter((row) => {
        const m = monthDiff(new Date(), row.expiry_date)
        return m !== null && m < certWarningMonths
      })
      if (shortCerts.length > 0) {
        warnings.push({
          code: 'CERT_UNDER_12M',
          level: 'warning',
          message: `Có ${shortCerts.length} chứng chỉ còn dưới ${certWarningMonths} tháng.`,
          details: shortCerts.map((row) => row.id),
        })
      }
    } else {
      warnings.push({
        code: 'RANK_REQUIRED_CERT_MAPPING_MISSING',
        level: 'info',
        message:
          'Đang chọn chế độ kiểm tra chứng chỉ theo chức danh, nhưng chưa cấu hình mapping chứng chỉ bắt buộc.',
      })
    }

    const docDates = options.document_dates || {}
    const localDocKeys = ['SYLY', 'CMND', 'CAM_KET']
    const checklistDateMap = Object.fromEntries(
      checklistRows
        .map((row) => [row.item_key, parseDocDateFromNote(row.notes)])
        .filter(([, v]) => !!v)
    )
    localDocKeys.forEach((key) => {
      const value = Object.prototype.hasOwnProperty.call(docDates, key)
        ? docDates[key] || null
        : checklistDateMap[key]
      if (!value) return
      const ageMonths = monthDiff(value, new Date())
      if (ageMonths !== null && ageMonths > 6) {
        warnings.push({
          code: 'LOCAL_DOC_OVER_6M',
          level: 'warning',
          message: `${key} vượt quá thời hạn 6 tháng.`,
          details: { key, document_date: value, age_months: ageMonths },
        })
      }
    })

    return warnings
  },

  async delete(id) {
    const dep = await this.getById(id)
    await pool.query('DELETE FROM seafarer_deployment WHERE id = ?', [id])
    if (dep.job_id) {
      await pool.query(
        `UPDATE \`job\` SET seafarer_id = NULL, status = 'OPEN', updated_at = NOW()
         WHERE id = ? AND seafarer_id = ?`,
        [dep.job_id, dep.seafarer_id]
      )
    }
    return { success: true }
  },

  async getChecklist(deploymentId) {
    await this.getById(deploymentId)
    const [rows] = await pool.query(
      `SELECT dc.*,
              dca.id AS attachment_id,
              dca.original_name AS attachment_name,
              dca.file_url AS attachment_url,
              dca.mime_type AS attachment_mime_type,
              dca.file_size AS attachment_file_size,
              dca.updated_at AS attachment_updated_at
       FROM deployment_checklist dc
       LEFT JOIN deployment_checklist_attachment dca ON dca.checklist_id = dc.id
       WHERE dc.deployment_id = ?
       ORDER BY dc.id`,
      [deploymentId]
    )
    return rows
  },

  async updateChecklistItem(deploymentId, itemKey, isChecked, notes) {
    await this.getById(deploymentId)
    const checked = isChecked ? 1 : 0
    const checkedAt = isChecked ? new Date() : null
    const [result] = await pool.query(
      `UPDATE deployment_checklist
       SET is_checked = ?, checked_at = ?, notes = COALESCE(?, notes), updated_at = NOW()
       WHERE deployment_id = ? AND item_key = ?`,
      [checked, checkedAt, notes ?? null, deploymentId, itemKey]
    )
    if (result.affectedRows === 0) {
      throw { statusCode: 404, message: 'Không tìm thấy mục checklist' }
    }
    const [rows] = await pool.query(
      'SELECT * FROM deployment_checklist WHERE deployment_id = ? AND item_key = ?',
      [deploymentId, itemKey]
    )
    return rows[0]
  },

  async uploadChecklistAttachment(deploymentId, itemKey, file, uploadedBy) {
    await this.getById(deploymentId)
    if (!file) throw { statusCode: 400, message: 'Không có file được gửi lên' }

    const ext = path.extname(file.filename || '').toLowerCase()
    if (!ATTACHMENT_ALLOWED_EXTS.includes(ext)) {
      throw { statusCode: 400, message: 'Chỉ chấp nhận PDF, Word, Excel, JPG, PNG' }
    }
    if (file.mimetype && !ATTACHMENT_ALLOWED_MIMES.includes(file.mimetype)) {
      throw { statusCode: 400, message: 'Định dạng file không hợp lệ' }
    }

    const [checklistRows] = await pool.query(
      'SELECT id FROM deployment_checklist WHERE deployment_id = ? AND item_key = ? LIMIT 1',
      [deploymentId, itemKey]
    )
    if (!checklistRows[0]) {
      throw { statusCode: 404, message: 'Không tìm thấy mục checklist' }
    }
    const checklistId = checklistRows[0].id

    const uploadDir = path.resolve(
      process.cwd(),
      config.upload.dir,
      'deployments',
      String(deploymentId)
    )
    fs.mkdirSync(uploadDir, { recursive: true })
    const storedName = `${itemKey}_${Date.now()}${ext}`
    const fullPath = path.join(uploadDir, storedName)
    const fileBuffer = await file.toBuffer()
    fs.writeFileSync(fullPath, fileBuffer)
    const fileUrl = toPublicUploadUrl(fullPath)

    const [existingRows] = await pool.query(
      'SELECT id, file_path FROM deployment_checklist_attachment WHERE checklist_id = ? LIMIT 1',
      [checklistId]
    )

    if (existingRows[0]) {
      await pool.query(
        `UPDATE deployment_checklist_attachment
         SET original_name = ?, stored_name = ?, file_path = ?, file_url = ?, mime_type = ?, file_size = ?, uploaded_by = ?, updated_at = NOW()
         WHERE checklist_id = ?`,
        [
          file.filename,
          storedName,
          fullPath,
          fileUrl,
          file.mimetype || '',
          fileBuffer.length,
          uploadedBy || null,
          checklistId,
        ]
      )
      const oldPath = existingRows[0].file_path
      if (oldPath && oldPath !== fullPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    } else {
      await pool.query(
        `INSERT INTO deployment_checklist_attachment
         (checklist_id, original_name, stored_name, file_path, file_url, mime_type, file_size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          checklistId,
          file.filename,
          storedName,
          fullPath,
          fileUrl,
          file.mimetype || '',
          fileBuffer.length,
          uploadedBy || null,
        ]
      )
    }

    const [rows] = await pool.query(
      `SELECT id, checklist_id, original_name, file_url, mime_type, file_size, updated_at
       FROM deployment_checklist_attachment
       WHERE checklist_id = ? LIMIT 1`,
      [checklistId]
    )
    return rows[0]
  },

  async deleteChecklistAttachment(deploymentId, itemKey) {
    await this.getById(deploymentId)
    const [rows] = await pool.query(
      `SELECT dca.id, dca.file_path
       FROM deployment_checklist_attachment dca
       INNER JOIN deployment_checklist dc ON dc.id = dca.checklist_id
       WHERE dc.deployment_id = ? AND dc.item_key = ?
       LIMIT 1`,
      [deploymentId, itemKey]
    )
    if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy file đính kèm' }

    await pool.query('DELETE FROM deployment_checklist_attachment WHERE id = ?', [rows[0].id])
    if (rows[0].file_path && fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path)
    }
    return { success: true }
  },
}

module.exports = deploymentService
