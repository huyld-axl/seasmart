// Máy chủ dịch vụ — bản thử của giai đoạn 0 (bước 0.5). Chỉ có: trang đăng nhập email + mật khẩu, OAuth cho app
// cài trên máy (PKCE S256, chuyển về http://127.0.0.1:<cổng>/callback, RFC 8252), và cấp vé ký Ed25519.
// Không thư viện ngoài. Dữ liệu (khoá ký, tài khoản thử) nằm trong cloud/.data/, không commit.
//   node server.js                 chạy máy chủ (PORT, mặc định 4100)
//   node server.js add-user EMAIL  thêm tài khoản thử, mật khẩu đọc từ stdin
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DATA_DIR = path.join(__dirname, '.data')
const PORT = parseInt(process.env.PORT) || 4100
const CLIENT_ID = 'mcah-desktop'
const AUDIENCE = 'mcah-office'
const OFFLINE_DAYS = 7
const CODE_TTL_MS = 2 * 60 * 1000

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })

// Khoá ký vé: tạo một lần. App / máy chính chỉ giữ khoá công khai.
function signingKey() {
  const file = path.join(DATA_DIR, 'signing-key.pem')
  if (!fs.existsSync(file)) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519')
    fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  }
  return crypto.createPrivateKey(fs.readFileSync(file))
}
const privateKey = signingKey()
const publicKeyPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })

const usersFile = path.join(DATA_DIR, 'users.json')
const loadUsers = () => (fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, 'utf8')) : {})

function hashPassword(password, salt = crypto.randomBytes(16)) {
  return `${salt.toString('base64')}:${crypto.scryptSync(password, salt, 32).toString('base64')}`
}
function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), 32)
  return crypto.timingSafeEqual(actual, Buffer.from(hash, 'base64'))
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

// Vé = JWT EdDSA. exp là mốc hết hạn offline: máy chính không cấp phiên vượt quá mốc này.
function issueTicket(user) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: 'mcah-cloud', aud: AUDIENCE, sub: user.id, email: user.email,
    iat: now, auth_time: now, exp: now + OFFLINE_DAYS * 86400,
  }))
  const signature = crypto.sign(null, Buffer.from(`${header}.${payload}`), privateKey)
  return `${header}.${payload}.${b64url(signature)}`
}

// Mã dùng một lần, gắn với code_challenge và redirect_uri; hết hạn sau 2 phút.
const codes = new Map()

const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{2,5}\/callback$/
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function loginPage(params, error = '') {
  const hidden = ['client_id', 'redirect_uri', 'code_challenge', 'state']
    .map((k) => `<input type="hidden" name="${k}" value="${escapeHtml(params.get(k) || '')}">`).join('')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Đăng nhập SeaSmart</title><style>body{font-family:system-ui;background:#f3f4f6;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:32px;border-radius:16px;width:320px;display:grid;gap:12px}input{padding:10px;border:1px solid #ccc;border-radius:8px}
button{padding:12px;border:0;border-radius:8px;background:#003366;color:#fff;font-weight:600}.err{color:#b91c1c}</style></head>
<body><form method="post" action="/authorize"><h2>Đăng nhập SeaSmart</h2>${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
${hidden}<label>Email <input name="email" type="email" required autofocus style="width:100%;box-sizing:border-box"></label>
<label>Mật khẩu <input name="password" type="password" required style="width:100%;box-sizing:border-box"></label>
<button>Đăng nhập</button></form></body></html>`
}

const donePage = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Đã đăng nhập</title></head>
<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh">Đã đăng nhập. Quay lại app SeaSmart.</body></html>`

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1e5) req.destroy()
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-frame-options': 'DENY', ...extra })
  res.end(body)
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json')

function validAuthorize(params) {
  return params.get('client_id') === CLIENT_ID && LOOPBACK.test(params.get('redirect_uri') || '') &&
    /^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') || '') && (params.get('state') || '').length >= 16
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'GET' && url.pathname === '/public-key') return send(res, 200, publicKeyPem, 'text/plain')
  if (req.method === 'GET' && url.pathname === '/done') return send(res, 200, donePage)

  if (url.pathname === '/authorize') {
    const params = req.method === 'POST' ? new URLSearchParams(await readBody(req)) : url.searchParams
    if (!validAuthorize(params)) return send(res, 400, 'Yêu cầu đăng nhập không hợp lệ', 'text/plain; charset=utf-8')
    if (req.method === 'GET') return send(res, 200, loginPage(params))
    const email = (params.get('email') || '').trim().toLowerCase()
    const user = loadUsers()[email]
    if (!user || !checkPassword(params.get('password') || '', user.password)) {
      return send(res, 401, loginPage(params, 'Email hoặc mật khẩu không đúng'))
    }
    const code = b64url(crypto.randomBytes(32))
    codes.set(code, { user, challenge: params.get('code_challenge'), redirectUri: params.get('redirect_uri'), expires: Date.now() + CODE_TTL_MS })
    const back = new URL(params.get('redirect_uri'))
    back.searchParams.set('code', code)
    back.searchParams.set('state', params.get('state'))
    return send(res, 302, '', 'text/plain', { location: back.toString() })
  }

  if (req.method === 'POST' && url.pathname === '/token') {
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return sendJson(res, 400, { error: 'invalid_request' })
    }
    const entry = codes.get(body.code)
    codes.delete(body.code)
    if (!entry || entry.expires < Date.now() || entry.redirectUri !== body.redirect_uri) return sendJson(res, 400, { error: 'invalid_grant' })
    const challenge = b64url(crypto.createHash('sha256').update(String(body.code_verifier || '')).digest())
    if (challenge !== entry.challenge) return sendJson(res, 400, { error: 'invalid_grant' })
    return sendJson(res, 200, { ticket: issueTicket(entry.user) })
  }

  send(res, 404, 'Không có', 'text/plain; charset=utf-8')
}

async function addUser(email) {
  const password = fs.readFileSync(0, 'utf8').split('\n')[0]
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || password.length < 12) throw new Error('Email sai hoặc mật khẩu dưới 12 ký tự')
  const users = loadUsers()
  users[email.toLowerCase()] = { id: users[email.toLowerCase()]?.id || crypto.randomUUID(), email: email.toLowerCase(), password: hashPassword(password) }
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), { mode: 0o600 })
  console.log('Đã thêm tài khoản thử')
}

if (process.argv[2] === 'add-user') {
  addUser(process.argv[3] || '').catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
} else {
  http.createServer((req, res) => handle(req, res).catch(() => send(res, 500, 'Lỗi', 'text/plain'))).listen(PORT, '127.0.0.1', () => {
    console.log(`Máy chủ dịch vụ thử: http://127.0.0.1:${PORT}`)
  })
}
