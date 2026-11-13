// Các việc giao diện nhờ app làm (GĐ1 mục 3.1). Mỗi kênh kiểm dữ liệu vào: kiểu, độ dài; tệp chỉ nhận tên trong
// thư mục gửi thư; địa chỉ ngoài chỉ nhận vài trang cố định.
const path = require('path')
const { app, ipcMain, shell } = require('electron')
const { openMail, attachmentDir, defaultMailApp } = require('./mail')
const { getSettings, saveSettings } = require('./settings')
const { findSoffice, installSoffice } = require('./pdf-component')
const session = require('./session')
const pin = require('./pin')

const EXTERNAL = {
  thunderbird: 'https://www.thunderbird.net/vi/download/',
  libreoffice: 'https://vi.libreoffice.org/download/download/',
}
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+$/

function str(v, max, name) {
  if (typeof v !== 'string' || v.length > max) throw new Error(`${name} không hợp lệ`)
  return v
}

function emails(list, name) {
  if (list === undefined) return []
  if (!Array.isArray(list) || list.length > 50 || !list.every((a) => typeof a === 'string' && EMAIL.test(a))) throw new Error(`${name} không hợp lệ`)
  return list
}

function checkMail(m) {
  if (!m || typeof m !== 'object') throw new Error('Thư không hợp lệ')
  const files = m.files || []
  if (!Array.isArray(files) || files.length > 50 || !files.every((f) => typeof f === 'string' && f.length < 255 && !/[\\/]/.test(f) && f !== '..' && path.basename(f) === f)) {
    throw new Error('Tệp đính kèm không hợp lệ')
  }
  return {
    to: emails(m.to, 'Người nhận'),
    cc: emails(m.cc, 'CC'),
    bcc: emails(m.bcc, 'BCC'),
    subject: str(m.subject ?? '', 500, 'Tiêu đề'),
    body: str(m.body ?? '', 20000, 'Nội dung'),
    files,
  }
}

function checkSettings(s) {
  if (!s || typeof s !== 'object') throw new Error('Cài đặt không hợp lệ')
  const out = {}
  if (s.mailMode !== undefined) {
    if (!['app', 'smtp'].includes(s.mailMode)) throw new Error('Cách gửi email không hợp lệ')
    out.mailMode = s.mailMode
  }
  if (s.smtp !== undefined) {
    const { provider, user, host, port, secure } = s.smtp || {}
    if (!['gmail', 'outlook', 'other'].includes(provider)) throw new Error('Loại email không hợp lệ')
    if (typeof user !== 'string' || !EMAIL.test(user)) throw new Error('Email gửi không hợp lệ')
    out.smtp = { provider, user }
    if (provider === 'other') {
      out.smtp.host = str(host, 255, 'Máy chủ')
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng không hợp lệ')
      out.smtp.port = port
      out.smtp.secure = Boolean(secure)
    }
  }
  if (s.smtpPassword !== undefined) out.smtpPassword = str(s.smtpPassword, 256, 'Mật khẩu')
  if (s.lockMinutes !== undefined) {
    if (!Number.isInteger(s.lockMinutes) || s.lockMinutes < 5 || s.lockMinutes > 60) throw new Error('Thời gian tự khoá từ 5 đến 60 phút')
    out.lockMinutes = s.lockMinutes
  }
  return out
}

// hooks: { relaunch, openLogs, restartBackend(sofficePath), checkUpdate, lanStatus, lanFind, lanPair, lanPairStatus, lanInfo, lanRetry }
function registerIpc(hooks) {
  const handle = (channel, fn) => ipcMain.handle(`mcah:${channel}`, (event, arg) => fn(arg, event))
  handle('open-mail', (m) => openMail(checkMail(m)))
  handle('mail-status', () => ({ app: defaultMailApp() }))
  handle('open-mail-folder', () => shell.openPath(attachmentDir()))
  handle('open-external', (kind) => {
    if (!EXTERNAL[kind]) throw new Error('Địa chỉ không hợp lệ')
    return shell.openExternal(EXTERNAL[kind])
  })
  handle('pdf-component', () => ({ installed: Boolean(findSoffice()) }))
  let installing = null
  handle('install-pdf-component', (_arg, event) => {
    if (!installing) {
      installing = installSoffice((p) => event.sender.send('mcah:pdf-install-progress', p))
        .then(async (soffice) => {
          await hooks.restartBackend(soffice)
          return { installed: true }
        })
        .finally(() => {
          installing = null
        })
    }
    return installing
  })
  // Đăng nhập / văn phòng (docs/mcah-ke-hoach-desktop-gd2.md 4.1, 4.3).
  handle('session', () => session.info())
  handle('login', (opts) => session.login({ maxAge: opts?.reauth ? 0 : null }))
  handle('login-code', (code) => {
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{8,12}$/.test(code.trim())) throw new Error('Mã gồm 8 chữ và số, ví dụ K7P2-9QXM')
    return session.loginWithCode(code.trim())
  })
  handle('cancel-login', () => session.cancelLogin())
  handle('reopen-browser', () => session.reopenBrowser())
  handle('logout', () => session.logout())
  // Mã PIN và màn khoá (4.4).
  handle('lock-state', () => ({ locked: pin.isLocked(), hasPin: pin.hasPin() }))
  handle('set-pin', (value) => pin.setPin(str(String(value), 6, 'Mã PIN')))
  handle('unlock', (value) => {
    const result = pin.unlock(str(String(value ?? ''), 6, 'Mã PIN'))
    if (result.exhausted) session.expired('pin')
    return result
  })
  handle('refresh-session', async () => {
    await session.refresh()
    return session.info()
  })
  handle('prepare-office', (password) => session.prepareOffice(str(password, 200, 'Mật khẩu sao lưu')))
  handle('create-office', (name) => {
    const clean = str(name, 200, 'Tên văn phòng').trim()
    if (!clean) throw new Error('Nhập tên văn phòng')
    return session.createOffice(clean)
  })
  handle('get-settings', () => getSettings())
  handle('save-settings', (s) => saveSettings(checkSettings(s)))
  handle('check-update', () => hooks.checkUpdate())
  // Giai đoạn 3: trạng thái máy chính (thẻ trong Cài đặt trên máy này).
  handle('lan-status', () => hooks.lanStatus())
  // Máy nhân viên: tìm, ghép máy chính (wireframe màn 1), trạng thái nối (màn 3).
  handle('lan-find', () => hooks.lanFind())
  handle('lan-pair', (host) => {
    const clean = str(String(host ?? ''), 253, 'Tên / địa chỉ máy').trim()
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(clean)) throw new Error('Gõ tên máy (vd. MAY-KE-TOAN) hoặc địa chỉ IP (vd. 192.168.1.20)')
    return hooks.lanPair(clean)
  })
  handle('lan-pair-status', () => hooks.lanPairStatus())
  handle('lan-info', () => hooks.lanInfo())
  handle('lan-retry', () => hooks.lanRetry())
  handle('startup-retry', () => hooks.relaunch())
  handle('open-logs', () => hooks.openLogs())
  handle('quit', () => app.quit())
}

module.exports = { registerIpc, checkMail, checkSettings }
