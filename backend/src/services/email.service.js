const fs = require('fs')
const path = require('path')
const sgMail = require('@sendgrid/mail')
const config = require('../config')

sgMail.setApiKey(config.sendgrid.apiKey || 'dummy')

const TEMPLATES_DIR = path.join(__dirname, '../templates')

function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`)
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function renderTemplate(html, vars) {
  let out = html
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v != null ? String(v) : '')
  }
  return out
}

function shouldSend() {
  return config.sendgrid.apiKey && config.sendgrid.apiKey !== 'your_sendgrid_api_key_here'
}

const emailService = {
  async sendOtp(toEmail, otp) {
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: 'Mã xác nhận tài khoản MarinePort',
      text: `Mã xác nhận của bạn là: ${otp}\nMã có hiệu lực trong 5 phút.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1677ff;">Xác nhận tài khoản MarinePort</h2>
          <p>Mã xác nhận của bạn là:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                      color: #262626; background: #f5f7fa; padding: 16px 24px;
                      border-radius: 8px; display: inline-block; margin: 8px 0;">
            ${otp}
          </div>
          <p style="color: #8c8c8c; font-size: 13px;">Mã có hiệu lực trong <strong>5 phút</strong>.</p>
          <p style="color: #8c8c8c; font-size: 13px;">Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.</p>
        </div>
      `,
    }

    if (!config.sendgrid.apiKey || config.sendgrid.apiKey === 'your_sendgrid_api_key_here') {
      console.log(`[EMAIL OTP] To: ${toEmail} | OTP: ${otp}`)
      return
    }

    await sgMail.send(msg)
  },
}

module.exports = emailService
