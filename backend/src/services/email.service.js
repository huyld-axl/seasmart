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

async function send({ to, subject, html }) {
  if (!shouldSend()) return false
  const { fromName, fromEmail } = config.smtp
  await getTransporter().sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, html })
  return true
}

const emailService = {
  send,

  // Thư mời đặt mật khẩu cho tài khoản mới. `token` là mã gốc, chỉ có trong thư.
  async sendInvite({ to, fullName, roleName, token }) {
    const link = `${config.appUrl}/dat-mat-khau?token=${encodeURIComponent(token)}`
    const html = renderTemplate(loadTemplate('invite'), { fullName, roleName, link, appName: config.smtp.fromName })
    return send({ to, subject: `Mời dùng ${config.smtp.fromName}: đặt mật khẩu`, html })
  },
}

module.exports = emailService
