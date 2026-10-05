const pool = require('../../config/db')
const deploymentService = require('../../services/deployment.service')
const fs = require('fs')
const path = require('path')
const config = require('../../config')

const ADMIN_ROLES = ['admin', 'operator', 'accountant']
const PAYMENT_ATTACHMENT_ALLOWED_EXTS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
]
const PAYMENT_ATTACHMENT_ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]

function adminAuth(fastify) {
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
    },
  }
}

function toPublicUploadUrl(fullPath) {
  const absoluteUploadDir = path.resolve(process.cwd(), config.upload.dir)
  const relativePath = path.relative(absoluteUploadDir, fullPath).replace(/\\/g, '/')
  return `/uploads/${relativePath}`
}

async function parsePaymentPayload(request) {
  const contentType = request.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return { fields: request.body || {}, file: null }
  }
  const fields = {}
  let file = null
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (part.fieldname === 'attachment') file = part
      continue
    }
    fields[part.fieldname] = part.value
  }
  return { fields, file }
}

async function savePaymentAttachment(jobId, paymentId, file) {
  if (!file) return null
  const ext = path.extname(file.filename || '').toLowerCase()
  if (!PAYMENT_ATTACHMENT_ALLOWED_EXTS.includes(ext)) {
    throw { statusCode: 400, message: 'Chỉ chấp nhận PDF, Word, Excel, JPG, PNG' }
  }
  if (file.mimetype && !PAYMENT_ATTACHMENT_ALLOWED_MIMES.includes(file.mimetype)) {
    throw { statusCode: 400, message: 'Định dạng file không hợp lệ' }
  }

  const uploadDir = path.resolve(
    process.cwd(),
    config.upload.dir,
    'jobs',
    String(jobId),
    'payments'
  )
  fs.mkdirSync(uploadDir, { recursive: true })
  const storedName = `payment_${paymentId}_${Date.now()}${ext}`
  const fullPath = path.join(uploadDir, storedName)
  const fileBuffer = await file.toBuffer()
  fs.writeFileSync(fullPath, fileBuffer)
  const fileUrl = toPublicUploadUrl(fullPath)
  return {
    original_name: file.filename,
    stored_name: storedName,
    file_path: fullPath,
    file_url: fileUrl,
    mime_type: file.mimetype || '',
    file_size: fileBuffer.length,
  }
}

