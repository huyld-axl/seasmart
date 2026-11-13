// Cài đặt theo máy (wireframe 4): cách gửi email và cấu hình SMTP của người dùng máy này.
// userData/settings.json giữ phần không bí mật; mật khẩu SMTP mã hoá bằng safeStorage (két hệ điều hành) ở smtp.secret.
// Ubuntu không có kho bí mật (safeStorage rơi về basic_text) thì không cho lưu mật khẩu: không âm thầm dùng cách yếu.
const fs = require('fs')
const path = require('path')
const { app, safeStorage } = require('electron')
const { defaultMailApp } = require('./mail')

const PROVIDERS = {
  gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
}

const file = () => path.join(app.getPath('userData'), 'settings.json')
const secretFile = () => path.join(app.getPath('userData'), 'smtp.secret')

function secretStoreAvailable() {
  if (!safeStorage.isEncryptionAvailable()) return false
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'))
  } catch {
    return {}
  }
}

// Cài đặt gửi cho giao diện (không bao giờ kèm mật khẩu).
function getSettings() {
  const saved = read()
  const mailApp = defaultMailApp()
  return {
    mailMode: saved.mailMode || (mailApp ? 'app' : 'smtp'),
    lockMinutes: saved.lockMinutes || 15,
    // Kênh cập nhật (docs/mcah-ke-hoach-desktop-gd6.md 3.4): 'stable' | 'beta'. Máy nhân viên theo máy chính.
    updateChannel: saved.updateChannel === 'beta' ? 'beta' : 'stable',
    filesDir: saved.filesDir || null,
    seenVersion: saved.seenVersion || null,
    endpoints: saved.endpoints || null,
    mailApp,
    smtp: saved.smtp || { provider: 'gmail', user: '' },
    smtpPasswordSaved: fs.existsSync(secretFile()),
    secretStore: secretStoreAvailable(),
  }
}

function saveSettings({ mailMode, smtp, smtpPassword, lockMinutes, updateChannel, seenVersion, endpoints }) {
  const next = { ...read() }
  if (endpoints !== undefined) next.endpoints = endpoints
  if (seenVersion !== undefined) next.seenVersion = seenVersion
  if (mailMode !== undefined) next.mailMode = mailMode
  if (lockMinutes !== undefined) next.lockMinutes = lockMinutes
  if (updateChannel !== undefined) next.updateChannel = updateChannel
  if (smtp !== undefined) {
    const preset = PROVIDERS[smtp.provider] || {}
    next.smtp = {
      provider: smtp.provider,
      user: smtp.user,
      host: smtp.provider === 'other' ? smtp.host : preset.host,
      port: smtp.provider === 'other' ? smtp.port : preset.port,
      secure: smtp.provider === 'other' ? Boolean(smtp.secure) : preset.secure,
    }
  }
  if (smtpPassword) {
    if (!secretStoreAvailable()) throw new Error('Máy chưa có kho mật khẩu an toàn, chỉ dùng được cách app mail')
    fs.writeFileSync(secretFile(), safeStorage.encryptString(smtpPassword), { mode: 0o600 })
  }
  fs.writeFileSync(file(), JSON.stringify(next, null, 2), { mode: 0o600 })
  return getSettings()
}

// Cấu hình SMTP đầy đủ (có mật khẩu) để gửi một thư; null nếu chưa đủ.
function smtpConfig() {
  const { smtp } = read()
  if (!smtp?.host || !smtp.user || !fs.existsSync(secretFile()) || !secretStoreAvailable()) return null
  return { ...smtp, password: safeStorage.decryptString(fs.readFileSync(secretFile())) }
}

module.exports = { getSettings, saveSettings, smtpConfig, secretStoreAvailable, PROVIDERS }
