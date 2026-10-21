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
}

module.exports = emailService
