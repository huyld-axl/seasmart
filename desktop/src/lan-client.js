// Máy nhân viên (docs/mcah-ke-hoach-desktop-gd3.md 3.2, 3.3): ghép với máy chính, rồi mọi /api đi qua HTTPS trong mạng
// văn phòng. Ghim chứng chỉ: bắt tay thử (không gửi dữ liệu) lấy chứng chỉ, so dấu vân tay với dấu vân tay máy chủ
// dịch vụ ghi trong vé; khớp thì dùng chính chứng chỉ đó làm CA duy nhất cho mọi kết nối sau (không tin kho CA nào khác).
// staff.json (két hệ điều hành): { officeId, officeName, fingerprint, name, port, host, deviceToken }.
const fs = require('fs')
const path = require('path')
const tls = require('tls')
const https = require('https')
const crypto = require('crypto')
const os = require('os')
const { Readable } = require('stream')
const { EventEmitter } = require('events')
const { app, safeStorage } = require('electron')
const discovery = require('./discovery')
const { PROTOCOL, LAN_PORT } = require('./lan')

const TIMEOUT_MS = 8000
const RETRY_MS = 5000
const events = new EventEmitter()
const file = (name) => path.join(app.getPath('userData'), name)
const fail = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra })

let staff = null
let agent = null
let online = true
let retryTimer = null
let failures = 0

function load() {
  try {
    if (fs.existsSync(file('staff.json'))) staff = JSON.parse(safeStorage.decryptString(fs.readFileSync(file('staff.json'))))
  } catch {
    staff = null
  }
  return staff
}

function save() {
  fs.writeFileSync(file('staff.json'), safeStorage.encryptString(JSON.stringify(staff)), { mode: 0o600 })
}

// Mã của bản cài này (không bí mật): máy chính nhận ra máy đã từng bị Gỡ.
function installId() {
  const f = file('install-id')
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim()
  const id = crypto.randomUUID()
  fs.writeFileSync(f, id)
  return id
}

// Bắt tay TLS lấy chứng chỉ máy ở host:port, chưa gửi gì. → { pem, fingerprint }
function probe(host, port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, rejectUnauthorized: false, servername: /^\d/.test(host) ? undefined : host, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate(false)
      socket.end()
      if (!cert?.raw) return reject(fail('Máy kia không gửi chứng chỉ', 'NO_CERT'))
      const pem = `-----BEGIN CERTIFICATE-----\n${cert.raw.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`
      resolve({ pem, fingerprint: cert.fingerprint256.replace(/:/g, '').toLowerCase() })
    })
    socket.on('timeout', () => socket.destroy(fail('Không nối được máy này', 'UNREACHABLE')))
    socket.on('error', () => reject(fail('Không nối được máy này', 'UNREACHABLE')))
  })
}

// Mở kết nối ghim tới host: sai dấu vân tay → WRONG_MACHINE (wireframe màn 7), không gửi dữ liệu.
async function pin(host, port, fingerprint) {
  const { pem, fingerprint: got } = await probe(host, port)
  if (got !== fingerprint) throw fail('Máy này không phải máy chính của văn phòng bạn', 'WRONG_MACHINE', { host })
  return new https.Agent({
    ca: pem,
    keepAlive: true,
    maxSockets: 16,
    // Tên trong chứng chỉ không khớp IP: thay kiểm tên bằng kiểm dấu vân tay (chuỗi đã tin nhờ ca chỉ có chứng chỉ này).
    checkServerIdentity: (_host, cert) => (cert.fingerprint256.replace(/:/g, '').toLowerCase() === fingerprint ? undefined : fail('Sai máy chính', 'WRONG_MACHINE')),
  })
}

// Gửi một request tới máy chính qua agent đã ghim. → { status, headers, body (Readable) }
function send(target, { method = 'GET', pathname, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: target.host, port: target.port, method, path: pathname, agent: target.agent, timeout: TIMEOUT_MS, headers: { ...headers, 'x-mcah-protocol': String(PROTOCOL) } }, (res) => {
      req.setTimeout(0)
      resolve({ status: res.statusCode, headers: res.headers, body: res })
    })
    req.on('timeout', () => req.destroy(fail('Máy chính không trả lời', 'UNREACHABLE')))
    req.on('error', (error) => reject(error.code === 'WRONG_MACHINE' ? error : fail('Không nối được máy chính', 'UNREACHABLE')))
    if (body && typeof body.pipe === 'function') body.pipe(req)
    else req.end(body || undefined)
  })
}

