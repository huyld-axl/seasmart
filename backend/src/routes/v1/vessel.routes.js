const pool = require('../../config/db')
const { invalidateCache } = require('./lookup.routes')
const vesselExternalService = require('../../services/vessel_external.service')
const vesselDbService = require('../../services/vessel_db.service')

const ADMIN_ROLES = ['admin', 'operator']

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

const VESSEL_SELECT = `
  SELECT v.*,
    v.vessel_type AS vessel_type_name,
    v.flag_country AS flag_country_name
  FROM vessel v
`

function pickVesselFields(body) {
  const {
    vessel_name,
    imo_number,
    mmsi,
    call_sign,
    trade_area,
    vessel_name_prev,
    vessel_type,
    flag_country,
    port_of_registry_id,
    gross_tonnage,
    net_tonnage,
    deadweight,
    length_overall,
    year_built,
    classification_society,
    class_status,
    lifecycle_status,
    engine_power_kw,
    engine_type,
    dp_class,
    has_boiler,
    has_refrigeration,
    passenger_capacity,
    crew_capacity,
    ship_owner_name,
    ship_owner_code,
    technical_manager,
    commercial_manager,
    status,
    notes,
  } = body
  return {
    vessel_name,
    imo_number: imo_number || null,
    mmsi: mmsi || null,
    call_sign: call_sign || null,
    trade_area:
      trade_area === null || trade_area === undefined
        ? null
        : String(trade_area).trim() === ''
          ? null
          : String(trade_area).trim().slice(0, 255),
    vessel_name_prev: vessel_name_prev || null,
    vessel_type:
      vessel_type === null || vessel_type === undefined
        ? null
        : String(vessel_type).trim() === ''
          ? null
          : String(vessel_type).trim(),
    flag_country:
      flag_country === null || flag_country === undefined
        ? null
        : String(flag_country).trim() === ''
          ? null
          : String(flag_country).trim(),
    port_of_registry_id: port_of_registry_id || null,
    gross_tonnage: gross_tonnage || null,
    net_tonnage: net_tonnage || null,
    deadweight: deadweight || null,
    length_overall: length_overall || null,
    year_built: year_built || null,
    classification_society: classification_society || null,
    class_status: class_status || null,
    lifecycle_status: lifecycle_status || 'IN_SERVICE',
    engine_power_kw: engine_power_kw || null,
    engine_type: engine_type || null,
    dp_class: dp_class || null,
    has_boiler: has_boiler ? 1 : 0,
    has_refrigeration: has_refrigeration ? 1 : 0,
    passenger_capacity: passenger_capacity || null,
    crew_capacity: crew_capacity || null,
    ship_owner_name: ship_owner_name || null,
    ship_owner_code: ship_owner_code || null,
    technical_manager: technical_manager || null,
    commercial_manager: commercial_manager || null,
    status: status || 'IN_SERVICE',
    notes: notes || null,
  }
}

