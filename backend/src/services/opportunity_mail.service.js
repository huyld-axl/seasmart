const { opportunityService } = require('./opportunity.service')
const submissionService = require('./submission.service')
const { exportPackService } = require('./export_pack.service')
const emailService = require('./email.service')

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_EXTRA_FILES = 5
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Tệp người dùng đính kèm thêm: PDF, ảnh, Word, Excel, zip, văn bản.
const EXTRA_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'application/x-zip-compressed', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const bad = (message) => ({ statusCode: 400, message })
const emails = (value, name, { required = false, max = 10 } = {}) => {
  const list = value == null ? [] : value
  if (!Array.isArray(list) || list.length > max || list.some((address) => typeof address !== 'string' || address.length > 150 || !EMAIL.test(address))) throw bad(`${name} không hợp lệ`)
  if (required && !list.length) throw bad(`Nhập ${name}`)
  return list
}

// Nội dung thư từ trường `payload` (JSON) của request multipart.
function parsePayload(raw) {
  let data
  try { data = JSON.parse(raw) } catch { throw bad('Nội dung thư không đọc được') }
  if (!data || typeof data !== 'object') throw bad('Nội dung thư không đọc được')
  const ids = data.candidate_ids
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((n) => !Number.isInteger(n) || n < 1)) throw bad('Chọn ít nhất một ứng viên')
  if (typeof data.subject !== 'string' || !data.subject.trim() || data.subject.length > 300) throw bad('Tiêu đề không hợp lệ')
  if (typeof data.body !== 'string' || !data.body.trim() || data.body.length > 20000) throw bad('Nội dung thư không hợp lệ')
  return {
    candidate_ids: ids,
    ship_owner_contact_id: Number.isInteger(data.ship_owner_contact_id) ? data.ship_owner_contact_id : null,
    to: emails(data.to, 'người nhận', { required: true }),
    cc: emails(data.cc, 'Cc'),
    bcc: emails(data.bcc, 'Bcc'),
    subject: data.subject,
    body: data.body,
  }
}

// Kiểm tra tệp đính kèm thêm: loại tệp cho phép, tối đa MAX_EXTRA_FILES tệp.
function checkExtraFiles(files = []) {
  if (files.length > MAX_EXTRA_FILES) throw bad(`Đính kèm thêm tối đa ${MAX_EXTRA_FILES} tệp`)
  for (const file of files) {
    if (!EXTRA_MIME.includes(file.contentType)) throw { statusCode: 415, message: `Không đính kèm được ${file.filename}: chỉ nhận PDF, ảnh, Word, Excel, zip, văn bản` }
  }
}

// Gửi hồ sơ ứng viên cho chủ tàu bằng mail server công ty: đính kèm mỗi người một .zip, ghi nhận lần gửi sau khi mail đi.
// body: { candidate_ids, ship_owner_contact_id, to[], cc[], bcc[], subject, body }. user: người gửi (đặt làm Reply-To).
const opportunityMailService = {
  parsePayload,
  checkExtraFiles,

  // extraFiles: [{ filename, content, contentType }] do người dùng chọn thêm.
  async send(pool, id, body, user, extraFiles = []) {
    checkExtraFiles(extraFiles)
    const ids = [...new Set(body.candidate_ids || [])]
    let opportunity = await opportunityService.get(pool, id)
    if (opportunity.status !== 'OPEN') throw { statusCode: 409, message: 'Cơ hội đã đóng, không gửi được' }
    const people = opportunity.candidates.filter((c) => c.status === 'PICKED' && ids.includes(c.id))
    if (!ids.length || people.length !== ids.length) throw { statusCode: 400, message: 'Có ứng viên không thuộc danh sách của cơ hội này' }
    if (!emailService.isConfigured()) throw { statusCode: 503, message: 'Chưa cấu hình mail server, liên hệ quản trị' }

    // Người chưa có bộ giấy thì tạo trước khi đính kèm.
    for (const person of people.filter((c) => !c.export_pack)) await submissionService.ensurePack(pool, id, person.seafarer_id, user)
    opportunity = await opportunityService.get(pool, id)
    const packById = new Map(opportunity.candidates.map((c) => [c.id, c.export_pack]))

    const attachments = []
    for (const person of people) {
      const pack = packById.get(person.id)
      const { buffer, filename } = await exportPackService.buildZip(pool, pack.id, 'pdf')
      attachments.push({ filename, content: buffer, contentType: 'application/zip' })
    }
    attachments.push(...extraFiles)
    const total = attachments.reduce((sum, file) => sum + file.content.length, 0)
    if (total > MAX_ATTACHMENT_BYTES) {
      throw { statusCode: 413, message: `Tệp đính kèm ${(total / 1048576).toFixed(1)} MB, quá giới hạn 20 MB. Gửi bớt người mỗi thư.` }
    }

    try {
      const [[sender]] = await pool.query('SELECT full_name FROM "user" WHERE id = ?', [user.id])
      await emailService.send({ to: body.to, cc: body.cc?.length ? body.cc : undefined, bcc: body.bcc?.length ? body.bcc : undefined, replyTo: user.email, fromName: sender?.full_name, subject: body.subject, text: body.body, attachments })
    } catch (error) {
      throw { statusCode: 502, message: `Mail server không gửi được thư: ${error.message || 'lỗi không rõ'}` }
    }
    return opportunityService.recordSend(pool, id, {
      candidate_ids: ids,
      ship_owner_contact_id: body.ship_owner_contact_id || null,
      to_email: body.to.join(', '),
      subject: body.subject,
      cc_emails: body.cc || [],
      bcc_emails: body.bcc || [],
      body: body.body,
    }, user.id)
  },
}

module.exports = opportunityMailService