const readJson = async (res) => {
  const chunks = []
  for await (const c of res.body) chunks.push(c)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    return {}
  }
}

async function postJson(target, pathname, data) {
  const res = await send(target, { method: 'POST', pathname, headers: { 'content-type': 'application/json', ...(staff?.deviceToken ? { 'x-mcah-device': staff.deviceToken } : {}) }, body: JSON.stringify(data) })
  return { status: res.status, data: await readJson(res) }
}

// Thông tin máy chính từ vé (máy chủ dịch vụ ký): dấu vân tay, tên, cổng.
function mainFromTicket(ticket) {
  const claims = JSON.parse(Buffer.from(String(ticket).split('.')[1], 'base64url'))
  if (!claims.office) throw fail('Tài khoản chưa thuộc văn phòng nào', 'NO_OFFICE')
  if (!claims.machine_cert) throw fail('Máy chính chưa sẵn sàng cho máy nhân viên. Mở MCAH trên máy chính (có internet) rồi thử lại.', 'MAIN_NOT_READY')
  return { officeId: claims.office, officeName: claims.office_name, fingerprint: claims.machine_cert, name: claims.machine_name, port: claims.machine_port || LAN_PORT }
}

const lanClient = {
  events,
  load,
  isStaff: () => Boolean(load()?.deviceToken),
  info: () => (staff ? { officeName: staff.officeName, name: staff.name, host: staff.host, online } : null),

  // Tìm máy chính trong mạng (mDNS) theo mã văn phòng trong vé. → [{ name, host }]
  async find(ticket) {
    const main = mainFromTicket(ticket)
    const found = await discovery.find(main.officeId, 5000)
    return found.flatMap((svc) => (svc.addresses.length ? svc.addresses : [svc.host]).slice(0, 1).map((host) => ({ name: svc.name, host, port: svc.port })))
  },

  // Ghép với máy ở host. → { status: 'active' | 'pending' }
  async pair(ticket, host) {
    const main = mainFromTicket(ticket)
    const port = main.port
    const agentFor = await pin(host, port, main.fingerprint)
    const target = { host, port, agent: agentFor }
    const pairSecret = crypto.randomBytes(32).toString('base64url')
    const { status, data } = await postJson(target, '/lan/pair', { ticket, install_id: installId(), pair_secret: pairSecret, name: os.hostname().split('.')[0].slice(0, 63), os: `${os.type()} ${os.release()}`.slice(0, 80), app_version: app.getVersion() })
    if (status >= 400) throw fail(data.error || 'Máy chính từ chối ghép', data.code || 'PAIR_REJECTED')
    staff = { ...main, host, pairSecret: data.status === 'pending' ? pairSecret : null, deviceToken: data.token || null }
    save()
    if (data.status === 'active') lanClient.use(agentFor)
    return { status: data.status }
  },

  // Máy đang chờ quản trị duyệt hỏi lại. → { status }
  async pairStatus() {
    if (!staff?.pairSecret) return { status: staff?.deviceToken ? 'active' : 'none' }
    const target = await lanClient.target()
    const { data } = await postJson(target, '/lan/pair/status', { install_id: installId(), pair_secret: staff.pairSecret })
    if (data.status === 'active' && data.token) {
      staff.deviceToken = data.token
      staff.pairSecret = null
      save()
    }
    return { status: data.status || 'pending' }
  },

  use(agentFor) {
    agent = agentFor
  },

  // Kết nối tới máy chính đã ghép: dùng lại agent; lần đầu (mở app) thì ghim lại theo dấu vân tay đã lưu.
  async target() {
    if (!staff) throw fail('Máy này chưa ghép máy chính', 'NOT_PAIRED')
    if (!agent) agent = await pin(staff.host, staff.port, staff.fingerprint)
    return { host: staff.host, port: staff.port, agent }
  },

  // Tìm lại máy chính theo mã văn phòng khi địa chỉ cũ không nối được (máy chính đổi IP). Vẫn kiểm dấu vân tay.
  async rediscover() {
    const found = await discovery.find(staff.officeId, 4000)
    for (const svc of found) {
      for (const host of svc.addresses.length ? svc.addresses : [svc.host]) {
        try {
          agent = await pin(host, svc.port, staff.fingerprint)
          staff.host = host
          staff.port = svc.port
          save()
          return true
        } catch {}
      }
    }
    return false
  },

  // Chuyển một request /api của giao diện sang máy chính. Mất nối → 503 MAIN_UNREACHABLE (giao diện hiện dải đỏ).
  async forward({ method, pathname, headers, body }) {
    try {
      const target = await lanClient.target()
      const res = await send(target, { method, pathname, headers: { ...headers, 'x-mcah-device': staff.deviceToken }, body })
      setOnline(true)
      // Máy chính khác phiên bản giao tiếp: cần cập nhật theo máy chính (main.js → updater.updateFromMain).
      if (res.status === 426) events.emit('update-required')
      const out = new Headers()
      for (const [k, v] of Object.entries(res.headers)) if (!['connection', 'keep-alive', 'transfer-encoding'].includes(k)) out.set(k, Array.isArray(v) ? v.join(', ') : v)
      if (res.status === 401 && res.headers['content-type']?.includes('json')) {
        const data = await readJson(res)
        if (data.code === 'DEVICE_REMOVED') lanClient.forget()
        return new Response(JSON.stringify(data), { status: 401, headers: out })
      }
      return new Response(res.status === 204 || res.status === 304 ? null : Readable.toWeb(res.body), { status: res.status, headers: out })
    } catch (error) {
      if (error.code === 'WRONG_MACHINE') agent = null
      setOnline(false)
      return new Response(JSON.stringify({ error: 'Không nối được máy chính', code: 'MAIN_UNREACHABLE' }), { status: 503, headers: { 'content-type': 'application/json' } })
    }
  },

  // Tải một tệp bộ cài từ máy chính (lan-installers của máy chính). → Buffer
  async download(name) {
    const target = await lanClient.target()
    const res = await send(target, { pathname: `/lan/installer/${encodeURIComponent(name)}`, headers: { 'x-mcah-device': staff.deviceToken } })
    const chunks = []
    for await (const c of res.body) chunks.push(c)
    if (res.status !== 200) throw fail('Máy chính chưa có bộ cài cho máy này', 'NO_INSTALLER')
    return Buffer.concat(chunks)
  },

  // Gọi JSON (đăng nhập bằng vé qua máy chính) cho session.js.
  async call(pathname, data) {
    const target = await lanClient.target()
    const { status, data: result } = await postJson(target, pathname, data)
    if (status === 401 && result.code === 'DEVICE_REMOVED') lanClient.forget()
    return { status, data: result }
  },

  // Bị Gỡ: bỏ mã thiết bị, giữ install-id (lần ghép sau phải chờ duyệt).
  forget() {
    staff = null
    agent = null
    fs.rmSync(file('staff.json'), { force: true })
    events.emit('removed')
  },
}

// Mất nối: báo giao diện, thử lại mỗi 5 giây; quá 3 lần thì tìm lại máy chính qua mDNS (đổi IP).
function setOnline(value) {
  if (online === value) return
  online = value
  events.emit('online', value)
  clearTimeout(retryTimer)
  if (value) {
    failures = 0
    return
  }
  const retry = async () => {
    if (online || !staff) return
    failures++
    try {
      agent = null
      if (failures > 3 && (await lanClient.rediscover())) return setOnline(true)
      const target = await lanClient.target()
      const res = await send(target, { pathname: '/lan/hello' })
      res.body.resume()
      if (res.status === 200) return setOnline(true)
    } catch {}
    retryTimer = setTimeout(retry, RETRY_MS)
  }
  retryTimer = setTimeout(retry, RETRY_MS)
}

lanClient.retryNow = () => {
  if (online) return
  clearTimeout(retryTimer)
  failures = 3
  online = true
  setOnline(false)
}

module.exports = lanClient
