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
    limit: { type: 'integer', minimum: 1, default: 50 },
  },
}

// Whitelist columns cho từng table để tránh column injection
const TABLE_COLUMNS = {
  certificate_type: [
    'code',
    'name_vi',
    'name_en',
    'validity_years',
    'is_stcw',
    'notes',
    'warning_before_months',
  ],
  country: ['code', 'name_vi', 'name_en'],
  rank: ['code', 'name_vi', 'name_en', 'department', 'rank_level'],
}

function getAllowedCols(table, body) {
  const allowed = TABLE_COLUMNS[table] || []
  return Object.keys(body).filter(
    (k) => allowed.includes(k) && k !== 'id' && k !== 'created_at' && k !== 'updated_at'
  )
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
        onRequest: [fastify.authenticate],
        schema: { querystring: listQuerySchema },
      },
      async (request) => {
        const { search } = request.query
        const { page, limit, offset } = parsePaging(request.query, { defaultLimit: 50 })
        let sql = `SELECT * FROM \`${table}\` WHERE 1=1`
        const params = []
        if (search) {
          sql += ' AND (name_vi LIKE ? OR name_en LIKE ? OR code LIKE ?)'
          params.push(`%${search}%`, `%${search}%`, `%${search}%`)
        }
        sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        params.push(limit, offset)
        const [rows] = await pool.query(sql, params)

        // COUNT với cùng filter search
        let countSql = `SELECT COUNT(*) AS total FROM \`${table}\` WHERE 1=1`
        const countParams = []
        if (search) {
          countSql += ' AND (name_vi LIKE ? OR name_en LIKE ? OR code LIKE ?)'
          countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
        }
        const [[{ total }]] = await pool.query(countSql, countParams)
        return { data: rows, total }
      }
    )

    // GET ONE
    fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
      const [[row]] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [
        parseInt(request.params.id),
      ])
      if (!row) return reply.code(404).send({ error: 'Không tìm thấy' })
      return row
    })

    // CREATE
    fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
      if (!['admin', 'operator'].includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      const body = request.body
      const cols = getAllowedCols(table, body)
      if (!cols.length) return reply.code(400).send({ error: 'Không có dữ liệu hợp lệ' })
      const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      const [res] = await pool.query(
        sql,
        cols.map((c) => body[c])
      )
      invalidateCache(table)
      const [[created]] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [
        res.insertId,
      ])
      return reply.code(201).send(created)
    })

    // UPDATE
    fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
      if (!['admin', 'operator'].includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền' })
      }
      const body = request.body
      const cols = getAllowedCols(table, body)
      if (!cols.length) return reply.code(400).send({ error: 'Không có dữ liệu hợp lệ' })
      const sql = `UPDATE \`${table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(',')} WHERE id = ?`
      await pool.query(sql, [...cols.map((c) => body[c]), parseInt(request.params.id)])
      invalidateCache(table)
      const [[updated]] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [
        parseInt(request.params.id),
      ])
      return updated
    })

    // DELETE
    fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
      if (request.user.role !== 'admin')
        return reply.code(403).send({ error: 'Chỉ admin mới có quyền xóa' })
      await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [parseInt(request.params.id)])
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
      onRequest: [fastify.authenticate],
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const { search } = request.query
      const { limit, offset } = parsePaging(request.query, { defaultLimit: 50 })
      let sql = `SELECT p.*, c.name_vi AS country_name, c.code AS country_code
               FROM \`port\` p
               LEFT JOIN \`country\` c ON c.id = p.country_id
               WHERE 1=1`
      const params = []
      if (search) {
        sql += ' AND (p.name LIKE ? OR p.un_locode LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }
      sql += ' ORDER BY p.name LIMIT ? OFFSET ?'
      params.push(limit, offset)
      const [rows] = await pool.query(sql, params)

      let countSql = 'SELECT COUNT(*) AS total FROM `port` p WHERE 1=1'
      const countParams = []
      if (search) {
        countSql += ' AND (p.name LIKE ? OR p.un_locode LIKE ?)'
        countParams.push(`%${search}%`, `%${search}%`)
      }
      const [[{ total }]] = await pool.query(countSql, countParams)
      return { data: rows, total }
    }
  )

  // GET ONE
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [[row]] = await pool.query(
      'SELECT p.*, c.name_vi AS country_name FROM `port` p LEFT JOIN `country` c ON c.id = p.country_id WHERE p.id = ?',
      [parseInt(request.params.id)]
    )
    if (!row) return reply.code(404).send({ error: 'Không tìm thấy' })
    return row
  })

  // CREATE
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    if (!['admin', 'operator'].includes(request.user.role)) {
      return reply.code(403).send({ error: 'Không có quyền' })
    }
    const { name, un_locode, country_id } = request.body
    const [res] = await pool.query(
      'INSERT INTO `port` (name, un_locode, country_id) VALUES (?, ?, ?)',
      [name, un_locode || null, country_id]
    )
    const [[created]] = await pool.query(
      'SELECT p.*, c.name_vi AS country_name FROM `port` p LEFT JOIN `country` c ON c.id = p.country_id WHERE p.id = ?',
      [res.insertId]
    )
    return reply.code(201).send(created)
  })

  // UPDATE
  fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    if (!['admin', 'operator'].includes(request.user.role)) {
      return reply.code(403).send({ error: 'Không có quyền' })
    }
    const { name, un_locode, country_id } = request.body
    await pool.query('UPDATE `port` SET name = ?, un_locode = ?, country_id = ? WHERE id = ?', [
      name,
      un_locode || null,
      country_id,
      parseInt(request.params.id),
    ])
    const [[updated]] = await pool.query(
      'SELECT p.*, c.name_vi AS country_name FROM `port` p LEFT JOIN `country` c ON c.id = p.country_id WHERE p.id = ?',
      [parseInt(request.params.id)]
    )
    return updated
  })

  // DELETE
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role !== 'admin')
      return reply.code(403).send({ error: 'Chỉ admin mới có quyền xóa' })
    await pool.query('DELETE FROM `port` WHERE id = ?', [parseInt(request.params.id)])
    return { success: true }
  })
}

async function masterDataRoutes(fastify) {
  fastify.register(makeCrud('certificate_type', 'name_vi'), { prefix: '/certificate-types' })
  fastify.register(makeCrud('country', 'name_vi'), { prefix: '/countries' })
  fastify.register(makeCrud('rank', 'name_vi'), { prefix: '/ranks' })
  fastify.register(portRoutes, { prefix: '/ports' })
}

module.exports = masterDataRoutes
