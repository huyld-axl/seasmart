const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const config = require('../config')

const TEMPLATES_DIR = path.join(__dirname, '../templates')

let transporter = null

function getTransporter() {
  if (!transporter) {
    const { host, port, username, password, useSsl, useTls } = config.smtp
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: useSsl,
      requireTLS: !useSsl && useTls,
      auth: username ? { user: username, pass: password } : undefined,
    })
  }
  return transporter
}

function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`)
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function renderTemplate(html, vars) {
  let out = html
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v != null ? escapeHtml(v) : '')
  }
  return out
}

function shouldSend() {
  return Boolean(config.smtp.host)
}

// Thư HTML (thư mời) hoặc thư chữ thường có đính kèm (gửi hồ sơ cho chủ tàu). cc, replyTo, attachments tuỳ chọn.
// fromName: tên người gửi, hiện là "Tên (MCAH)"; địa chỉ gửi luôn là của công ty.
async function send({ to, cc, bcc, replyTo, fromName: displayName, subject, html, text, attachments }) {
  if (!shouldSend()) return false
  const { fromName, fromEmail } = config.smtp
  const name = displayName ? `${displayName} (${fromName})` : fromName
  await getTransporter().sendMail({ from: { name, address: fromEmail }, to, cc, bcc, replyTo, subject, html, text, attachments })
  return true
}

// Gửi bằng SMTP của chính người gửi (app máy tính, Cài đặt trên máy này). smtp: { host, port, secure, user, password }.
// Kết nối tạo mới mỗi lần, không giữ lại, để mật khẩu không nằm trong bộ nhớ lâu hơn một lần gửi.
async function sendWith(smtp, { to, cc, bcc, replyTo, fromName, subject, html, text, attachments }) {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: Boolean(smtp.secure),
    requireTLS: !smtp.secure,
    auth: { user: smtp.user, pass: smtp.password },
  })
  try {
    await transport.sendMail({ from: { name: fromName || smtp.user, address: smtp.user }, to, cc, bcc, replyTo, subject, html, text, attachments })
  } finally {
    transport.close()
  }
  return true
}

const emailService = {
  send,
  sendWith,
  isConfigured: shouldSend,

  // Thư mời đặt mật khẩu cho tài khoản mới. `token` là mã gốc, chỉ có trong thư.
  async sendInvite({ to, fullName, roleName, token }) {
    const link = `${config.appUrl}/dat-mat-khau?token=${encodeURIComponent(token)}`
    const html = renderTemplate(loadTemplate('invite'), { fullName, roleName, link, appName: config.smtp.fromName })
    return send({ to, subject: `Mời dùng ${config.smtp.fromName}: đặt mật khẩu`, html })
  },
}

module.exports = emailService
