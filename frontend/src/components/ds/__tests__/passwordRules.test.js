import { describe, it, expect } from 'vitest'
import { containsEmail, passwordRules, isPasswordValid } from '../passwordRules'

const email = 'lel2910200510@gmail.com'

describe('passwordRules', () => {
  it('mật khẩu bằng phần trước @ của email bị báo trùng', () => {
    expect(containsEmail('lel2910200510', email)).toBe(true)
    expect(passwordRules('lel2910200510', email).find((r) => r.key === 'email').ok).toBe(false)
    expect(isPasswordValid('lel2910200510', email)).toBe(false)
  })
  it('chứa tên email (hoa thường, thêm ký tự) cũng bị báo', () => {
    expect(containsEmail('Lel2910200510!', email)).toBe(true)
    expect(containsEmail('xx-lel2910200510', email)).toBe(true)
    expect(containsEmail(email, email)).toBe(true)
  })
  it('mật khẩu khác thì đạt', () => {
    expect(isPasswordValid('Khac2910xyz', email)).toBe(true)
    expect(containsEmail('', email)).toBe(false)
  })
  it('tên email ngắn dưới 3 ký tự chỉ bắt khi trùng cả email', () => {
    expect(containsEmail('ab123456', 'ab@x.vn')).toBe(false)
    expect(containsEmail('Xhuy12345', 'huy@x.vn')).toBe(true)
  })
})
