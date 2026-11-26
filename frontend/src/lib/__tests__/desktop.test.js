import { afterEach, describe, expect, it } from 'vitest'
import { isDesktop, desktop } from '../desktop'

describe('lib/desktop', () => {
  afterEach(() => {
    delete window.catoro
  })

  it('bản web: không có window.catoro', () => {
    expect(isDesktop()).toBe(false)
  })

  it('app máy tính: gọi qua cầu nối của app', async () => {
    window.catoro = { openMail: async (m) => ({ opened: true, files: m.files }) }
    expect(isDesktop()).toBe(true)
    await expect(desktop.openMail({ files: ['a.zip'] })).resolves.toEqual({ opened: true, files: ['a.zip'] })
  })
})
