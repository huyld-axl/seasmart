// Nhận báo lỗi từ app máy tính (docs: màn lỗi khởi động, nút "Gửi báo lỗi"). Không cần đăng nhập vì app còn chưa mở được,
// nên chặn lạm dụng bằng giới hạn tốc độ theo IP + giới hạn kích thước. Thân là JSON {meta, files} nén gzip.
const zlib = require('zlib')
const pool = require('../db')

const MAX_GZIP = 2 * 1024 * 1024
const MAX_JSON = 8 * 1024 * 1024
const clip = (v, n) => String(v ?? '').slice(0, n)

async function bugReportRoutes(fastify) {
  fastify.addContentTypeParser('application/gzip', { parseAs: 'buffer', bodyLimit: MAX_GZIP }, (request, body, done) => {
    try {
      const json = zlib.gunzipSync(body, { maxOutputLength: MAX_JSON })
      done(null, { raw: body, data: JSON.parse(json.toString('utf8')) })
    } catch {
      done({ statusCode: 400, message: 'Gói báo lỗi không hợp lệ' })
    }
  })

  fastify.post('/api/bug-report', { bodyLimit: MAX_GZIP, config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { raw, data } = request.body || {}
    const meta = data?.meta
    if (!raw || !meta || typeof meta !== 'object' || typeof data.files !== 'object') throw { statusCode: 400, message: 'Gói báo lỗi không hợp lệ' }
    const { rows } = await pool.query(
      'INSERT INTO bug_report (error_code, app_version, platform, note, ip, meta, bundle) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [clip(meta.errorCode, 40) || 'UNKNOWN', clip(meta.appVersion, 40), clip(meta.platform, 40), clip(meta.note, 2000) || null, request.ip, meta, raw]
    )
    return reply.code(201).send({ id: rows[0].id })
  })
}

module.exports = bugReportRoutes
