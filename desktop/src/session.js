// Phiên đăng nhập ở tiến trình chính (docs/mcah-ke-hoach-desktop-gd2.md 4.1). Giao diện không giữ token: tiến trình
// chính gắn Authorization khi chuyển tiếp /api. JWT + refresh token cất bằng két hệ điều hành (session.bin); Ubuntu
// chỉ có basic_text thì không lưu (đăng nhập lại mỗi lần mở app).
// Vòng đời: login → vé → máy chính (desktop-ticket) → JWT. Máy chưa có văn phòng → chờ tạo văn phòng (createOffice).
// Có mạng thì làm mới mỗi giờ (refresh token → vé mới → JWT mới, đẩy mốc offline); mất mạng giữ phiên tới mốc.
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const { app, safeStorage } = require('electron')
const { secretStoreAvailable } = require('./settings')
const login = require('./browser-login')
const office = require('./office')
const pin = require('./pin')

const REFRESH_MS = 60 * 60 * 1000
const ROLLBACK_MS = 60 * 60 * 1000

// Giờ hiện tại; MCAH_FAKE_NOW (ISO) chỉ có tác dụng khi chạy dev, để thử mốc 7 ngày.
const now = () => (!app.isPackaged && process.env.MCAH_FAKE_NOW ? new Date(process.env.MCAH_FAKE_NOW).getTime() : Date.now())

// Chống chỉnh lùi đồng hồ để kéo dài 7 ngày: nhớ thời điểm lớn nhất từng thấy; lùi quá 1 giờ thì bỏ phiên.
function clockOk() {
  if (!state) return true
  const t = now()
  if (state.maxSeen && t < state.maxSeen - ROLLBACK_MS) return false
  if (!state.maxSeen || t > state.maxSeen + 60 * 1000) {
    state.maxSeen = t
    save()
  }
  return true
}
const events = new EventEmitter()
let state = null // { jwt, refreshToken, offlineUntil, user }
let pendingOffice = null // { tokens, account } khi máy chưa có văn phòng
let backendUrl = null
let lastReason = null // lý do phiên vừa hết, hiện ở màn đăng nhập
let timer = null

const file = () => path.join(app.getPath('userData'), 'session.bin')

function save() {
  if (!state || !secretStoreAvailable()) return
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(state)), { mode: 0o600 })
}

function load() {
  try {
    if (secretStoreAvailable() && fs.existsSync(file())) state = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())))
  } catch {
    state = null
  }
  if (state && new Date(state.offlineUntil).getTime() <= now()) {
    state = null
    lastReason = 'offline'
  } else if (state && !clockOk()) {
    state = null
    lastReason = 'clock'
  }
}

function clear(reason = null) {
  lastReason = reason
  state = null
  pendingOffice = null
  fs.rmSync(file(), { force: true })
  events.emit('changed')
}

async function backend(pathname, body) {
  const r = await fetch(`${backendUrl()}${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data.error || 'Máy chính từ chối đăng nhập'), { status: r.status, code: data.code })
  return data
}

// Vé + refresh token từ máy chủ dịch vụ → phiên ở máy chính.
async function adopt(tokens) {
  const result = await backend('/api/v1/auth/desktop-ticket', { ticket: tokens.ticket })
  if (result.needs_office) {
    pendingOffice = { tokens, account: result.account }
    events.emit('changed')
    return { needsOffice: true, account: result.account }
  }
  state = { jwt: result.token, refreshToken: tokens.refresh_token, offlineUntil: result.offline_until, user: result.user, maxSeen: now() }
  pendingOffice = null
  save()
  events.emit('changed')
  return { user: result.user }
}

const session = {
  events,

  init(getBackendUrl) {
    backendUrl = getBackendUrl
    load()
    clearInterval(timer)
    timer = setInterval(() => session.refresh().catch(() => {}), REFRESH_MS)
    if (state) session.refresh().catch(() => {})
  },

  jwt() {
    session.checkExpiry()
    return state?.jwt || null
  },

  checkExpiry() {
    if (state && new Date(state.offlineUntil).getTime() <= now()) clear('offline')
    else if (state && !clockOk()) clear('clock')
  },

  info() {
    session.checkExpiry()
    if (state) return { loggedIn: true, user: state.user, offlineUntil: state.offlineUntil, now: new Date(now()).toISOString(), persisted: secretStoreAvailable() }
    if (pendingOffice) return { loggedIn: false, needsOffice: true, account: pendingOffice.account }
    return { loggedIn: false, reason: lastReason }
  },

  async login({ maxAge = null } = {}) {
    return adopt(await login.startLogin({ maxAge }))
  },

  async loginWithCode(code) {
    // startLogin đang chờ sẽ nhận vé và adopt ở login(); ở đây chỉ đổi mã.
    await login.submitShortCode(code)
  },

  cancelLogin: login.cancelLogin,
  reopenBrowser: login.reopenBrowser,

  prepareOffice: (backupPassword) => office.prepare(backupPassword),

  // Tạo văn phòng ở máy chủ dịch vụ (bằng vé), làm mới vé để có văn phòng + máy, rồi ghi vào máy chính.
  async createOffice(name) {
    if (!pendingOffice) throw new Error('Đăng nhập trước khi tạo văn phòng')
    if (!office.hasPrepared()) throw new Error('Chưa đặt mật khẩu sao lưu')
    const { publicPem } = office.machineKey()
    const r = await fetch(`${login.cloudUrl()}/api/offices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${pendingOffice.tokens.ticket}` },
      body: JSON.stringify({ name, machine_public_key: publicPem }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {
      throw new Error('Không kết nối được máy chủ MCAH. Kiểm tra internet rồi bấm Thử lại.')
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.message || 'Máy chủ MCAH không tạo được văn phòng')
    const tokens = await login.refreshTokens(pendingOffice.tokens.refresh_token)
    const result = await backend('/api/v1/auth/desktop-office', { ticket: tokens.ticket, machine_public_key: publicPem })
    state = { jwt: result.token, refreshToken: tokens.refresh_token, offlineUntil: result.offline_until, user: result.user }
    pendingOffice = null
    save()
    events.emit('changed')
    return { user: result.user }
  },

  // Làm mới khi có mạng. Lỗi mạng: giữ phiên tới mốc. Máy chủ từ chối (bị bỏ khỏi văn phòng, đổi mật khẩu…): đăng xuất.
  async refresh() {
    if (!state?.refreshToken) return
    let tokens
    try {
      tokens = await login.refreshTokens(state.refreshToken)
    } catch (error) {
      if (error.offline) return
      clear()
      throw error
    }
    try {
      await adopt(tokens)
    } catch (error) {
      if (error.status === 401 || error.status === 403) clear()
      throw error
    }
  },

  async logout() {
    const refreshToken = state?.refreshToken || pendingOffice?.tokens?.refresh_token
    pin.clear()
    clear()
    if (refreshToken) await login.revokeRefresh(refreshToken)
  },

  // Máy chính báo phiên hết (401): bỏ phiên, giao diện về màn đăng nhập.
  expired: clear,
}

module.exports = session
