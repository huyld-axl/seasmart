// App máy tính: giao diện không giữ token (tiến trình chính gắn khi chuyển tiếp /api). authStore không đọc token trong
// localStorage; có thông tin người dùng đã lưu thì đánh dấu đã đăng nhập; đăng xuất gọi qua app.
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  delete window.mcah
  localStorage.clear()
  vi.resetModules()
})

describe('authStore ở app máy tính', () => {
  it('không dùng token trong localStorage; đăng xuất gọi window.mcah.logout', async () => {
    const logout = vi.fn(async () => {})
    window.mcah = { logout }
    localStorage.setItem('token', 'token-cu-con-sot')
    localStorage.setItem('user', JSON.stringify({ email: 'a@b.vn' }))
    const { default: useAuthStore } = await import('../authStore')
    expect(useAuthStore.getState().token).toBe('desktop')
    useAuthStore.getState().logout()
    expect(logout).toHaveBeenCalled()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('bản web vẫn đọc token như cũ', async () => {
    localStorage.setItem('token', 'tok')
    const { default: useAuthStore } = await import('../authStore')
    expect(useAuthStore.getState().token).toBe('tok')
  })
})
