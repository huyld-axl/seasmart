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
  async sendEnrollmentPending(toEmail, vars) {
    const html = renderTemplate(loadTemplate('email-enrollment-pending'), vars)
    if (!toEmail || !html) return
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: `[MarinePort] Đăng ký mới: ${vars.seafarer_name || ''} - ${vars.course_name || ''}`,
      html,
    }
    if (!shouldSend()) {
      console.log('[EMAIL] Enrollment PENDING to', toEmail, vars)
      return
    }
    await sgMail.send(msg)
  },

  async sendEnrollmentApproved(toEmail, vars) {
    const html = renderTemplate(loadTemplate('email-enrollment-approved'), vars)
    if (!toEmail || !html) return
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: `[MarinePort] Đăng ký đã được duyệt: ${vars.course_name || ''}`,
      html,
    }
    if (!shouldSend()) {
      console.log('[EMAIL] Enrollment APPROVED to', toEmail, vars)
      return
    }
    await sgMail.send(msg)
  },

  async sendEnrollmentRejected(toEmail, vars) {
    const html = renderTemplate(loadTemplate('email-enrollment-rejected'), vars)
    if (!toEmail || !html) return
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: `[MarinePort] Thông báo về đăng ký khóa học: ${vars.course_name || ''}`,
      html,
    }
    if (!shouldSend()) {
      console.log('[EMAIL] Enrollment REJECTED to', toEmail, vars)
      return
    }
    await sgMail.send(msg)
  },

  async sendCourseReminder(toEmail, vars) {
    const html = renderTemplate(loadTemplate('email-course-reminder'), vars)
    if (!toEmail || !html) return
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: `[MarinePort] Nhắc nhở: Khóa học ${vars.course_name || ''} bắt đầu sau 3 ngày`,
      html,
    }
    if (!shouldSend()) {
      console.log('[EMAIL] Course reminder to', toEmail, vars.course_name)
      return
    }
    await sgMail.send(msg)
  },

  async sendWaitlistNotify(toEmail, vars) {
    const html = renderTemplate(loadTemplate('email-waitlist-notify'), vars)
    if (!toEmail || !html) return
    const msg = {
      to: toEmail,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject: `[MarinePort] Có chỗ trống: ${vars.course_name || ''}`,
      html,
    }
    if (!shouldSend()) {
      console.log('[EMAIL] Waitlist notify to', toEmail, vars)
      return
    }
    await sgMail.send(msg)
  },
}

module.exports = emailService
