import { afterEach, describe, expect, it } from 'vitest'
import { isDesktop, desktop } from '../desktop'

describe('lib/desktop', () => {
  afterEach(() => {
    delete window.mcah
  })

  it('bản web: không có window.mcah', () => {
    expect(isDesktop()).toBe(false)
  })

  it('app máy tính: gọi qua cầu nối của app', async () => {
    window.mcah = { openMail: async (m) => ({ opened: true, files: m.files }) }
    expect(isDesktop()).toBe(true)
    await expect(desktop.openMail({ files: ['a.zip'] })).resolves.toEqual({ opened: true, files: ['a.zip'] })
  })
})
