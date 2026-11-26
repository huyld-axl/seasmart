// Thông tin máy cho giao diện (app máy tính, docs/catoro-ke-hoach-desktop-gd1.md mục 3.4, 3.6).
const { execFile } = require('child_process')
const config = require('../../config')
const { productEnv } = require('../../utils/env')
const documentReader = require('../../services/document_reader.service')
const emailService = require('../../services/email.service')
const { desktopSmtp } = require('../../utils/desktop_smtp')

// Xuất được PDF không. App máy tính in bằng Chromium của app (luôn có); bản web cần LibreOffice trên máy chủ:
// chạy `soffice --version` một lần, nhớ kết quả.
let pdfCheck = null
function pdfAvailable() {
  if (productEnv('PDF_URL')) return true
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
      await emailService.sendWith(smtp, { to: smtp.user, subject: 'Catoro: thư thử', text: 'Email gửi thẳng từ Catoro trên máy này đã hoạt động.' })
    } catch (error) {
      throw { statusCode: 422, message: `Không gửi được: ${error.message || 'lỗi không rõ'}` }
    }
    return { ok: true }
  })
}

module.exports = systemRoutes
