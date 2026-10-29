const pool = require('../../config/db')
const { invalidateCache } = require('./lookup.routes')

const MAX_LIST_LIMIT = 100

function parsePaging(query, { defaultLimit = 20, maxLimit = MAX_LIST_LIMIT } = {}) {
  const pageRaw = query?.page
  const limitRaw = query?.limit

  let page = Number.parseInt(pageRaw, 10)
  if (!Number.isFinite(page) || page < 1) page = 1

  let limit = Number.parseInt(limitRaw, 10)
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  return { page, limit, offset: (page - 1) * limit }
}

const listQuerySchema = {
  type: 'object',
  properties: {
    search: { type: 'string' },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_LIMIT, default: 50 },
  },
}

// Whitelist columns cho từng table để tránh column injection
const TABLE_COLUMNS = {
  certificate_type: ['code', 'name_vi', 'name_en', 'category', 'issuing_country_id', 'issuing_authority', 'validity_years', 'is_stcw', 'notes'],
  vessel_type: ['code', 'name_vi', 'name_en'],
  country: ['code', 'name_vi', 'name_en', 'flag_emoji'],
  contract_type: ['code', 'name_vi', 'name_en'],
}

function getAllowedCols(table, body) {
  const allowed = TABLE_COLUMNS[table] || []
  return Object.keys(body).filter(
    (k) => allowed.includes(k) && k !== 'id' && k !== 'created_at' && k !== 'updated_at'
  )
}

function normalizeCountry(body) {
  if ('code' in body) {
    if (typeof body.code !== 'string' || !/^[A-Za-z]{2}$/.test(body.code.trim())) throw { statusCode: 400, message: 'Mã ISO phải gồm 2 chữ cái' }
    body.code = body.code.trim().toUpperCase()
  }
  if ('flag_emoji' in body) {
    const value = body.flag_emoji == null ? '' : String(body.flag_emoji).trim()
    if (value && !/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(value)) throw { statusCode: 400, message: 'Nhập một emoji cờ quốc gia hợp lệ' }
    body.flag_emoji = value || null
  }
}

// Nhóm loại giấy (theo loại giấy, không theo nước cấp — nước cấp là issuing_country_id).
const CERTIFICATE_CATEGORIES = ['DOCUMENT', 'COMPETENCY', 'STCW', 'MEDICAL', 'OTHER']
function normalizeCertificateType(body) {
  if ('category' in body && !CERTIFICATE_CATEGORIES.includes(body.category)) throw { statusCode: 400, message: 'Nhóm giấy không hợp lệ' }
  if ('issuing_country_id' in body) body.issuing_country_id = body.issuing_country_id ? Number(body.issuing_country_id) || null : null
}

// Generic CRUD factory for simple lookup tables
function makeCrud(table, orderBy = 'name_vi') {
  if (!/^[a-zA-Z0-9_]+$/.test(orderBy)) {
    throw new Error(`Unsafe orderBy for ${table}`)
  }
  return async function (fastify) {
    // LIST
    fastify.get(
      '/',
      {
        onRequest: [fastify.authenticate, fastify.can('catalog.view')],
        schema: { querystring: listQuerySchema },
      },
      async (request) => {
        const { search } = request.query
        const { page, limit, offset } = parsePaging(request.query, { defaultLimit: 50 })
        let sql = `SELECT * FROM "${table}" WHERE 1=1`
        const params = []
        if (search) {
          sql += ' AND (unaccent(name_vi::text) ILIKE unaccent(?) OR unaccent(name_en::text) ILIKE unaccent(?) OR unaccent(code::text) ILIKE unaccent(?))'
          params.push(`%${search}%`, `%${search}%`, `%${search}%`)
        }
        sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        params.push(limit, offset)
        const [rows] = await pool.query(sql, params)

        // COUNT với cùng filter search
        let countSql = `SELECT COUNT(*) AS total FROM "${table}" WHERE 1=1`
        const countParams = []
        if (search) {
          countSql += ' AND (unaccent(name_vi::text) ILIKE unaccent(?) OR unaccent(name_en::text) ILIKE unaccent(?) OR unaccent(code::text) ILIKE unaccent(?))'
          countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
        }
        const [[{ total }]] = await pool.query(countSql, countParams)
        return { data: rows, total }
      }
    )

    // GET ONE
    fastify.get('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.view')] }, async (request, reply) => {
      const [[row]] = await pool.query(`SELECT * FROM "${table}" WHERE id = ?`, [
        parseInt(request.params.id),
      ])
      if (!row) return reply.code(404).send({ error: 'Không tìm thấy' })
      return row
    })

    // CREATE
    fastify.post('/', { onRequest: [fastify.authenticate, fastify.can('catalog.update')] }, async (request, reply) => {
      const body = request.body
      if (table === 'country') normalizeCountry(body)
      if (table === 'certificate_type') normalizeCertificateType(body)
      const cols = getAllowedCols(table, body)
      if (!cols.length) return reply.code(400).send({ error: 'Không có dữ liệu hợp lệ' })
      const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      const [res] = await pool.query(
        sql,
        cols.map((c) => body[c])
      )
      invalidateCache(table)
      const [[created]] = await pool.query(`SELECT * FROM "${table}" WHERE id = ?`, [
        res.insertId,
      ])
      return reply.code(201).send(created)
    })

    // UPDATE
    fastify.put('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.update')] }, async (request, reply) => {
      const body = request.body
      if (table === 'country') normalizeCountry(body)
      if (table === 'certificate_type') normalizeCertificateType(body)
      const cols = getAllowedCols(table, body)
      if (!cols.length) return reply.code(400).send({ error: 'Không có dữ liệu hợp lệ' })
      const sql = `UPDATE "${table}" SET ${cols.map((c) => `"${c}" = ?`).join(',')} WHERE id = ?`
      await pool.query(sql, [...cols.map((c) => body[c]), parseInt(request.params.id)])
      invalidateCache(table)
      const [[updated]] = await pool.query(`SELECT * FROM "${table}" WHERE id = ?`, [
        parseInt(request.params.id),
      ])
      return updated
    })

    // DELETE
    fastify.delete('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.delete')] }, async (request) => {
      await pool.query(`DELETE FROM "${table}" WHERE id = ?`, [parseInt(request.params.id)])
      invalidateCache(table)
      return { success: true }
    })
  }
}

