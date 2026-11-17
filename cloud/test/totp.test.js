// TOTP theo số mẫu RFC 6238 phụ lục B (SHA-1, khoá ASCII "12345678901234567890"), lấy 6 số cuối của mã 8 số.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const totp = require('../src/services/totp')
const SECRET = Buffer.from('12345678901234567890')

describe('totp', () => {
  it('khớp số mẫu RFC 6238', () => {
    for (const [time, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) {
      expect(totp.codeAt(SECRET, Math.floor(time / 30))).toBe(code)
    }
  })

  it('cho lệch ±1 bước, không nhận bước đã dùng, không nhận mã sai dạng', () => {
    const now = 1234567890 * 1000
    const step = totp.stepAt(now)
    expect(totp.verify(SECRET, totp.codeAt(SECRET, step - 1), { now })).toBe(step - 1)
    expect(totp.verify(SECRET, totp.codeAt(SECRET, step + 1), { now })).toBe(step + 1)
    expect(totp.verify(SECRET, totp.codeAt(SECRET, step - 2), { now })).toBeNull()
    expect(totp.verify(SECRET, totp.codeAt(SECRET, step), { now, afterStep: step })).toBeNull()
    expect(totp.verify(SECRET, '12345', { now })).toBeNull()
    expect(totp.verify(SECRET, 'abcdef', { now })).toBeNull()
  })

  it('base32 và URI cho app Authenticator', () => {
    expect(totp.base32(SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(totp.uri(SECRET, { issuer: 'MCAH internal', account: 'a@b.vn' })).toBe('otpauth://totp/MCAH%20internal%3Aa%40b.vn?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=MCAH%20internal&algorithm=SHA1&digits=6&period=30')
  })
})
