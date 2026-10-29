const { opportunityService } = require('./opportunity.service')
const { exportPackService } = require('./export_pack.service')
const certificateService = require('./certificate.service')
const { withTransaction } = require('../utils/transaction')

const dmy = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
const hasFile = (cert) => Boolean(cert.document_url || cert.source_document_id)

// Giấy của thuyền viên dùng cho một yêu cầu: cùng loại, chưa thu hồi; có ảnh trước, rồi hạn xa nhất.
function bestCertificate(certs, typeId) {
  const rank = (c) => [hasFile(c) ? 1 : 0, c.no_expiry || !c.expiry_date ? '9999' : String(c.expiry_date)]
  return certs
    .filter((c) => c.certificate_type_id === typeId && c.status !== 'REVOKED')
    .sort((a, b) => {
      const [fa, ea] = rank(a)
      const [fb, eb] = rank(b)
      return fb - fa || eb.localeCompare(ea)
    })[0] || null
}

// Hồ sơ nộp của một ứng viên trong cơ hội: giấy tờ theo yêu cầu (lấy từ tab Giấy tờ của thuyền viên) và biểu mẫu phải điền.
// Biểu mẫu nằm trong bộ giấy (export_pack) của ứng viên; chưa có bộ thì pack = null, bấm Điền sẽ tạo (ensurePack).
const submissionService = {
  async get(pool, opportunityId, seafarerId) {
    const opportunity = await opportunityService.get(pool, opportunityId)
    const candidate = opportunity.candidates.find((c) => c.seafarer_id === seafarerId && c.status !== 'REMOVED')
    if (!candidate) throw { statusCode: 404, message: 'Người này không có trong danh sách ứng viên' }
    const { data: certs } = await certificateService.list(seafarerId, { limit: 500 })
    const fitById = new Map(candidate.fit.items.map((item) => [item.requirement_id, item]))
    const docs = opportunity.requirements
      .filter((req) => req.kind === 'CERTIFICATE')
      .map((req) => {
        const fit = fitById.get(req.id) || {}
        const cert = bestCertificate(certs, req.certificate_type_id)
        return {
          requirement_id: req.id,
          name: req.certificate_name,
          level: req.level,
          needed_until: fit.needed_until || null,
          // ok | expires_early (hết hạn trước mốc cần) | missing; thêm no_file khi có giấy nhưng chưa có ảnh.
          state: fit.state === 'ok' && cert && !hasFile(cert) ? 'no_file' : fit.state || 'missing',
          expiry: fit.expiry || null,
          certificate: cert
            ? {
                id: cert.id, certificate_type_id: cert.certificate_type_id, display_name: cert.display_name, certificate_number: cert.certificate_number,
                issued_date: cert.issued_date, expiry_date: cert.expiry_date, no_expiry: cert.no_expiry,
                document_url: cert.document_url, source_upload_id: cert.source_upload_id, source_page_from: cert.source_page_from, has_file: hasFile(cert),
              }
            : null,
        }
      })
    const forms = opportunity.requirements.filter((req) => req.kind === 'TEMPLATE').map((req) => ({ requirement_id: req.id, key: req.template_key, level: req.level }))
    const pack = candidate.export_pack_id ? await exportPackService.get(pool, candidate.export_pack_id).catch(() => null) : null
    return {
      opportunity: { id: opportunity.id, code: opportunity.code, vessel_name: opportunity.vessel_name, ship_owner_id: opportunity.ship_owner_id, ship_owner_name: opportunity.ship_owner_name, rank_name: opportunity.rank_name, planned_join_date: opportunity.planned_join_date },
      candidate: { id: candidate.id, seafarer_id: seafarerId, full_name: candidate.full_name, last_sent_at: candidate.last_sent_at },
      docs,
      forms,
      pack,
    }
  },

  // Bộ giấy của ứng viên có đủ các biểu mẫu theo yêu cầu: chưa có thì tạo (điền sẵn tên tàu, ngày xuống tàu), thiếu mẫu thì thêm.
// Cơ hội không yêu cầu biểu mẫu nào thì bộ chỉ để gom giấy tờ khi tải / gửi.
  async ensurePack(pool, opportunityId, seafarerId, user) {
    const current = await this.get(pool, opportunityId, seafarerId)
    const keys = current.forms.map((f) => f.key)
    if (!current.pack) {
      const { opportunity } = current
      const inputs = {
        ...(opportunity.vessel_name ? { 'Tên tàu': opportunity.vessel_name } : {}),
        ...(opportunity.planned_join_date ? { 'Ngày xuống tàu': dmy(opportunity.planned_join_date) } : {}),
      }
      await exportPackService.create(pool, { seafarer_id: seafarerId, ship_owner_id: opportunity.ship_owner_id, opportunity_id: opportunityId, docs: keys, inputs }, user)
    } else {
      const missing = keys.filter((key) => !current.pack.docs.includes(key))
      if (missing.length) {
        await withTransaction(pool, async (conn) => {
          const start = current.pack.docs.length
          await conn.query('INSERT INTO export_pack_doc (pack_id, template_key, sort_order) VALUES ?', [missing.map((key, i) => [current.pack.id, key, start + i])])
        })
      }
    }
    return this.get(pool, opportunityId, seafarerId)
  },
}

module.exports = submissionService
