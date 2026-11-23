const pool = require('../../config/db')
const { reportService } = require('../../services/report.service')
const { REPORT_KEYS } = require('../../constants/reports')
const { reportWorkbook, reportFileName } = require('../../utils/report_xlsx')
const { ownerIdFor } = require('../../utils/scope')

// month không kiểm dạng (luật bộ lọc): sai thì báo cáo rỗng. Chỉ giới hạn độ dài.
const querystring = { type: 'object', properties: { month: { type: 'string', maxLength: 7 } } }
const notFound = () => ({ statusCode: 404, message: 'Không có báo cáo này' })

// Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md). Phạm vi "chỉ của mình" theo người tạo bill, như Trả lương.
async function reportRoutes(fastify) {
  const can = (...actions) => ({ onRequest: [fastify.authenticate, ...actions.map((action) => fastify.can(`report.${action}`))] })

  fastify.get('/:key', { ...can('view'), schema: { querystring } }, async (request) => {
    if (!REPORT_KEYS.includes(request.params.key)) throw notFound()
    return reportService.build(pool, request.params.key, { month: request.query.month, ownerId: ownerIdFor(request, 'report') })
  })

  // key = một báo cáo hoặc 'all' (cả 4 báo cáo, mỗi báo cáo một sheet).
  fastify.get('/:key/export', { ...can('view', 'export'), schema: { querystring } }, async (request, reply) => {
    const { key } = request.params
    if (key !== 'all' && !REPORT_KEYS.includes(key)) throw notFound()
    const query = { month: request.query.month, ownerId: ownerIdFor(request, 'report') }
    const reports = []
    for (const k of key === 'all' ? REPORT_KEYS : [key]) reports.push(await reportService.build(pool, k, query))
    const [[user]] = await pool.query('SELECT COALESCE(full_name, email) AS name FROM "user" WHERE id = ?', [request.user.id])
    const buffer = await reportWorkbook(reports, { userName: user?.name, now: new Date() })
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(reportFileName(key, reports[0].month))}`)
      .send(buffer)
  })
}

module.exports = reportRoutes