async function syncJobPaymentSummary(jobId) {
  const [[job]] = await pool.query(
    'SELECT id, amount FROM `job` WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [jobId]
  )
  if (!job) return

  const [[agg]] = await pool.query(
    `SELECT
      COALESCE(SUM(amount), 0) AS total_paid,
      MAX(paid_at) AS latest_paid_at
     FROM job_payment
     WHERE job_id = ? AND deleted_at IS NULL`,
    [jobId]
  )
  const [[latest]] = await pool.query(
    `SELECT notes
     FROM job_payment
     WHERE job_id = ? AND deleted_at IS NULL
     ORDER BY paid_at DESC, id DESC
     LIMIT 1`,
    [jobId]
  )
  const totalPaid = Number(agg?.total_paid || 0)
  let paymentStatus = 'UNPAID'
  if (totalPaid > 0) {
    if (job.amount != null && Number(job.amount) > 0 && totalPaid >= Number(job.amount))
      paymentStatus = 'PAID'
    else paymentStatus = 'PARTIAL'
  }
  await pool.query(
    `UPDATE \`job\` SET
      payment_status = ?,
      paid_amount = ?,
      paid_at = ?,
      payment_notes = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [paymentStatus, totalPaid || null, agg?.latest_paid_at || null, latest?.notes || null, jobId]
  )
}

const SELECT_SQL = `
  SELECT c.*,
    p.company_name AS partner_name,
    p.company_name AS ship_owner_name,
    p.contact_person AS partner_contact_person,
    p.contact_phone AS partner_contact_phone,
    p.contact_email AS partner_contact_email,
    p.payment_cycle AS partner_payment_cycle,
    p.payment_method AS partner_payment_method,
    p.payment_terms AS partner_payment_terms,
    p.payment_account_name AS partner_payment_account_name,
    p.payment_account_number AS partner_payment_account_number,
    p.payment_bank_name AS partner_payment_bank_name,
    p.payment_bank_branch AS partner_payment_bank_branch,
    c.partner_id AS ship_owner_id,
    (
      SELECT jp.payment_cycle_text
      FROM job_payment jp
      WHERE jp.job_id = c.id AND jp.deleted_at IS NULL
      ORDER BY jp.paid_at DESC, jp.id DESC
      LIMIT 1
    ) AS latest_payment_cycle_text,
    sf.seafarer_code,
    sf.phone_primary AS seafarer_phone,
    sf.email AS seafarer_email,
    sf.status AS seafarer_status,
    v.vessel_name,
    c.snap_vessel_flag AS vessel_flag,
    c.snap_vessel_type AS vessel_type_name,
    c.snap_engine_type AS vessel_engine_type,
    c.snap_engine_maker AS vessel_engine_maker,
    c.snap_engine_model AS vessel_engine_model,
    c.snap_engine_kw AS vessel_main_engine_kw,
    c.snap_trade_area AS vessel_operating_area,
    c.snap_gross_tonnage AS vessel_grt,
    c.snap_deadweight AS vessel_dwt,
    r.code AS rank_code, r.name_vi AS rank_name_vi, r.name_en AS rank_name_en,
    sf.full_name AS seafarer_name
  FROM \`job\` c
  LEFT JOIN partner p ON p.id = c.partner_id
  LEFT JOIN vessel v ON v.id = c.vessel_id
  LEFT JOIN \`rank\` r ON r.id = c.rank_id
  LEFT JOIN seafarer sf ON sf.id = c.seafarer_id
`

async function snapshotVessel(jobId, vesselId) {
  if (!vesselId) return
  const [[v]] = await pool.query(
    `SELECT vessel_type, flag_country, engine_type, engine_maker, engine_model,
            engine_power_kw, gross_tonnage, deadweight, trade_area
     FROM vessel WHERE id = ?`,
    [vesselId]
  )
  if (!v) return
  await pool.query(
    `UPDATE \`job\` SET
      snap_vessel_type = ?, snap_vessel_flag = ?, snap_engine_type = ?,
      snap_engine_maker = ?, snap_engine_model = ?,
      snap_engine_kw = ?, snap_gross_tonnage = ?, snap_deadweight = ?, snap_trade_area = ?
     WHERE id = ?`,
    [
      v.vessel_type,
      v.flag_country,
      v.engine_type,
      v.engine_maker,
      v.engine_model,
      v.engine_power_kw,
      v.gross_tonnage,
      v.deadweight,
      v.trade_area,
      jobId,
    ]
  )
}

async function getPartnerDefaults(partnerId) {
  if (!partnerId) return {}
  const [[row]] = await pool.query(
    'SELECT payment_cycle, commission_rate FROM partner WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [partnerId]
  )
  return {
    payment_cycle: row?.payment_cycle || null,
    commission_rate: row?.commission_rate ?? null,
  }
}

async function jobRoutes(fastify) {
  // GET /api/v1/jobs/stats
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async () => {
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'OPEN') AS open,
        SUM(status = 'FILLED') AS filled,
        SUM(status = 'CANCELLED') AS cancelled,
        SUM(payment_status = 'UNPAID') AS unpaid,
        SUM(payment_status = 'PAID') AS paid,
        SUM(payment_status = 'PARTIAL') AS partial,
        SUM(CASE WHEN payment_status = 'PAID' THEN paid_amount ELSE 0 END) AS revenue_total
      FROM \`job\` WHERE deleted_at IS NULL
    `)

    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(paid_at, '%Y-%m') AS month,
        SUM(paid_amount) AS revenue,
        COUNT(*) AS count
      FROM \`job\`
      WHERE deleted_at IS NULL AND payment_status IN ('PAID','PARTIAL') AND paid_at IS NOT NULL
        AND paid_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(paid_at, '%Y-%m')
      ORDER BY month ASC
    `)

    return { ...totals, monthly }
  })

  // GET /api/v1/jobs
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const {
      partner_id,
      ship_owner_id,
      seafarer_id,
      status,
      rank_id,
      has_payment,
      vessel_id: vesselIdFilter,
      page: pageRaw,
      limit: limitRaw,
    } = request.query
    const page = Math.max(1, parseInt(pageRaw) || 1)
    const limit = Math.min(parseInt(limitRaw) || 20, 100)
    const offset = (page - 1) * limit

    let sql = SELECT_SQL + ' WHERE c.deleted_at IS NULL'
    const params = []

    const resolvedPartnerId = partner_id || ship_owner_id
    if (resolvedPartnerId) {
      sql += ' AND c.partner_id = ?'
      params.push(parseInt(resolvedPartnerId))
    }
    if (seafarer_id) {
      sql += ' AND c.seafarer_id = ?'
      params.push(parseInt(seafarer_id))
    }
    if (status) {
      sql += ' AND c.status = ?'
      params.push(status)
    }
    if (rank_id) {
      sql += ' AND c.rank_id = ?'
      params.push(parseInt(rank_id))
    }
    if (has_payment === 'true') {
      sql +=
        ' AND EXISTS (SELECT 1 FROM job_payment jp WHERE jp.job_id = c.id AND jp.deleted_at IS NULL)'
    } else if (has_payment === 'false') {
      sql +=
        ' AND NOT EXISTS (SELECT 1 FROM job_payment jp WHERE jp.job_id = c.id AND jp.deleted_at IS NULL)'
    }
    if (vesselIdFilter) {
      sql += ' AND c.vessel_id = ?'
      params.push(parseInt(vesselIdFilter))
    }
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const [rows] = await pool.query(sql, params)

    let countSql = `SELECT COUNT(*) AS total FROM \`job\` c
      LEFT JOIN vessel v ON v.id = c.vessel_id
      WHERE c.deleted_at IS NULL`
    const countParams = []
    if (resolvedPartnerId) {
      countSql += ' AND c.partner_id = ?'
      countParams.push(parseInt(resolvedPartnerId))
    }
    if (seafarer_id) {
      countSql += ' AND c.seafarer_id = ?'
      countParams.push(parseInt(seafarer_id))
    }
    if (status) {
      countSql += ' AND c.status = ?'
      countParams.push(status)
    }
    if (rank_id) {
      countSql += ' AND c.rank_id = ?'
      countParams.push(parseInt(rank_id))
    }
    if (has_payment === 'true') {
      countSql +=
        ' AND EXISTS (SELECT 1 FROM job_payment jp WHERE jp.job_id = c.id AND jp.deleted_at IS NULL)'
    } else if (has_payment === 'false') {
      countSql +=
        ' AND NOT EXISTS (SELECT 1 FROM job_payment jp WHERE jp.job_id = c.id AND jp.deleted_at IS NULL)'
    }
    if (vesselIdFilter) {
      countSql += ' AND c.vessel_id = ?'
      countParams.push(parseInt(vesselIdFilter))
    }
    const [[{ total }]] = await pool.query(countSql, countParams)

    return { data: rows, total, page, limit }
  })

  // GET /api/v1/jobs/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [[row]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
      parseInt(request.params.id),
    ])
    if (!row) return reply.code(404).send({ error: 'Không tìm thấy' })

    const [history] = await pool.query(
      `SELECT sd.id, sd.seafarer_id, sd.join_date, sd.sign_off_date, sd.status,
              sd.contract_start_date, sd.contract_end_date,
              sd.salary, sd.salary_actual, sd.salary_currency,
              s.full_name AS seafarer_name, s.seafarer_code,
              r.code AS rank_code, r.name_vi AS rank_name
       FROM seafarer_deployment sd
       LEFT JOIN seafarer s ON s.id = sd.seafarer_id
       LEFT JOIN \`rank\` r ON r.id = sd.rank_id
       WHERE sd.job_id = ?
       ORDER BY sd.created_at DESC`,
      [row.id]
    )
    row.deployment_history = history
    return row
  })

  // POST /api/v1/jobs
  fastify.post('/', adminAuth(fastify), async (request, reply) => {
    const {
      partner_id,
      ship_owner_id,
      vessel_id,
      rank_id,
      seafarer_id,
      start_date,
      contract_date,
      end_date,
      amount,
      currency,
      payment_cycle,
      notes,
      status,
      salary,
      salary_currency,
    } = request.body

    const resolvedPartnerId = partner_id || ship_owner_id
    if (!resolvedPartnerId || !rank_id) {
      return reply.code(400).send({ error: 'partner_id và rank_id là bắt buộc' })
    }

    const { commission_rate: bodyCommissionRate } = request.body
    const partnerDefaults = await getPartnerDefaults(resolvedPartnerId)
    const resolvedPaymentCycle = payment_cycle || partnerDefaults.payment_cycle
    const resolvedCommissionRate =
      bodyCommissionRate != null ? parseFloat(bodyCommissionRate) : partnerDefaults.commission_rate

    const [result] = await pool.query(
      `INSERT INTO \`job\`
        (partner_id, vessel_id, rank_id, seafarer_id,
         start_date, contract_date, end_date, amount, currency, payment_cycle, commission_rate, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(resolvedPartnerId),
        vessel_id ? parseInt(vessel_id) : null,
        parseInt(rank_id),
        seafarer_id ? parseInt(seafarer_id) : null,
        start_date || null,
        contract_date || null,
        end_date || null,
        amount || null,
        currency || 'VND',
        resolvedPaymentCycle,
        resolvedCommissionRate,
        notes || null,
        status || 'OPEN',
      ]
    )
    await snapshotVessel(result.insertId, vessel_id ? parseInt(vessel_id) : null)
    const [[created]] = await pool.query(SELECT_SQL + ' WHERE c.id = ?', [result.insertId])
    if (created?.seafarer_id) {
      await deploymentService.createFromJob(created, {
        salary: salary || null,
        salary_currency: salary_currency || null,
      })
    }
    return reply.code(201).send(created)
  })

  // PUT /api/v1/jobs/:id
  fastify.put('/:id', adminAuth(fastify), async (request, reply) => {
    const id = parseInt(request.params.id)
    const [[before]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
      id,
    ])
    if (!before) return reply.code(404).send({ error: 'Không tìm thấy' })
    const {
      partner_id,
      ship_owner_id,
      vessel_id,
      rank_id,
      seafarer_id,
      start_date,
      contract_date,
      end_date,
      amount,
      currency,
      payment_cycle,
      notes,
      status,
    } = request.body

    const beforeSeafarerId = before.seafarer_id ? parseInt(before.seafarer_id) : null
    const afterSeafarerId = seafarer_id ? parseInt(seafarer_id) : null

    if (afterSeafarerId && beforeSeafarerId && beforeSeafarerId !== afterSeafarerId) {
      return reply.code(400).send({
        error: 'Cần sign-off deployment hiện tại trước khi gán thuyền viên mới',
      })
    }

    const resolvedPartnerId =
      partner_id || ship_owner_id ? parseInt(partner_id || ship_owner_id) : null
    const partnerDefaults = await getPartnerDefaults(resolvedPartnerId)
    const resolvedPaymentCycle =
      payment_cycle !== undefined ? payment_cycle : partnerDefaults.payment_cycle
    const { commission_rate: bodyCommissionRate } = request.body
    const resolvedCommissionRate =
      bodyCommissionRate !== undefined
        ? bodyCommissionRate != null
          ? parseFloat(bodyCommissionRate)
          : null
        : partnerDefaults.commission_rate

    await pool.query(
      `UPDATE \`job\` SET
        partner_id = ?, vessel_id = ?, rank_id = ?, seafarer_id = ?,
        start_date = ?, contract_date = ?, end_date = ?,
        amount = ?, currency = ?, payment_cycle = ?, commission_rate = ?, notes = ?, status = ?,
        updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [
        resolvedPartnerId,
        vessel_id ? parseInt(vessel_id) : null,
        rank_id ? parseInt(rank_id) : null,
        afterSeafarerId,
        start_date || null,
        contract_date || null,
        end_date || null,
        amount || null,
        currency || 'VND',
        resolvedPaymentCycle,
        resolvedCommissionRate,
        notes || null,
        status || 'OPEN',
        id,
      ]
    )
    await snapshotVessel(id, vessel_id ? parseInt(vessel_id) : null)
    const [[updated]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
      id,
    ])
    if (!updated) return reply.code(404).send({ error: 'Không tìm thấy' })

    if (afterSeafarerId && !beforeSeafarerId) {
      await deploymentService.createFromJob(updated)
    }
    return updated
  })

  // POST /api/v1/jobs/:id/assign - gán thuyền viên với ngày lên/rời tàu tùy chỉnh
  fastify.post('/:id/assign', adminAuth(fastify), async (request, reply) => {
    try {
      const id = parseInt(request.params.id)
      const {
        seafarer_id,
        join_date,
        sign_off_date,
        salary,
        salary_actual,
        salary_currency,
        contract_start_date,
        contract_end_date,
      } = request.body
      if (!seafarer_id) return reply.code(400).send({ error: 'Thiếu seafarer_id' })

      const [[before]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
        id,
      ])
      if (!before) return reply.code(404).send({ error: 'Không tìm thấy job' })

      const beforeSeafarerId = before.seafarer_id ? parseInt(before.seafarer_id) : null
      const afterSeafarerId = parseInt(seafarer_id)

      if (beforeSeafarerId && beforeSeafarerId !== afterSeafarerId) {
        return reply.code(400).send({
          error: 'Cần sign-off deployment hiện tại trước khi gán thuyền viên mới',
        })
      }

      await pool.query(
        `UPDATE \`job\` SET seafarer_id = ?, status = 'FILLED', updated_at = NOW()
         WHERE id = ? AND deleted_at IS NULL`,
        [afterSeafarerId, id]
      )

      const [[updated]] = await pool.query(
        SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL',
        [id]
      )
      if (!updated) return reply.code(404).send({ error: 'Không tìm thấy job' })

      if (!beforeSeafarerId) {
        await deploymentService.createFromJob(updated, {
          join_date: join_date || null,
          sign_off_date: sign_off_date || null,
          salary: salary || null,
          salary_actual: salary_actual || null,
          salary_currency: salary_currency || null,
          contract_start_date: contract_start_date || null,
          contract_end_date: contract_end_date || null,
        })
      }

      return updated
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // PUT /api/v1/jobs/:id/payment - cập nhật trạng thái thanh toán
  fastify.put('/:id/payment', adminAuth(fastify), async (request, reply) => {
    const id = parseInt(request.params.id)
    const { payment_status, paid_amount, paid_at, payment_notes } = request.body

    if (!payment_status) return reply.code(400).send({ error: 'payment_status là bắt buộc' })

    await pool.query(
      `UPDATE \`job\` SET
        payment_status = ?,
        paid_amount = ?,
        paid_at = ?,
        payment_notes = ?,
        updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [
        payment_status,
        paid_amount || null,
        payment_status === 'PAID' ? paid_at || new Date() : paid_at || null,
        payment_notes || null,
        id,
      ]
    )
    const [[updated]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
      id,
    ])
    if (!updated) return reply.code(404).send({ error: 'Không tìm thấy' })
    return updated
  })

  // GET /api/v1/jobs/:id/payments
  fastify.get('/:id/payments', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const jobId = parseInt(request.params.id)
    const [[job]] = await pool.query('SELECT id FROM `job` WHERE id = ? AND deleted_at IS NULL', [
      jobId,
    ])
    if (!job) return reply.code(404).send({ error: 'Không tìm thấy' })
    const [rows] = await pool.query(
      `SELECT id, job_id, payment_cycle_text, amount, paid_at, notes,
              attachment_original_name, attachment_url,
              created_at, updated_at
       FROM job_payment
       WHERE job_id = ? AND deleted_at IS NULL
       ORDER BY paid_at DESC, id DESC`,
      [jobId]
    )
    return { data: rows }
  })

  // POST /api/v1/jobs/:id/payments
  fastify.post('/:id/payments', adminAuth(fastify), async (request, reply) => {
    const jobId = parseInt(request.params.id)
    const [[job]] = await pool.query('SELECT id FROM `job` WHERE id = ? AND deleted_at IS NULL', [
      jobId,
    ])
    if (!job) return reply.code(404).send({ error: 'Không tìm thấy' })

    const { fields, file } = await parsePaymentPayload(request)
    const paymentCycleText = String(fields.payment_cycle_text || '').trim()
    const amount = fields.amount != null && fields.amount !== '' ? Number(fields.amount) : null
    const paidAt = fields.paid_at || null
    const notes = fields.notes || null
    if (!paymentCycleText) {
      return reply.code(400).send({ error: 'payment_cycle_text là bắt buộc' })
    }
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      return reply.code(400).send({ error: 'amount phải lớn hơn 0' })
    }

    const [insertResult] = await pool.query(
      `INSERT INTO job_payment (job_id, payment_cycle_text, amount, paid_at, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [jobId, paymentCycleText, amount, paidAt, notes]
    )
    const paymentId = insertResult.insertId

    if (file) {
      const attachment = await savePaymentAttachment(jobId, paymentId, file)
      await pool.query(
        `UPDATE job_payment
         SET attachment_original_name = ?, attachment_stored_name = ?, attachment_path = ?, attachment_url = ?, attachment_mime_type = ?, attachment_size = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          attachment.original_name,
          attachment.stored_name,
          attachment.file_path,
          attachment.file_url,
          attachment.mime_type,
          attachment.file_size,
          paymentId,
        ]
      )
    }

    await syncJobPaymentSummary(jobId)

    const [[created]] = await pool.query(
      `SELECT id, job_id, payment_cycle_text, amount, paid_at, notes,
              attachment_original_name, attachment_url, created_at, updated_at
       FROM job_payment
       WHERE id = ?`,
      [paymentId]
    )
    return reply.code(201).send(created)
  })

  // PUT /api/v1/jobs/:id/payments/:paymentId
  fastify.put('/:id/payments/:paymentId', adminAuth(fastify), async (request, reply) => {
    const jobId = parseInt(request.params.id)
    const paymentId = parseInt(request.params.paymentId)
    const [[payment]] = await pool.query(
      'SELECT * FROM job_payment WHERE id = ? AND job_id = ? AND deleted_at IS NULL',
      [paymentId, jobId]
    )
    if (!payment) return reply.code(404).send({ error: 'Không tìm thấy bản ghi thanh toán' })

    const { fields, file } = await parsePaymentPayload(request)
    const paymentCycleText =
      fields.payment_cycle_text !== undefined
        ? String(fields.payment_cycle_text || '').trim()
        : payment.payment_cycle_text
    const amount =
      fields.amount !== undefined && fields.amount !== '' ? Number(fields.amount) : payment.amount
    const paidAt = fields.paid_at !== undefined ? fields.paid_at || null : payment.paid_at
    const notes = fields.notes !== undefined ? fields.notes || null : payment.notes
    if (!paymentCycleText) {
      return reply.code(400).send({ error: 'payment_cycle_text là bắt buộc' })
    }
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      return reply.code(400).send({ error: 'amount phải lớn hơn 0' })
    }

    let attachmentPatch = null
    if (file) {
      attachmentPatch = await savePaymentAttachment(jobId, paymentId, file)
      if (
        payment.attachment_path &&
        payment.attachment_path !== attachmentPatch.file_path &&
        fs.existsSync(payment.attachment_path)
      ) {
        fs.unlinkSync(payment.attachment_path)
      }
    }

    await pool.query(
      `UPDATE job_payment SET
        payment_cycle_text = ?, amount = ?, paid_at = ?, notes = ?,
        attachment_original_name = ?, attachment_stored_name = ?, attachment_path = ?, attachment_url = ?, attachment_mime_type = ?, attachment_size = ?,
        updated_at = NOW()
       WHERE id = ? AND job_id = ?`,
      [
        paymentCycleText,
        amount,
        paidAt,
        notes,
        attachmentPatch?.original_name || payment.attachment_original_name || null,
        attachmentPatch?.stored_name || payment.attachment_stored_name || null,
        attachmentPatch?.file_path || payment.attachment_path || null,
        attachmentPatch?.file_url || payment.attachment_url || null,
        attachmentPatch?.mime_type || payment.attachment_mime_type || null,
        attachmentPatch?.file_size || payment.attachment_size || null,
        paymentId,
        jobId,
      ]
    )

    await syncJobPaymentSummary(jobId)

    const [[updated]] = await pool.query(
      `SELECT id, job_id, payment_cycle_text, amount, paid_at, notes,
              attachment_original_name, attachment_url, created_at, updated_at
       FROM job_payment
       WHERE id = ?`,
      [paymentId]
    )
    return updated
  })

  // DELETE /api/v1/jobs/:id - admin only
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    if (!ADMIN_ROLES.includes(request.user.role))
      return reply.code(403).send({ error: 'Không có quyền xóa' })
    const id = parseInt(request.params.id)
    const [[before]] = await pool.query(SELECT_SQL + ' WHERE c.id = ? AND c.deleted_at IS NULL', [
      id,
    ])
    await pool.query('UPDATE `job` SET deleted_at = NOW() WHERE id = ?', [id])
    if (before?.seafarer_id) {
      await deploymentService.cancelByJobAndSeafarer(
        id,
        parseInt(before.seafarer_id),
        'Hủy do xóa công việc'
      )
    }
    return { success: true }
  })
}

module.exports = jobRoutes
