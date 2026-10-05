const pool = require('../../config/db')

const cache = {}
const TTL = 5 * 60 * 1000 // 5 phút

// Map từ table name → cache key để invalidate khi master data thay đổi
const TABLE_CACHE_KEY = {
  certificate_type: 'certificate_types',
  vessel_type: 'vessel_types',
  country: 'countries',
  contract_type: 'contract_types',
  course_type: 'course_types',
  port: 'ports',
}

function invalidateCache(table) {
  const key = TABLE_CACHE_KEY[table]
  if (key) delete cache[key]
}

async function getCached(key, queryFn) {
  const now = Date.now()
  if (cache[key] && now - cache[key].ts < TTL) return cache[key].data
  const data = await queryFn()
  cache[key] = { data, ts: now }
  return data
}

async function lookupRoutes(fastify) {
  fastify.get('/ranks', async () => {
    return getCached('ranks', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en, department FROM `rank` ORDER BY department, name_vi'
      )
      return rows
    })
  })

  fastify.get('/certificate-types', async () => {
    return getCached('certificate_types', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM certificate_type ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/course-types', async () => {
    return getCached('course_types', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM course_type ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/countries', async () => {
    return getCached('countries', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM country ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/vessel-types', async () => {
    return getCached('vessel_types', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM vessel_type ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/contract-types', async () => {
    return getCached('contract_types', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM contract_type ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/vessels', async (request) => {
    const { search } = request.query
    if (search) {
      const [rows] = await pool.query(
        'SELECT id, vessel_name FROM vessel WHERE vessel_name LIKE ? ORDER BY vessel_name LIMIT 50',
        [`%${search}%`]
      )
      return rows
    }
    return getCached('vessels', async () => {
      const [rows] = await pool.query(
        'SELECT id, vessel_name FROM vessel ORDER BY vessel_name LIMIT 200'
      )
      return rows
    })
  })

  fastify.get('/ports', async (request) => {
    const { country_id, search } = request.query
    if (search || country_id) {
      // dynamic query — skip cache
      let sql =
        'SELECT p.id, p.un_locode, p.name, p.country_id, c.code AS country_code, c.name_vi AS country_name FROM port p JOIN country c ON c.id = p.country_id WHERE 1=1'
      const params = []
      if (country_id) {
        sql += ' AND p.country_id = ?'
        params.push(parseInt(country_id))
      }
      if (search) {
        sql += ' AND p.name LIKE ?'
        params.push(`%${search}%`)
      }
      sql += ' ORDER BY p.name LIMIT 100'
      const [rows] = await pool.query(sql, params)
      return rows
    }
    return getCached('ports', async () => {
      const [rows] = await pool.query(
        'SELECT p.id, p.un_locode, p.name, p.country_id, c.code AS country_code, c.name_vi AS country_name FROM port p JOIN country c ON c.id = p.country_id ORDER BY p.name'
      )
      return rows
    })
  })
}

module.exports = lookupRoutes
module.exports.invalidateCache = invalidateCache
