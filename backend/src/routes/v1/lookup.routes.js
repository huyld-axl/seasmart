const pool = require('../../config/db')
const { invalidateCache, getCached } = require('../../utils/lookup-cache')

async function lookupRoutes(fastify) {
  fastify.get('/ranks', async () => {
    return getCached('ranks', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en, department, rank_level FROM `rank` ORDER BY FIELD(department,\'DECK\',\'ENGINE\',\'CATERING\'), rank_level, id'
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

  fastify.get('/countries', async () => {
    return getCached('countries', async () => {
      const [rows] = await pool.query(
        'SELECT id, code, name_vi, name_en FROM country ORDER BY name_vi'
      )
      return rows
    })
  })

  fastify.get('/vessels', async (request) => {
    const { search } = request.query
    if (search) {
      const [rows] = await pool.query(
        `SELECT
           v.id,
           v.vessel_name,
           v.imo_number,
           v.ship_owner_name,
           v.ship_owner_code,
           v.flag_country AS flag_country_name,
           v.vessel_type AS vessel_type_name,
           v.gross_tonnage,
           v.deadweight,
           v.engine_type,
           v.engine_power_kw,
           COALESCE(
             v.trade_area,
             CASE
               WHEN JSON_VALID(v.notes) THEN JSON_UNQUOTE(JSON_EXTRACT(v.notes, '$.trade_area'))
               ELSE NULL
             END
           ) AS operating_area
         FROM vessel v
         WHERE v.vessel_name LIKE ? OR v.imo_number LIKE ?
         ORDER BY v.vessel_name
         LIMIT 50`,
        [`%${search}%`, `%${search}%`]
      )
      return rows
    }
    return getCached('vessels', async () => {
      const [rows] = await pool.query(
        `SELECT
           v.id,
           v.vessel_name,
           v.imo_number,
           v.ship_owner_name,
           v.ship_owner_code,
           v.flag_country AS flag_country_name,
           v.vessel_type AS vessel_type_name,
           v.gross_tonnage,
           v.deadweight,
           v.engine_type,
           v.engine_power_kw,
           COALESCE(
             v.trade_area,
             CASE
               WHEN JSON_VALID(v.notes) THEN JSON_UNQUOTE(JSON_EXTRACT(v.notes, '$.trade_area'))
               ELSE NULL
             END
           ) AS operating_area
         FROM vessel v
         ORDER BY v.vessel_name
         LIMIT 200`
      )
      return rows
    })
  })

  async function getPartners(request) {
    const { search } = request.query
    if (search) {
      const [rows] = await pool.query(
        'SELECT id, company_name, payment_cycle FROM partner WHERE deleted_at IS NULL AND company_name LIKE ? ORDER BY company_name LIMIT 100',
        [`%${search}%`]
      )
      return rows
    }
    return getCached('partners', async () => {
      const [rows] = await pool.query(
        'SELECT id, company_name, payment_cycle FROM partner WHERE deleted_at IS NULL ORDER BY company_name LIMIT 500'
      )
      return rows
    })
  }

  fastify.get('/partners', getPartners)
  fastify.get('/ship-owners', getPartners)

  fastify.get('/ports', async (request) => {
    const { country_id, search } = request.query
    if (country_id || search) {
      // dynamic query - skip cache
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
