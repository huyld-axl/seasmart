import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { warnings } = require('../src/routes/admin')

describe('cảnh báo dùng bất thường', () => {
  it('tăng vọt quét AI / tra tàu, đổi máy chính nhiều lần', () => {
    expect(warnings({ ai_day: 500, ai_avg: 20, lookup_day: 0, lookup_avg: 0, machine_moves: 0 })).toEqual(['Quét AI tăng vọt: 500 trang / 24 giờ'])
    expect(warnings({ ai_day: 0, ai_avg: 0, lookup_day: 80, lookup_avg: 2, machine_moves: 3 })).toHaveLength(2)
  })
  it('bình thường hoặc còn ít thì không cảnh báo', () => {
    expect(warnings({ ai_day: 40, ai_avg: 1, lookup_day: 10, lookup_avg: 9, machine_moves: 2 })).toEqual([])
    expect(warnings({ ai_day: 120, ai_avg: 100, lookup_day: 0, lookup_avg: 0, machine_moves: 0 })).toEqual([])
  })
})
