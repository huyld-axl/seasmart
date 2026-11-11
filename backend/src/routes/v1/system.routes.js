// Thông tin máy cho giao diện (app máy tính, docs/mcah-ke-hoach-desktop-gd1.md mục 3.4, 3.6).
const { execFile } = require('child_process')
const config = require('../../config')
const documentReader = require('../../services/document_reader.service')
const emailService = require('../../services/email.service')
const { desktopSmtp } = require('../../utils/desktop_smtp')

// Có LibreOffice không: chạy `soffice --version` một lần, nhớ kết quả (app cài xong thì mở lại backend).
let pdfCheck = null
function pdfAvailable() {
  if (!pdfCheck) {
    pdfCheck = new Promise((resolve) => {
      execFile(process.env.SOFFICE_PATH || 'soffice', ['--version'], { timeout: 30000 }, (error) => resolve(!error))
    })
  }
  return pdfCheck
}

async function systemRoutes(fastify) {
  fastify.get('/capabilities', { onRequest: [fastify.authenticate] }, async () => ({
    desktop: config.desktop,
    pdf: await pdfAvailable(),
    ai: documentReader.isConfigured(),
    vessel_lookup: Boolean(config.vesselLookup.provider),
  }))

  // Gửi thư thử cho chính địa chỉ gửi, bằng SMTP của máy này (app máy tính gắn cấu hình vào header).
  fastify.post('/smtp-test', { onRequest: [fastify.authenticate], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request) => {
    const smtp = desktopSmtp(request)
    if (!smtp) throw { statusCode: 400, message: 'Chưa khai email gửi thẳng trên máy này' }
    try {
      await emailService.sendWith(smtp, { to: smtp.user, subject: 'MCAH: thư thử', text: 'Email gửi thẳng từ MCAH trên máy này đã hoạt động.' })
    } catch (error) {
      throw { statusCode: 422, message: `Không gửi được: ${error.message || 'lỗi không rõ'}` }
    }
    return { ok: true }
  })
}

module.exports = systemRoutes
