// "Tiếp tục với Google" (OpenID Connect, code + PKCE + state + nonce; docs/mcah-ke-hoach-desktop-gd2.md 3.3).
// id_token lấy thẳng từ token endpoint của Google qua HTTPS bằng client secret, nên kiểm iss / aud / exp / nonce là đủ
// (OIDC Core 3.1.3.7, mục 6). Đăng nhập lại bắt buộc (max_age=0, sau khi sai PIN 5 lần): gửi prompt=login + max_age=0
// và kiểm auth_time mới hơn lúc bắt đầu.
const crypto = require('crypto')
const config = require('../config')
const pool = require('../db')
const { audit } = require('./accounts')
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

// Tài khoản cho người dùng Google: theo google_sub; chưa có thì theo email (Google đã xác minh) và gắn google_sub;
// chưa có nữa thì tạo tài khoản mới (không mật khẩu).
async function accountFor({ sub, email, name }, ip) {
  let { rows } = await pool.query('SELECT * FROM account WHERE google_sub = $1', [sub])
  let account = rows[0]
  if (!account) {
    ;({ rows } = await pool.query(
      'UPDATE account SET google_sub = $2, email_verified_at = COALESCE(email_verified_at, NOW()), full_name = COALESCE(full_name, $3) WHERE email = $1 AND google_sub IS NULL RETURNING *',
      [email, sub, name]
    ))
    account = rows[0]
  }
  if (!account) {
    ;({ rows } = await pool.query('INSERT INTO account (email, full_name, google_sub, email_verified_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (email) DO NOTHING RETURNING *', [email, name, sub]))
    account = rows[0]
    // Email đã có tài khoản gắn với một tài khoản Google khác.
    if (!account) throw fail('Email này đã gắn với một tài khoản Google khác. Đăng nhập bằng mật khẩu, hoặc liên hệ MCAH.')
    await audit(account.id, 'register_google', ip)
  }
  if (account.disabled_at) throw { statusCode: 403, message: 'Tài khoản đã bị khoá' }
  await audit(account.id, 'login_google', ip)
  return account
}

module.exports = { enabled, start, finish, accountFor, redirectUri }
