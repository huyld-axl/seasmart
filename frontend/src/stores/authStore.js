import { create } from 'zustand'
import { authApi } from '../api'

const storedToken = localStorage.getItem('token') || null

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: storedToken,
  // false cho tới khi lấy xong quyền mới từ /auth/me (chỉ khi có token); tránh nháy trang 403 vì quyền cũ.
  ready: !storedToken,

  login: async (email, password) => {
    const res = await authApi.login({ email, password })
    const { user, token } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token, ready: true })
    return user
  },

  // Lấy quyền hiện tại từ máy chủ. Gọi một lần khi mở app; đổi quyền có hiệu lực ở lần tải trang tới.
  refreshUser: async () => {
    try {
      const res = await authApi.me()
      const user = res.data.user
      localStorage.setItem('user', JSON.stringify(user))
      set({ user, ready: true })
      return user
    } catch (error) {
      set({ ready: true })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, ready: true })
  },
}))

export default useAuthStore
