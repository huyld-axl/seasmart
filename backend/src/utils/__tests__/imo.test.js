import { describe, it, expect } from 'vitest'
import { isValidImo } from '../imo'

describe('isValidImo', () => {
  it('nhận IMO đúng số kiểm tra', () => {
    expect(isValidImo('9074729')).toBe(true)
    expect(isValidImo('9194945')).toBe(true)
  })
  it('từ chối IMO sai số kiểm tra', () => {
    expect(isValidImo('9524454')).toBe(false)
    expect(isValidImo('9194946')).toBe(false)
  })
  it('từ chối giá trị không phải 7 chữ số', () => {
    expect(isValidImo('123456')).toBe(false)
    expect(isValidImo('IMO9074729')).toBe(false)
    expect(isValidImo(null)).toBe(false)
  })
})