async function vesselRoutes(fastify) {
  // ── Vessel CRUD ────────────────────────────────────────────────────────────

  // GET /api/v1/vessels
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const {
      search,
      vessel_name,
      ship_owner_name,
      vessel_type,
      flag_country,
      status,
      page: pageRaw,
      limit: limitRaw,
    } = request.query
    const page = Math.max(1, parseInt(pageRaw) || 1)
    const limit = Math.min(parseInt(limitRaw) || 20, 100)
    const offset = (page - 1) * limit

    let where = ' WHERE v.deleted_at IS NULL'
    const params = []

    if (search) {
      const q = `%${search}%`
      where +=
        ' AND (v.imo_number LIKE ? OR v.vessel_name LIKE ? OR v.ship_owner_name LIKE ? OR v.vessel_type LIKE ? OR v.flag_country LIKE ? OR v.status LIKE ?)'
      params.push(q, q, q, q, q, q)
    }
    if (vessel_name) {
      where += ' AND v.vessel_name LIKE ?'
      params.push(`%${vessel_name}%`)
    }
    if (ship_owner_name) {
      where += ' AND v.ship_owner_name LIKE ?'
      params.push(`%${ship_owner_name}%`)
    }
    if (vessel_type) {
      where += ' AND v.vessel_type = ?'
      params.push(vessel_type)
    }
    if (flag_country) {
      where += ' AND v.flag_country = ?'
      params.push(flag_country)
    }
    if (status) {
      where += ' AND v.status = ?'
      params.push(status)
    }

    const sql = VESSEL_SELECT + where + ' ORDER BY v.vessel_name LIMIT ? OFFSET ?'
    const [rows] = await pool.query(sql, [...params, limit, offset])

    const countSql = 'SELECT COUNT(*) AS total FROM vessel v' + where
    const [[{ total }]] = await pool.query(countSql, params)
    return { data: rows, total, page, limit }
  })

  // GET /api/v1/vessels/name-search?q=... — tìm từ vessel table + ship_catalog (nếu đã seed)
  fastify.get('/name-search', { onRequest: [fastify.authenticate] }, async (request) => {
    const q = String(request.query.q || '').trim()
    if (q.length < 2) return []
    const term = `%${q}%`

    // tìm trong vessel table trước
    const [vesselRows] = await pool.query(
      `SELECT id AS vessel_id, imo_number AS imo_no, vessel_name AS ship_name,
              vessel_type AS ship_type, flag_country AS country_name, NULL AS ex_names
       FROM vessel
       WHERE (vessel_name LIKE ? OR imo_number LIKE ?) AND deleted_at IS NULL
       ORDER BY vessel_name LIMIT 10`,
      [term, term]
    )

    // tìm trong catalog (nếu có), loại trùng IMO với vessel
    const existingImos = new Set(vesselRows.map((r) => r.imo_no).filter(Boolean))
    const catalogRows = await vesselDbService.searchByName(q)
    const catalogFiltered = catalogRows
      .filter((r) => !existingImos.has(r.imo_no))
      .slice(0, 20 - vesselRows.length)
      .map((r) => ({ ...r, vessel_id: null }))

    return [...vesselRows, ...catalogFiltered]
  })

  // GET /api/v1/vessels/ship-db/status
  fastify.get('/ship-db/status', adminAuth(fastify), async () => {
    return {
      db_file_exists: vesselDbService.dbFileExists(),
      catalog_count: await vesselDbService.catalogCount(),
    }
  })

  // POST /api/v1/vessels/ship-db/upload — upload ships_plain.db (max 100MB)
  fastify.post('/ship-db/upload', adminAuth(fastify), async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 100 * 1024 * 1024 } })
    if (!data) return reply.code(400).send({ error: 'Thiếu file' })
    if (!data.filename.endsWith('.db')) {
      return reply.code(400).send({ error: 'Chỉ chấp nhận file .db' })
    }
    const buffer = await data.toBuffer()
    vesselDbService.saveUploadedFile(buffer)
    return { success: true, size_mb: (buffer.length / 1024 / 1024).toFixed(1) }
  })

  // POST /api/v1/vessels/ship-db/seed — đọc SQLite → insert MySQL ship_catalog
  fastify.post('/ship-db/seed', adminAuth(fastify), async (request, reply) => {
    try {
      return await vesselDbService.seedFromSqlite()
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // GET /api/v1/vessels/types — distinct vessel_type values from vessel table
  fastify.get('/types', { onRequest: [fastify.authenticate] }, async () => {
    const [rows] = await pool.query(
      'SELECT DISTINCT vessel_type FROM vessel WHERE vessel_type IS NOT NULL AND deleted_at IS NULL ORDER BY vessel_type'
    )
    return rows.map((r) => r.vessel_type)
  })

  // GET /api/v1/vessels/external/:imo
  // Fetch vessel data from external API, decrypt, save to DB and return
  fastify.get('/external/:imo', adminAuth(fastify), async (request, reply) => {
    const imo = String(request.params.imo).trim()
    const isForced = request.query?.refresh === '1' || request.query?.refresh === 1

    // cooldown 60s — bỏ qua nếu force refresh
    if (!isForced) {
      const [[existing]] = await pool.query(
        'SELECT updated_at FROM vessel WHERE imo_number = ? AND deleted_at IS NULL LIMIT 1',
        [imo]
      )
      if (existing?.updated_at) {
        const secsSince = (Date.now() - new Date(existing.updated_at).getTime()) / 1000
        if (secsSince < 60) {
          const retryAfter = Math.ceil(60 - secsSince)
          return reply.code(429).send({
            error: `Vui lòng chờ ${retryAfter} giây trước khi cập nhật lại`,
            retry_after: retryAfter,
          })
        }
      }
    }

    try {
      const result = await vesselExternalService.fetchAndUpsertByImo(imo, isForced)
      invalidateCache('vessels')
      return result
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message, details: e.details || null })
    }
  })

  // GET /api/v1/vessels/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [[row]] = await pool.query(VESSEL_SELECT + ' WHERE v.id = ? AND v.deleted_at IS NULL', [
      parseInt(request.params.id),
    ])
    if (!row) return reply.code(404).send({ error: 'Không tìm thấy tàu' })
    return row
  })

  // POST /api/v1/vessels
  fastify.post('/', adminAuth(fastify), async (request, reply) => {
    const fields = pickVesselFields(request.body)
    if (!fields.imo_number || !/^\d{7}$/.test(String(fields.imo_number))) {
      return reply.code(400).send({ error: 'IMO là bắt buộc và phải gồm đúng 7 chữ số' })
    }

    let result
    try {
      ;[result] = await pool.query(
        `INSERT INTO vessel (vessel_name, imo_number, mmsi, call_sign, trade_area, vessel_name_prev,
          vessel_type, flag_country, port_of_registry_id,
          gross_tonnage, net_tonnage, deadweight, length_overall, year_built,
          classification_society, class_status, lifecycle_status,
          engine_power_kw, engine_type, dp_class, has_boiler, has_refrigeration,
          passenger_capacity, crew_capacity,
          ship_owner_name, ship_owner_code, technical_manager, commercial_manager, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fields.vessel_name,
          fields.imo_number,
          fields.mmsi,
          fields.call_sign,
          fields.trade_area,
          fields.vessel_name_prev,
          fields.vessel_type,
          fields.flag_country,
          fields.port_of_registry_id,
          fields.gross_tonnage,
          fields.net_tonnage,
          fields.deadweight,
          fields.length_overall,
          fields.year_built,
          fields.classification_society,
          fields.class_status,
          fields.lifecycle_status,
          fields.engine_power_kw,
          fields.engine_type,
          fields.dp_class,
          fields.has_boiler,
          fields.has_refrigeration,
          fields.passenger_capacity,
          fields.crew_capacity,
          fields.ship_owner_name,
          fields.ship_owner_code,
          fields.technical_manager,
          fields.commercial_manager,
          fields.status,
          fields.notes,
        ]
      )
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return reply.code(409).send({ error: 'IMO đã tồn tại trong hệ thống' })
      }
      throw error
    }
    invalidateCache('vessels')
    const [[created]] = await pool.query(VESSEL_SELECT + ' WHERE v.id = ?', [result.insertId])
    return reply.code(201).send(created)
  })

  // PUT /api/v1/vessels/:id
  fastify.put('/:id', adminAuth(fastify), async (request, reply) => {
    const id = parseInt(request.params.id)
    const fields = pickVesselFields(request.body)
    if (!fields.imo_number || !/^\d{7}$/.test(String(fields.imo_number))) {
      return reply.code(400).send({ error: 'IMO là bắt buộc và phải gồm đúng 7 chữ số' })
    }

    try {
      await pool.query(
        `UPDATE vessel SET
          vessel_name = ?, imo_number = ?, mmsi = ?, call_sign = ?, trade_area = ?, vessel_name_prev = ?,
          vessel_type = ?, flag_country = ?, port_of_registry_id = ?,
          gross_tonnage = ?, net_tonnage = ?, deadweight = ?, length_overall = ?, year_built = ?,
          classification_society = ?, class_status = ?, lifecycle_status = ?,
          engine_power_kw = ?, engine_type = ?, dp_class = ?, has_boiler = ?, has_refrigeration = ?,
          passenger_capacity = ?, crew_capacity = ?,
          ship_owner_name = ?, ship_owner_code = ?, technical_manager = ?, commercial_manager = ?,
          status = ?, notes = ?, updated_at = NOW()
         WHERE id = ? AND deleted_at IS NULL`,
        [
          fields.vessel_name,
          fields.imo_number,
          fields.mmsi,
          fields.call_sign,
          fields.trade_area,
          fields.vessel_name_prev,
          fields.vessel_type,
          fields.flag_country,
          fields.port_of_registry_id,
          fields.gross_tonnage,
          fields.net_tonnage,
          fields.deadweight,
          fields.length_overall,
          fields.year_built,
          fields.classification_society,
          fields.class_status,
          fields.lifecycle_status,
          fields.engine_power_kw,
          fields.engine_type,
          fields.dp_class,
          fields.has_boiler,
          fields.has_refrigeration,
          fields.passenger_capacity,
          fields.crew_capacity,
          fields.ship_owner_name,
          fields.ship_owner_code,
          fields.technical_manager,
          fields.commercial_manager,
          fields.status,
          fields.notes,
          id,
        ]
      )
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return reply.code(409).send({ error: 'IMO đã tồn tại trong hệ thống' })
      }
      throw error
    }
    invalidateCache('vessels')
    const [[updated]] = await pool.query(
      VESSEL_SELECT + ' WHERE v.id = ? AND v.deleted_at IS NULL',
      [id]
    )
    if (!updated) return reply.code(404).send({ error: 'Không tìm thấy tàu' })
    return updated
  })

  // DELETE /api/v1/vessels/:id
  fastify.delete('/:id', adminAuth(fastify), async (request, reply) => {
    if (request.user.role !== 'admin')
      return reply.code(403).send({ error: 'Chỉ admin mới có quyền xóa' })
    await pool.query('UPDATE vessel SET deleted_at = NOW() WHERE id = ?', [
      parseInt(request.params.id),
    ])
    invalidateCache('vessels')
    return { success: true }
  })

  // ── Vessel Certificates sub-routes ─────────────────────────────────────────

  // GET /api/v1/vessels/:id/certificates
  fastify.get(
    '/:id/certificates',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const vesselId = parseInt(request.params.id)
      const [[vessel]] = await pool.query(
        'SELECT id FROM vessel WHERE id = ? AND deleted_at IS NULL',
        [vesselId]
      )
      if (!vessel) return reply.code(404).send({ error: 'Không tìm thấy tàu' })

      const [rows] = await pool.query(
        `SELECT vc.*, vct.code AS cert_code, vct.name_vi AS cert_name_vi, vct.name_en AS cert_name_en,
              vct.validity_years
       FROM vessel_certificate vc
       JOIN vessel_cert_type vct ON vct.id = vc.cert_type_id
       WHERE vc.vessel_id = ? AND vc.deleted_at IS NULL
       ORDER BY vc.expiry_date ASC`,
        [vesselId]
      )
      return rows
    }
  )

  // POST /api/v1/vessels/:id/certificates
  fastify.post('/:id/certificates', adminAuth(fastify), async (request, reply) => {
    const vesselId = parseInt(request.params.id)
    const {
      cert_type_id,
      certificate_number,
      issued_date,
      expiry_date,
      issued_by,
      surveyor,
      status,
      document_url,
      notes,
    } = request.body

    if (!cert_type_id) return reply.code(400).send({ error: 'cert_type_id là bắt buộc' })

    const [result] = await pool.query(
      `INSERT INTO vessel_certificate
        (vessel_id, cert_type_id, certificate_number, issued_date, expiry_date,
         issued_by, surveyor, status, document_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vesselId,
        parseInt(cert_type_id),
        certificate_number || null,
        issued_date || null,
        expiry_date || null,
        issued_by || null,
        surveyor || null,
        status || 'VALID',
        document_url || null,
        notes || null,
      ]
    )
    const [[created]] = await pool.query(
      `SELECT vc.*, vct.code AS cert_code, vct.name_vi AS cert_name_vi, vct.name_en AS cert_name_en,
              vct.validity_years
       FROM vessel_certificate vc
       JOIN vessel_cert_type vct ON vct.id = vc.cert_type_id
       WHERE vc.id = ?`,
      [result.insertId]
    )
    return reply.code(201).send(created)
  })

  // PUT /api/v1/vessels/:id/certificates/:certId
  fastify.put('/:id/certificates/:certId', adminAuth(fastify), async (request, reply) => {
    const certId = parseInt(request.params.certId)
    const {
      cert_type_id,
      certificate_number,
      issued_date,
      expiry_date,
      issued_by,
      surveyor,
      status,
      document_url,
      notes,
    } = request.body

    await pool.query(
      `UPDATE vessel_certificate SET
        cert_type_id = ?, certificate_number = ?, issued_date = ?, expiry_date = ?,
        issued_by = ?, surveyor = ?, status = ?, document_url = ?, notes = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [
        cert_type_id ? parseInt(cert_type_id) : null,
        certificate_number || null,
        issued_date || null,
        expiry_date || null,
        issued_by || null,
        surveyor || null,
        status || 'VALID',
        document_url || null,
        notes || null,
        certId,
      ]
    )
    const [[updated]] = await pool.query(
      `SELECT vc.*, vct.code AS cert_code, vct.name_vi AS cert_name_vi, vct.name_en AS cert_name_en,
              vct.validity_years
       FROM vessel_certificate vc
       JOIN vessel_cert_type vct ON vct.id = vc.cert_type_id
       WHERE vc.id = ? AND vc.deleted_at IS NULL`,
      [certId]
    )
    if (!updated) return reply.code(404).send({ error: 'Không tìm thấy' })
    return updated
  })

  // DELETE /api/v1/vessels/:id/certificates/:certId
  fastify.delete('/:id/certificates/:certId', adminAuth(fastify), async (request, reply) => {
    await pool.query(
      'UPDATE vessel_certificate SET deleted_at = NOW() WHERE id = ? AND vessel_id = ?',
      [parseInt(request.params.certId), parseInt(request.params.id)]
    )
    return { success: true }
  })

  // GET /api/v1/vessels/cert-types - danh sách loại chứng chỉ tàu
  fastify.get('/cert-types', { onRequest: [fastify.authenticate] }, async () => {
    const [rows] = await pool.query(
      'SELECT * FROM vessel_cert_type ORDER BY is_imo_mandatory DESC, name_vi'
    )
    return rows
  })
}

module.exports = vesselRoutes
