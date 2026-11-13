// Thư hệ thống của bên mình (xác minh, đặt lại mật khẩu, lời mời). SMTP_HOST trống (máy dev) thì in thư ra log.
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

const link = (path) => `${config.publicUrl}${path}`

const mailer = {
  send,
  sent, // chỉ để test đọc thư đã "gửi" khi chạy không SMTP
  verifyEmail: (to, token) =>
    send({ to, subject: 'MCAH: xác minh email', text: `Bấm liên kết dưới để xác minh email và dùng MCAH:\n${link(`/xac-minh?token=${token}`)}\n\nLiên kết có hạn 24 giờ. Không phải bạn đăng ký thì bỏ qua thư này.` }),
  resetPassword: (to, token) =>
    send({ to, subject: 'MCAH: đặt lại mật khẩu', text: `Bấm liên kết dưới để đặt mật khẩu mới:\n${link(`/dat-lai?token=${token}`)}\n\nLiên kết có hạn 30 phút. Không phải bạn yêu cầu thì bỏ qua thư này, mật khẩu cũ vẫn dùng được.` }),
  passwordChanged: (to) =>
    send({ to, subject: 'MCAH: mật khẩu đã đổi', text: 'Mật khẩu tài khoản MCAH của bạn vừa được đổi. Không phải bạn đổi thì đặt lại mật khẩu ngay và báo quản trị văn phòng.' }),
  invite: (to, { inviterName, officeName, token }) =>
    send({ to, subject: `${inviterName} mời bạn vào ${officeName} trên MCAH`, text: `${inviterName} mời bạn vào văn phòng ${officeName} trên MCAH.\n\nBấm liên kết dưới để đăng ký (hoặc đăng nhập nếu đã có tài khoản):\n${link(`/moi?token=${token}`)}\n\nLời mời có hạn 14 ngày.` }),
}

module.exports = mailer
