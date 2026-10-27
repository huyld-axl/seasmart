import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { createRateWindow } = require('../rate_window')

describe('createRateWindow', () => {
  it('cho tối đa max lượt trong cửa sổ, lượt sau bị chặn kèm số giây chờ', () => {
    let t = 0
    const w = createRateWindow({ max: 2, windowMs: 60000, now: () => t })
    expect(w.hit('u1').ok).toBe(true)
    t = 10000
    expect(w.hit('u1').ok).toBe(true)
    t = 20000
    expect(w.hit('u1')).toEqual({ ok: false, retryAfter: 40 })
  })
  it('mỗi khoá đếm riêng và lượt cũ ra khỏi cửa sổ thì được dùng lại', () => {
    let t = 0
    const w = createRateWindow({ max: 1, windowMs: 1000, now: () => t })
    expect(w.hit('a').ok).toBe(true)
    expect(w.hit('b').ok).toBe(true)
    expect(w.hit('a').ok).toBe(false)
    t = 1500
    expect(w.hit('a').ok).toBe(true)
  })
})
