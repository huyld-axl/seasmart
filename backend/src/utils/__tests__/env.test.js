import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { productEnv } = require('../env')

const NAMES = ['CATORO_THU_A', 'MCAH_THU_A', 'CATORO_THU_B', 'MCAH_THU_B', 'CATORO_THU_C', 'MCAH_THU_C']

describe('productEnv', () => {
  afterEach(() => {
    for (const k of NAMES) delete process.env[k]
    vi.restoreAllMocks()
  })

  it('đọc tên mới CATORO_X; đặt cả hai thì tên mới thắng, không nhắc', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.CATORO_THU_A = 'moi'
    process.env.MCAH_THU_A = 'cu'
    expect(productEnv('THU_A')).toBe('moi')
    expect(warn).not.toHaveBeenCalled()
  })

  it('chỉ có tên cũ MCAH_X thì vẫn nhận, nhắc đổi tên một lần', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.MCAH_THU_B = 'cu'
    expect(productEnv('THU_B')).toBe('cu')
    expect(productEnv('THU_B')).toBe('cu')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('CATORO_THU_B')
  })

  it('không đặt thì undefined; đặt rỗng thì giữ chuỗi rỗng (không rơi về tên cũ)', () => {
    expect(productEnv('THU_C')).toBeUndefined()
    process.env.CATORO_THU_C = ''
    process.env.MCAH_THU_C = 'cu'
    expect(productEnv('THU_C')).toBe('')
  })
})
