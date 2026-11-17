// Vé đăng nhập (JWT EdDSA) do máy chủ dịch vụ ký, máy chính kiểm bằng khoá công khai gói sẵn trong app.
// kid = 16 ký tự đầu của SHA-256 khoá công khai, để sau này đổi khoá mà app vẫn nhận vé ký bằng khoá cũ / mới.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')
const { b64url } = require('../util')

const AUDIENCE = 'mcah-office'

let key = null
function signingKey() {
  if (!key) {
    if (!fs.existsSync(config.signingKeyFile)) {
      fs.mkdirSync(path.dirname(config.signingKeyFile), { recursive: true, mode: 0o700 })
      const { privateKey } = crypto.generateKeyPairSync('ed25519')
      fs.writeFileSync(config.signingKeyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
    }
    const privateKey = crypto.createPrivateKey(fs.readFileSync(config.signingKeyFile))
    const publicPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
    key = { privateKey, publicPem, kid: crypto.createHash('sha256').update(publicPem).digest('hex').slice(0, 16) }
  }
  return key
}

// claims: { sub, email, name, office, office_role, machine, auth_time }. exp = mốc offline (now + 7 ngày), không quá mốc
// phải đăng nhập lại (auth_time + 30 ngày; docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md 3.8).
function issue(claims, now = Date.now()) {
  const { privateKey, kid } = signingKey()
  const iat = Math.floor(now / 1000)
  let exp = iat + config.offlineDays * 86400
  // login_until: mốc phải đăng nhập lại, app dùng để nhắc trước 2 ngày.
  const extra = claims.auth_time ? { login_until: claims.auth_time + config.sessionMaxDays * 86400 } : {}
  if (extra.login_until) exp = Math.min(exp, extra.login_until)
  const header = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid }))
  const payload = b64url(JSON.stringify({ iss: 'mcah-cloud', aud: AUDIENCE, iat, exp, ...claims, ...extra }))
  const signature = crypto.sign(null, Buffer.from(`${header}.${payload}`), privateKey)
  return { ticket: `${header}.${payload}.${b64url(signature)}`, exp }
}

// Kiểm vé do chính máy chủ này ký (dùng khi app gọi API bằng vé, vd. tạo văn phòng). null nếu sai / hết hạn.
function verify(ticket, now = Date.now()) {
  try {
    const [header, payload, signature] = String(ticket).split('.')
    const publicKey = crypto.createPublicKey(signingKey().publicPem)
    if (!crypto.verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url'))
    if (claims.aud !== AUDIENCE || claims.exp <= Math.floor(now / 1000)) return null
    return claims
  } catch {
    return null
  }
}

const publicKeys = () => [{ kid: signingKey().kid, pem: signingKey().publicPem }]

module.exports = { issue, verify, publicKeys, AUDIENCE }
