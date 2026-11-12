// Tính năng cần khoá của bên mình, chạy ở máy chủ dịch vụ cho app máy tính (docs/mcah-ke-hoach-desktop-gd2.md 3.4, 3.6):
// AI đọc giấy tờ, tra tàu theo IMO, tìm danh mục tàu thế giới. Gọi bằng chữ ký máy chính (byMachine), ghi lượt dùng theo
// văn phòng. Ảnh giấy tờ chỉ qua bộ nhớ: không ghi đĩa, không ghi log.
// Nhà cung cấp AI và nguồn tra tàu dùng lại module của backend (cùng repo; triển khai thì chép kèm backend/src/services).
const pool = require('../db')

const AI_DIR = '../../../backend/src/services/ai'
const VESSEL_DIR = '../../../backend/src/services/vessel_lookup'

function aiProvider() {
  const env = process.env
  if (env.AI_PROVIDER === 'anthropic') {
    return require(`${AI_DIR}/anthropic_provider`).createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.DOC_READER_MODEL, timeoutMs: Number(env.AI_TIMEOUT_MS) || 120000 })
  }
  return require(`${AI_DIR}/openai_provider`).createOpenAIProvider({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    models: { small: env.OPENAI_MODEL_SMALL, strong: env.OPENAI_MODEL_STRONG },
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 120000,
  })
}

function vesselSource() {
  const env = process.env
  if (env.VESSEL_LOOKUP_PROVIDER !== 'legacy_proxy' || !env.VESSEL_API_BASE_URL || !env.VESSEL_API_ENC_KEY) return null
  return require(`${VESSEL_DIR}/legacy_proxy`).createLegacyProxy({ baseUrl: env.VESSEL_API_BASE_URL, encKey: env.VESSEL_API_ENC_KEY, timeoutMs: Number(env.VESSEL_LOOKUP_TIMEOUT_MS) || 60000 })
}

let provider = null
let source
const getProvider = () => (provider ||= aiProvider())
const getSource = () => (source === undefined ? (source = vesselSource()) : source)

async function recordUsage(officeId, kind, units = 1, costUsd = 0) {
  await pool.query('INSERT INTO usage (office_id, kind, units, cost_usd) VALUES ($1, $2, $3, $4)', [officeId, kind, units, costUsd])
}

const MAX_IMAGES = 30
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function servicesRoutes(fastify) {
  const byMachine = fastify.byMachine

  // body: { task, tier, detail, instructions, images: [{ mimeType, base64 }], schemaName, schema } → như callVision của backend.
  fastify.post('/api/ai/vision', { preHandler: byMachine, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request) => {
    const { task, tier, detail, instructions, images, schemaName, schema } = request.body || {}
    if (!Array.isArray(images) || !images.length || images.length > MAX_IMAGES) throw { statusCode: 400, message: 'Ảnh không hợp lệ' }
    if (!images.every((i) => IMAGE_TYPES.includes(i?.mimeType) && typeof i.base64 === 'string')) throw { statusCode: 400, message: 'Loại ảnh không hợp lệ' }
    const ai = getProvider()
    if (!ai.isConfigured()) throw { statusCode: 503, message: 'AI đọc giấy tờ chưa sẵn sàng ở máy chủ MCAH' }
    const result = await ai.callVision({ task, tier, detail, instructions, schemaName, schema, images: images.map((i) => ({ mimeType: i.mimeType, buffer: Buffer.from(i.base64, 'base64') })) })
    await recordUsage(request.office.id, 'ai_page', images.length)
    return result
  })

  // Dữ liệu thô của nguồn ngoài; backend ở máy chính đổi thành bản đề xuất và giữ các lớp chặn gọi quá nhiều.
  fastify.get('/api/vessels/imo/:imo', { preHandler: byMachine, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    if (!/^\d{7}$/.test(request.params.imo)) throw { statusCode: 400, message: 'IMO không hợp lệ' }
    const src = getSource()
    if (!src) throw { statusCode: 503, message: 'Tra tàu theo IMO chưa sẵn sàng ở máy chủ MCAH' }
    const result = await src.fetchByImo(request.params.imo)
    await recordUsage(request.office.id, 'vessel_lookup')
    return result
  })

  // Tìm tên / tên cũ / IMO / MMSI trong danh mục; trả dòng thô (backend loại tàu đã có trong văn phòng và đổi mã).
  fastify.get('/api/vessels/catalog', { preHandler: byMachine, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request) => {
    const term = String(request.query.q || '').trim()
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20))
    const page = Math.max(1, Number(request.query.page) || 1)
    if (term.length < 2) return { data: [], total: 0, page, limit }
    const esc = term.replace(/[\\%_]/g, (c) => `\\${c}`)
    const hit = [`%${esc}%`, /^\d{7}$/.test(term) ? term : null, /^\d{9}$/.test(term) ? term : null]
    const cte = `WITH hit AS (
      SELECT source_id FROM ship_catalog WHERE ship_name ILIKE $1
      UNION SELECT source_id FROM ship_catalog_exname WHERE name ILIKE $1
      UNION SELECT source_id FROM ship_catalog WHERE imo_number = $2
      UNION SELECT source_id FROM ship_catalog WHERE mmsi = $3)`
    const { rows: [{ total }] } = await pool.query(`${cte} SELECT COUNT(*) AS total FROM hit`, hit)
    const { rows } = await pool.query(
      `${cte} SELECT s.source_id, s.imo_number, s.ship_name, s.mmsi, s.ship_type, s.ship_type_group, s.flag_code, s.flag_name,
         CASE WHEN s.ship_name ILIKE $1 THEN NULL ELSE (SELECT min(e.name) FROM ship_catalog_exname e WHERE e.source_id = s.source_id AND e.name ILIKE $1) END AS ex_name
       FROM hit JOIN ship_catalog s ON s.source_id = hit.source_id
       ORDER BY (s.ship_name ILIKE $4) DESC, (s.imo_number IS NOT NULL) DESC, s.ship_name, s.source_id
       LIMIT $5 OFFSET $6`,
      [...hit, `${esc}%`, limit, (page - 1) * limit]
    )
    await recordUsage(request.office.id, 'catalog_search')
    return { data: rows, total: Number(total), page, limit }
  })
}

module.exports = servicesRoutes
