// Hàm dùng chung: mã ngẫu nhiên, băm mã bí mật (chỉ lưu bản băm), mật khẩu scrypt, mã ngắn dễ gõ.
const crypto = require('crypto')

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const randomToken = (bytes = 32) => b64url(crypto.randomBytes(bytes))
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password.normalize('NFC'), salt, 32, SCRYPT)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

function checkPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false
  const [, salt, hash] = stored.split('$')
  const actual = crypto.scryptSync(String(password).normalize('NFC'), Buffer.from(salt, 'base64'), 32, SCRYPT)
  const expected = Buffer.from(hash, 'base64')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

// Mã 8 ký tự dạng XXXX-XXXX, bỏ chữ dễ nhầm (0/O, 1/I/L).
const SHORT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function shortCode() {
  const chars = [...crypto.randomBytes(8)].map((b) => SHORT_ALPHABET[b % SHORT_ALPHABET.length]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4)}`
}
const normalizeShortCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

module.exports = { b64url, randomToken, sha256, hashPassword, checkPassword, shortCode, normalizeShortCode, EMAIL, escapeHtml }
