const fs = require('fs')
const config = require('../../config')
const pool = require('../../config/db')
const { fleetService, VESSEL_STATUSES } = require('../../services/fleet.service')
const { shipCatalogService } = require('../../services/ship_catalog.service')
const { vesselLookup } = require('../../services/vessel_lookup')
const { createRateWindow } = require('../../utils/rate_window')
const businessCardScan = require('../../services/business_card_scan.service')
const { ownerIdFor } = require('../../utils/scope')
const { MAX_FILE_BYTES } = require('../../constants/document_types')

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
const listQuery = {
  type: 'object',
  properties: {
    search: { type: 'string', maxLength: 100 },
    status: { type: 'string', enum: VESSEL_STATUSES },
    active: { type: 'string', enum: ['0', '1'] },
    country_id: { type: 'integer', minimum: 1 },
    ship_owner_id: { type: 'integer', minimum: 1 },
    missing: { type: 'string', pattern: '^(primary|phone|email)(,(primary|phone|email))*$' },
    channels: { type: 'string', pattern: '^(zalo|whatsapp|line|wechat)(,(zalo|whatsapp|line|wechat))*$' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
}
const catalogQuery = {
  type: 'object',
  properties: {
    q: { type: 'string', maxLength: 100 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
  },
}
const lookupParams = { type: 'object', required: ['imo'], properties: { imo: { type: 'string', pattern: '^\\d{7}$' } } }
// 20 lượt tra mỗi phút cho mỗi người dùng.
const lookupLimiter = createRateWindow({ max: 20, windowMs: 60 * 1000 })
async function requireAnyVesselWrite(request, reply) {
  const have = request.access?.permissions
  if (!have || !(have.has('vessel.create') || have.has('vessel.update'))) return reply.code(403).send({ error: 'Không có quyền' })
}
const nullableInt = { type: ['integer', 'null'], minimum: 1 }
const nullableText = (maxLength) => ({ type: ['string', 'null'], maxLength })
const nullableNumber = { type: ['number', 'null'], minimum: 0 }
const nullableCount = { type: ['integer', 'null'], minimum: 0 }
const flag = { type: 'integer', enum: [0, 1] }
const vesselBody = {
  type: 'object',
  properties: {
    vessel_name: { type: 'string', minLength: 1, maxLength: 150 },
    vessel_name_prev: nullableText(150),
    imo_number: { type: ['string', 'null'], pattern: '^(\\d{7})?$' },
    call_sign: nullableText(10),
    mmsi: { type: ['string', 'null'], pattern: '^(\\d{9})?$' },
    vessel_type_id: nullableInt,
    flag_country_id: nullableInt,
    year_built: { type: ['integer', 'null'], minimum: 1900, maximum: 2100 },
    port_of_registry_id: nullableInt,
    classification_society: nullableText(50),
    status: { type: 'string', enum: VESSEL_STATUSES },
    class_status: { type: ['string', 'null'], enum: ['IN_CLASS', 'SUSPENDED', 'WITHDRAWN', 'UNCLASSED', null] },
    gross_tonnage: nullableNumber,
    net_tonnage: nullableNumber,
    deadweight: nullableNumber,
    length_overall: nullableNumber,
    passenger_capacity: nullableCount,
    crew_capacity: nullableCount,
    engine_power_kw: nullableNumber,
    engine_type: nullableText(100),
    dp_class: { type: ['string', 'null'], enum: ['NONE', 'DP1', 'DP2', 'DP3', null] },
    has_boiler: flag,
    has_refrigeration: flag,
    ship_owner_id: nullableInt,
    technical_manager: nullableText(200),
    commercial_manager: nullableText(200),
    notes: nullableText(500),
  },
}
const ownerBody = {
  type: 'object',
  properties: {
    company_name: { type: 'string', minLength: 1, maxLength: 200 },
    company_name_en: nullableText(200),
    country_id: nullableInt,
    tax_id: nullableText(50),
    address: nullableText(500),
    phone: nullableText(30), zalo: nullableText(300),
    fax: nullableText(30),
    email: nullableText(150),
    website: nullableText(200),
    contacts: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: { name: nullableText(150), position: nullableText(100), phone: nullableText(30), zalo: nullableText(300), email: nullableText(150), whatsapp: nullableText(300), line_id: nullableText(300), wechat_id: nullableText(300), is_primary: { type: 'boolean' } },
      },
    },
    is_active: flag,
    notes: nullableText(2000),
  },
}

// Một bộ CRUD có xoá mềm và khôi phục cho tàu hoặc đối tác. `extra` thêm các route chỉ đọc riêng.
// `perm`: mục quyền (vessel | partner).
function crudRoutes({ table, perm, list, get, create, update, extra }) {
  return async function (fastify) {
    const read = { onRequest: [fastify.authenticate, fastify.can(`${perm}.view`)] }
    const onRequest = (action) => ({ onRequest: [fastify.authenticate, fastify.can(`${perm}.${action}`)] })

    fastify.get('/', { ...read, schema: { querystring: listQuery } }, async (request) => list(pool, request.query))
    fastify.get('/:id', { ...read, schema: { params: idParams } }, async (request) => get(pool, request.params.id))
    if (extra) extra(fastify, { read, idParams })
    fastify.post('/', { ...onRequest('create'), schema: { body: { ...create.schema, required: create.required } } }, async (request, reply) => {
      const row = await create.fn(pool, request.body)
      return reply.code(201).send(row)
    })
    fastify.put('/:id', { ...onRequest('update'), schema: { params: idParams, body: update.schema } }, async (request) => update.fn(pool, request.params.id, request.body, request.user.id))
    fastify.delete('/:id', { ...onRequest('delete'), schema: { params: idParams } }, async (request) => fleetService.softDelete(pool, table, request.params.id))
    fastify.post('/:id/restore', { ...onRequest('update'), schema: { params: idParams } }, async (request) => fleetService.restore(pool, table, request.params.id))
  }
}

async function fleetRoutes(fastify) {
  fastify.register(
    crudRoutes({
      table: 'vessel',
      perm: 'vessel',
      list: (db, query) => fleetService.listVessels(db, query),
      get: (db, id) => fleetService.getVesselDetail(db, id),
      create: { schema: vesselBody, required: ['vessel_name'], fn: (db, body) => fleetService.createVessel(db, body) },
      update: { schema: vesselBody, fn: (db, id, body) => fleetService.updateVessel(db, id, body) },
      extra: (app, { read, idParams: params }) => {
        app.get('/:id/service', { ...read, schema: { params } }, async (request) => fleetService.listVesselService(pool, request.params.id))
        // Danh mục tàu thế giới (ship_catalog), tách khỏi bảng vessel. Tàu đã có trong MCAH không nằm trong kết quả.
        app.get('/catalog', { ...read, schema: { querystring: catalogQuery } }, async (request) => shipCatalogService.search(pool, request.query))
        // Lấy thông tin thông minh: tra IMO ở nguồn ngoài, trả bản đề xuất (không ghi vào vessel). Thêm tàu (create) hoặc sửa tàu (update) đều dùng.
        app.get('/lookup-status', { ...read }, async () => ({
          enabled: vesselLookup.enabled(),
          cooldown_seconds: vesselLookup.cooldownSeconds,
          global_cooldown_seconds: vesselLookup.globalCooldownSeconds,
          // Giây còn lại của trần chung: giao diện khoá các nút Lấy thông minh và đếm ngược theo số này.
          wait_seconds: vesselLookup.enabled() ? await vesselLookup.waitSeconds(pool) : 0,
        }))
        app.get('/lookup/:imo', { onRequest: [app.authenticate, requireAnyVesselWrite], schema: { params: lookupParams } }, async (request, reply) => {
          const limit = lookupLimiter.hit(request.user.id)
          if (!limit.ok) {
            reply.header('Retry-After', limit.retryAfter)
            return reply.code(429).send({ error: `Tra quá nhiều lần. Thử lại sau ${limit.retryAfter} giây.`, retry_after: limit.retryAfter })
          }
          try {
            return await vesselLookup.lookup(pool, request.params.imo, request.user.id)
          } catch (error) {
            // Bộ xử lý lỗi chung che mọi 5xx thành 500 và bỏ trường phụ. Lỗi của nguồn ngoài (502) và trần chung (429) cần trả đúng mã kèm retry_after để giao diện báo và đếm ngược.
            if (error.statusCode === 502 || error.statusCode === 429) {
              if (error.retry_after) reply.header('Retry-After', error.retry_after)
              return reply.code(error.statusCode).send({ error: error.message, retry_after: error.retry_after ?? null })
            }
            throw error
          }
        })
      },
    }),
    { prefix: '/vessels' }
  )
  fastify.register(
    crudRoutes({
      table: 'ship_owner',
      perm: 'partner',
      list: (db, query) => fleetService.listOwners(db, query),
      get: (db, id) => fleetService.getOwnerDetail(db, id),
      create: { schema: ownerBody, required: ['company_name'], fn: (db, body) => fleetService.createOwner(db, body) },
      update: { schema: ownerBody, fn: (db, id, body, actorId) => fleetService.updateOwner(db, id, body, actorId) },
      extra: (app, { read, idParams: params }) => {
        app.get('/:id/revisions', { ...read, schema: { params, querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, offset: { type: 'integer', minimum: 0, default: 0 } } } } }, async (request) => {
          await fleetService.getOwner(pool, request.params.id)
          const { limit = 20, offset = 0 } = request.query
          const [rows] = await pool.query('SELECT r.*, u.email AS changed_by_email FROM ship_owner_revision r LEFT JOIN "user" u ON u.id = r.changed_by WHERE r.ship_owner_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?', [request.params.id, limit + 1, offset])
          const [countries] = await pool.query('SELECT id, name_vi, name_en FROM country')
          const names = new Map(countries.map((c) => [String(c.id), c.name_vi || c.name_en]))
          const normalizeContacts = (items) => (items || []).map((c) => Object.fromEntries(['name', 'position', 'phone', 'zalo', 'email', 'whatsapp', 'line_id', 'wechat_id', 'is_primary'].map((key) => [key, key === 'is_primary' ? Boolean(c[key]) : c[key] || null])))
          const data = rows.slice(0, limit).map((row) => {
            const changes = { ...(typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes) }
            if (changes.contacts) {
              const pair = changes.contacts.map(normalizeContacts)
              if (JSON.stringify(pair[0]) === JSON.stringify(pair[1])) delete changes.contacts
              else changes.contacts = pair.map((items) => items.map((c) => Object.values(c).filter((v) => v && v !== true).join(' · ')).join('; '))
            }
            if (changes.country_id) changes.country_id = changes.country_id.map((id) => id == null ? null : names.get(String(id)) || String(id))
            return { ...row, reason: 'Cập nhật thông tin đối tác', changes }
          }).filter((row) => Object.keys(row.changes).length)
          return { data, nextOffset: rows.length > limit ? offset + limit : null }

        })

        const write = { onRequest: [app.authenticate, app.can('partner.update')] }
        app.get('/:id/vessels', { onRequest: [app.authenticate, app.can('partner.view'), app.can('vessel.view')], schema: { params } }, async (request) => fleetService.listOwnerVessels(pool, request.params.id))
        app.post('/:id/vessels', {
          onRequest: [app.authenticate, app.can('partner.update'), app.can('vessel.view'), app.can('vessel.update')],
          schema: { params, body: { type: 'object', required: ['vessel_id', 'expected_owner_id'], additionalProperties: false, properties: { vessel_id: { type: 'integer', minimum: 1 }, expected_owner_id: nullableInt, ownership_id: nullableInt, started_at: { type: ['string', 'null'], format: 'date' }, ended_at: { type: ['string', 'null'], format: 'date' }, is_current: { type: 'boolean' } } } },
        }, async (request) => fleetService.linkOwnerVessel(pool, request.params.id, request.body))
        app.get('/:id/vessels/:vesselId/crew', {
          onRequest: [app.authenticate, app.can('partner.view'), app.can('vessel.view'), app.can('seafarer.view')],
          schema: { params: { type: 'object', required: ['id', 'vesselId'], properties: { id: { type: 'integer', minimum: 1 }, vesselId: { type: 'integer', minimum: 1 } } } },
        }, async (request) => fleetService.listOwnerVesselCrew(pool, request.params.id, request.params.vesselId, ownerIdFor(request, 'seafarer')))
        // Logo công ty: GET trả ảnh, POST (multipart, field "file") thay logo, DELETE gỡ logo.
        app.get('/:id/logo', { ...read, schema: { params, querystring: { type: 'object', properties: { size: { type: 'string', enum: ['thumb', 'full'], default: 'full' } } } } }, async (request, reply) => {
          const logo = await fleetService.getOwnerLogo(pool, request.params.id, request.query.size)
          reply.header('Content-Type', logo.mime)
          reply.header('Cache-Control', 'private, no-cache')
          return reply.send(fs.createReadStream(logo.path))
        })
        app.post('/:id/logo', { ...write, schema: { params } }, async (request) => {
          const file = await request.file({ limits: { fileSize: config.upload.maxFileSize, files: 1 } })
          if (!file) throw { statusCode: 400, message: 'Chưa chọn logo' }
          return fleetService.saveOwnerLogo(pool, request.params.id, file)
        })
        // Quét danh thiếp để điền form (chưa có :id, không lưu gì): multipart field "file".
        const canWrite = async (request, reply) => {
          const have = request.access?.permissions
          if (!have || !(have.has('partner.create') || have.has('partner.update'))) return reply.code(403).send({ error: 'Không có quyền' })
        }
        app.post('/scan-card', { onRequest: [app.authenticate, canWrite] }, async (request) => {
          const part = await request.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } })
          if (!part) throw { statusCode: 400, message: 'Chưa chọn danh thiếp' }
          return businessCardScan.scan(part)
        })
        app.delete('/:id/logo', { ...write, schema: { params } }, async (request) => fleetService.removeOwnerLogo(pool, request.params.id))
      },
    }),
    { prefix: '/ship-owners' }
  )
}

module.exports = fleetRoutes
