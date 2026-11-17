// Thư hệ thống của bên mình (mã đăng nhập, báo chuyển máy chính). SMTP_HOST trống (máy dev) thì in thư ra log.
const nodemailer = require('nodemailer')
const config = require('../config')

let transport = null
const sent = []

async function send({ to, subject, text }) {
  const smtp = config.smtp
  if (!smtp.host) {
    sent.push({ to, subject, text })
    console.log(`[THƯ] Tới: ${to}\n[THƯ] Tiêu đề: ${subject}\n${text}\n[THƯ] ---`)
    return
  }
  // Cùng cách nối như backend/src/services/email.service.js: useSsl = TLS ngay (465), useTls = STARTTLS (587).
  if (!transport) {
    transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.useSsl,
      requireTLS: !smtp.useSsl && smtp.useTls,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    })
  }
  await transport.sendMail({ from: { name: smtp.fromName, address: smtp.fromEmail }, to, subject, text })
}

const mailer = {
  send,
  sent, // chỉ để test đọc thư đã "gửi" khi chạy không SMTP
  // Không có liên kết: chỉ mã, để thư không giống thư lừa đảo và không ai bấm nhầm.
  loginCode: (to, code) =>
    send({ to, subject: `Mã đăng nhập MCAH: ${code}`, text: `Mã đăng nhập MCAH của bạn: ${code}\n\nMã có hạn 10 phút. Không phải bạn đang đăng nhập thì bỏ qua thư này.` }),
}

module.exports = mailer
