// Mã 6 số theo thời gian (TOTP, RFC 6238: HMAC-SHA1, 30 giây) — đúng cấu hình mặc định của Google Authenticator,
// Microsoft Authenticator, Authy… Dùng cho đăng nhập khu nội bộ (docs/catoro-ke-hoach-khu-noi-bo.md 5.4).
const crypto = require('crypto')

const STEP = 30
const DIGITS = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32(buf) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

// Mã của bước thời gian `step` (RFC 4226 mục 5.3).
function codeAt(secret, step) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = crypto.createHmac('sha1', secret).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 15
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS
  return String(n).padStart(DIGITS, '0')
}

const stepAt = (now = Date.now()) => Math.floor(now / 1000 / STEP)

// Kiểm mã, cho lệch ±1 bước (đồng hồ điện thoại / server lệch tới 30 giây). → bước khớp, hoặc null.
// afterStep: bước đã dùng lần trước; mã của bước đó hoặc cũ hơn bị từ chối (không dùng lại được).
function verify(secret, code, { now = Date.now(), afterStep = -1 } = {}) {
  const clean = String(code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const current = stepAt(now)
  for (const step of [current - 1, current, current + 1]) {
    if (step <= afterStep) continue
    if (crypto.timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(clean))) return step
  }
  return null
}

// URI cho mã QR (Key Uri Format của Google Authenticator).
function uri(secret, { issuer, account }) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${base32(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`
}

module.exports = { base32, codeAt, stepAt, verify, uri, STEP }
