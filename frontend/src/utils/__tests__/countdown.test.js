import { describe, expect, it } from 'vitest'
import { formatCountdown, secondsLeft } from '../countdown'

describe('formatCountdown', () => {
  it('đổi giây sang m:ss', () => {
    expect(formatCountdown(120)).toBe('2:00')
    expect(formatCountdown(105)).toBe('1:45')
    expect(formatCountdown(59)).toBe('0:59')
    expect(formatCountdown(5)).toBe('0:05')
  })
  it('làm tròn lên số lẻ, không âm, không NaN', () => {
    expect(formatCountdown(0.2)).toBe('0:01')
    expect(formatCountdown(-3)).toBe('0:00')
    expect(formatCountdown(undefined)).toBe('0:00')
  })
})

describe('secondsLeft', () => {
  it('tính số giây còn lại, làm tròn lên', () => {
    expect(secondsLeft(10_500, 10_000)).toBe(1)
    expect(secondsLeft(130_000, 10_000)).toBe(120)
  })
  it('chưa đặt hoặc đã qua thì 0', () => {
    expect(secondsLeft(undefined)).toBe(0)
    expect(secondsLeft(5_000, 10_000)).toBe(0)
  })
})
