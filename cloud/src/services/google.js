// "Tiếp tục với Google" (OpenID Connect, code + PKCE + state + nonce; docs/catoro-ke-hoach-desktop-gd2.md 3.3).
// id_token lấy thẳng từ token endpoint của Google qua HTTPS bằng client secret, nên kiểm iss / aud / exp / nonce là đủ
// (OIDC Core 3.1.3.7, mục 6). Đăng nhập lại bắt buộc (max_age=0, sau khi sai PIN 5 lần): gửi prompt=login + max_age=0
// và kiểm auth_time mới hơn lúc bắt đầu.
const crypto = require('crypto')
const config = require('../config')
const pool = require('../db')
const accounts = require('./accounts')
const { b64url, randomToken } = require('../util')

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const fail = (message) => ({ statusCode: 400, message })

const enabled = () => Boolean(config.google.clientId && config.google.clientSecret)
const redirectUri = () => `${config.publicUrl}/google/callback`

// Bắt đầu: trả { url, pending } — pending cất trong cookie ký để kiểm ở callback.
function start({ reauth = false } = {}) {
  const verifier = randomToken(32)
  const pending = { state: randomToken(16), nonce: randomToken(16), verifier, reauth, startedAt: Date.now() }
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    prompt: reauth ? 'login' : 'select_account',
  })
  if (reauth) params.set('max_age', '0')
  return { url: `${AUTH_URL}?${params}`, pending }
}

function decodeIdToken(idToken) {
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3) throw fail('Google trả dữ liệu không hợp lệ')
  return JSON.parse(Buffer.from(parts[1], 'base64url'))
}

// Đổi mã của Google lấy thông tin người dùng đã kiểm. fetchImpl: để test thay Google.
async function finish({ code, state, pending, fetchImpl = fetch }) {
  if (!pending || !state || state !== pending.state) throw fail('Phiên đăng nhập Google đã hết hoặc không khớp. Thử lại.')
  const r = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code', code_verifier: pending.verifier }),
  }).catch(() => {
    throw { statusCode: 502, message: 'Không kết nối được Google, thử lại sau' }
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.id_token) throw fail('Google từ chối đăng nhập. Thử lại.')
  const claims = decodeIdToken(data.id_token)
  const now = Math.floor(Date.now() / 1000)
  if (!ISSUERS.includes(claims.iss) || claims.aud !== config.google.clientId || !(claims.exp > now) || claims.nonce !== pending.nonce) {
    throw fail('Thông tin đăng nhập Google không hợp lệ')
  }
  if (!claims.email || claims.email_verified !== true) throw fail('Email Google chưa được xác minh')
  if (pending.reauth && !(claims.auth_time && claims.auth_time * 1000 >= pending.startedAt - 60 * 1000)) {
    throw fail('Google chưa xác nhận lại mật khẩu. Thử lại và nhập mật khẩu Google.')
  }
  return { sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: claims.name || null }
}

// Tài khoản cho người dùng Google: theo google_sub; chưa có thì theo email (Google đã xác minh) và gắn google_sub.
// Không tự tạo tài khoản: tài khoản do Axalize / quản trị văn phòng tạo (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md).
async function accountFor({ sub, email, name }) {
  let { rows } = await pool.query('SELECT * FROM account WHERE google_sub = $1', [sub])
  let account = rows[0]
  if (!account) {
    ;({ rows } = await pool.query(
      'UPDATE account SET google_sub = $2, full_name = COALESCE(full_name, $3) WHERE email = $1 AND google_sub IS NULL RETURNING *',
      [email, sub, name]
    ))
    account = rows[0]
  }
  if (!account && (await accounts.forLogin(email))) {
    ;({ rows } = await pool.query('UPDATE account SET google_sub = $2 WHERE email = $1 AND google_sub IS NULL RETURNING *', [email, sub]))
    account = rows[0]
  }
  if (!account) {
    const existing = (await pool.query('SELECT 1 FROM account WHERE email = $1', [email])).rows[0]
    // Email đã gắn với một tài khoản Google khác (đổi tài khoản Google cùng email): dùng mã email.
    if (existing) throw fail('Email này đã gắn với một tài khoản Google khác. Đăng nhập bằng mã gửi qua email.')
    throw fail(`Email ${email} chưa có tài khoản Catoro. Hỏi quản trị văn phòng tạo tài khoản cho email này, hoặc đăng nhập bằng email khác.`)
  }
  if (account.disabled_at) throw { statusCode: 403, message: 'Tài khoản này đã bị khoá. Liên hệ quản trị.' }
  return account
}

module.exports = { enabled, start, finish, accountFor, redirectUri }