async function portRoutes(fastify) {
  // LIST
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate, fastify.can('catalog.view')],
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const { search } = request.query
      const { limit, offset } = parsePaging(request.query, { defaultLimit: 50 })
      let sql = `SELECT p.*, COALESCE(c.name_vi, c.name_en) AS country_name, c.code AS country_code, c.flag_emoji AS country_flag_emoji
               FROM "port" p
               LEFT JOIN "country" c ON c.id = p.country_id
               WHERE 1=1`
      const params = []
      if (search) {
        sql += ' AND (unaccent(p.name::text) ILIKE unaccent(?) OR unaccent(p.un_locode::text) ILIKE unaccent(?))'
        params.push(`%${search}%`, `%${search}%`)
      }
      sql += ' ORDER BY p.name LIMIT ? OFFSET ?'
      params.push(limit, offset)
      const [rows] = await pool.query(sql, params)

      let countSql = 'SELECT COUNT(*) AS total FROM "port" p WHERE 1=1'
      const countParams = []
      if (search) {
        countSql += ' AND (unaccent(p.name::text) ILIKE unaccent(?) OR unaccent(p.un_locode::text) ILIKE unaccent(?))'
        countParams.push(`%${search}%`, `%${search}%`)
      }
      const [[{ total }]] = await pool.query(countSql, countParams)
      return { data: rows, total }
    }
  )

  // GET ONE
  fastify.get('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.view')] }, async (request, reply) => {
    const [[row]] = await pool.query(
      'SELECT p.*, COALESCE(c.name_vi, c.name_en) AS country_name, c.code AS country_code, c.flag_emoji AS country_flag_emoji FROM "port" p LEFT JOIN "country" c ON c.id = p.country_id WHERE p.id = ?',
      [parseInt(request.params.id)]
    )
    if (!row) return reply.code(404).send({ error: 'Không tìm thấy' })
    return row
  })

  // CREATE
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.can('catalog.update')] }, async (request, reply) => {
    const { name, un_locode, country_id } = request.body
    const [res] = await pool.query(
      'INSERT INTO "port" (name, un_locode, country_id) VALUES (?, ?, ?)',
      [name, un_locode || null, country_id]
    )
    const [[created]] = await pool.query(
      'SELECT p.*, COALESCE(c.name_vi, c.name_en) AS country_name, c.code AS country_code, c.flag_emoji AS country_flag_emoji FROM "port" p LEFT JOIN "country" c ON c.id = p.country_id WHERE p.id = ?',
      [res.insertId]
    )
    return reply.code(201).send(created)
  })

  // UPDATE
  fastify.put('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.update')] }, async (request) => {
    const { name, un_locode, country_id } = request.body
    await pool.query('UPDATE "port" SET name = ?, un_locode = ?, country_id = ? WHERE id = ?', [
      name,
      un_locode || null,
      country_id,
      parseInt(request.params.id),
    ])
    const [[updated]] = await pool.query(
      'SELECT p.*, COALESCE(c.name_vi, c.name_en) AS country_name, c.code AS country_code, c.flag_emoji AS country_flag_emoji FROM "port" p LEFT JOIN "country" c ON c.id = p.country_id WHERE p.id = ?',
      [parseInt(request.params.id)]
    )
    return updated
  })

  // DELETE
  fastify.delete('/:id', { onRequest: [fastify.authenticate, fastify.can('catalog.delete')] }, async (request) => {
    await pool.query('DELETE FROM "port" WHERE id = ?', [parseInt(request.params.id)])
    return { success: true }
  })
}

async function masterDataRoutes(fastify) {
  fastify.register(makeCrud('certificate_type', 'name_vi'), { prefix: '/certificate-types' })
  fastify.register(makeCrud('vessel_type', 'name_vi'), { prefix: '/vessel-types' })
  fastify.register(makeCrud('country', 'name_vi'), { prefix: '/countries' })
  fastify.register(makeCrud('contract_type', 'name_vi'), { prefix: '/contract-types' })
  fastify.register(portRoutes, { prefix: '/ports' })
}

module.exports = masterDataRoutes
