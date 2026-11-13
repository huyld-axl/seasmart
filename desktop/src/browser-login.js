// Đăng nhập qua trình duyệt: OAuth cho app cài trên máy, RFC 8252 + PKCE S256 (docs/mcah-ke-hoach-desktop-gd2.md 3.3).
// Mở trình duyệt mặc định tới /authorize của máy chủ dịch vụ, chờ trình duyệt chuyển về http://127.0.0.1:<cổng tạm>/callback
// rồi đổi mã lấy { ticket, refresh_token, offline_until }. Không chuyển về được thì người dùng dán mã ngắn (submitShortCode).
const http = require('http')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { shell } = require('electron')
const { cloudPublicKeyFile } = require('./paths')

const CLIENT_ID = 'mcah-desktop'
const WAIT_MS = 10 * 60 * 1000

// Địa chỉ máy chủ dịch vụ: MCAH_CLOUD_URL, hoặc tệp cloud-url.txt gói kèm lúc build.
// Địa chỉ máy chủ dịch vụ (endpoints.js: biến môi trường → địa chỉ đã học từ bản tin cập nhật → địa chỉ gói lúc build).
function cloudUrl() {
  return require('./endpoints').cloudUrl()
}

// MCAH_OPEN_URL_WITH: lệnh mở trang thay cho trình duyệt mặc định (chỉ dùng khi chạy thử tự động).
function openInBrowser(url) {
  if (process.env.MCAH_OPEN_URL_WITH) spawn(process.env.MCAH_OPEN_URL_WITH, [url], { stdio: 'ignore', detached: true }).unref()
  else shell.openExternal(url)
}

// Khoá công khai của máy chủ dịch vụ, gói sẵn trong app (không cần mạng lúc mở app). Thiếu thì tắt đăng nhập.
function cloudPublicKey() {
  const file = process.env.MCAH_CLOUD_PUBLIC_KEY_FILE || cloudPublicKeyFile
  if (!fs.existsSync(file)) return null
  const pem = fs.readFileSync(file, 'utf8')
  crypto.createPublicKey(pem)
  return pem
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

async function postToken(body) {
  let r
  try {
    r = await fetch(`${cloudUrl()}/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ MCAH. Kiểm tra internet rồi thử lại.'), { offline: true })
  }
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data.message || 'Máy chủ MCAH từ chối đăng nhập'), { status: r.status, grant: data.error })
  return data
}

// Lần đăng nhập đang chờ (một lúc chỉ một).
let pending = null

function cancelLogin() {
  if (!pending) return
  pending.finish()
  pending.reject(Object.assign(new Error('Đã huỷ đăng nhập'), { cancelled: true }))
  pending = null
}

// maxAge = 0: bắt nhập lại mật khẩu thật (sau khi sai PIN 5 lần), không dùng phiên trình duyệt có sẵn.
function startLogin({ maxAge = null } = {}) {
  cancelLogin()
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))

  return new Promise((resolve, reject) => {
    let redirectUri
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/callback') return res.writeHead(404).end()
      if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
        return res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Yêu cầu không hợp lệ')
      }
      res.writeHead(302, { location: `${cloudUrl()}/xong` }).end()
      const current = pending
      try {
        const tokens = await postToken({ grant_type: 'authorization_code', code: url.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirectUri })
        current?.finish()
        if (pending === current) pending = null
        resolve(tokens)
      } catch (error) {
        reject(error)
      }
    })
    const timer = setTimeout(() => {
      if (pending?.server === server) cancelLogin()
    }, WAIT_MS)
    const finish = () => {
      clearTimeout(timer)
      server.close()
    }
    pending = { server, verifier, resolve, reject, finish }
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`
      const auth = new URL(`${cloudUrl()}/authorize`)
      const params = { client_id: CLIENT_ID, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: 'S256', state }
      if (maxAge !== null) params.max_age = String(maxAge)
      auth.search = new URLSearchParams(params).toString()
      pending.authUrl = auth.toString()
      openInBrowser(pending.authUrl)
    })
  })
}

// Mã ngắn trên trang "Đã đăng nhập" (khi trình duyệt không chuyển về app được). Cần lần đăng nhập đang chờ (verifier).
async function submitShortCode(code) {
  if (!pending) throw new Error('Bấm Đăng nhập qua trình duyệt trước rồi nhập mã')
  const current = pending
  const tokens = await postToken({ grant_type: 'authorization_code', short_code: code, code_verifier: current.verifier })
  current.finish()
  if (pending === current) pending = null
  current.resolve(tokens)
  return tokens
}

const refreshTokens = (refreshToken) => postToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
const revokeRefresh = (refreshToken) => postToken({ grant_type: 'revoke', refresh_token: refreshToken }).catch(() => {})
const reopenBrowser = () => {
  if (pending?.authUrl) openInBrowser(pending.authUrl)
}

module.exports = { cloudUrl, cloudPublicKey, startLogin, submitShortCode, cancelLogin, refreshTokens, revokeRefresh, reopenBrowser }
