import { describe, it, expect } from 'vitest'
import { flagEmoji, withFlag } from '../flag'

describe('flag', () => {
  it('đổi mã nước sang emoji cờ', () => {
    expect(flagEmoji('VN')).toBe('🇻🇳')
    expect(flagEmoji('sg')).toBe('🇸🇬')
  })
  it('mã không hợp lệ thì không có cờ', () => {
    expect(flagEmoji('')).toBe('')
    expect(flagEmoji('VNM')).toBe('')
    expect(flagEmoji(null)).toBe('')
  })
  it('ghép cờ bên trái tên nước', () => {
    expect(withFlag('JP', 'Nhật Bản')).toBe('🇯🇵 Nhật Bản')
    expect(withFlag(null, 'Nhật Bản')).toBe('Nhật Bản')
  })
})


it('cờ tùy chỉnh được ưu tiên và xóa cờ sẽ quay lại ISO', () => {
  expect(withFlag('VN', 'Việt Nam', '🇻🇳')).toBe('🇻🇳 Việt Nam')
  expect(withFlag('VN', 'Tên mẫu', '🇸🇬')).toBe('🇸🇬 Tên mẫu')
  expect(withFlag('VN', 'Việt Nam', '')).toBe('🇻🇳 Việt Nam')
  expect(withFlag('VN', 'Việt Nam', null)).toBe('🇻🇳 Việt Nam')
})
