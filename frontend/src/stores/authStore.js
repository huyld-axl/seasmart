import { create } from 'zustand'
import { authApi } from '../api'
import { DESKTOP_TOKEN, desktop, isDesktop } from '../lib/desktop'

// App máy tính không giữ token ở giao diện (tiến trình chính gắn token khi chuyển tiếp /api): có thông tin người dùng
// đã lưu thì coi như đang đăng nhập, /auth/me trả 401 thì client.js đưa về màn đăng nhập.
const desktopMode = isDesktop()
const storedToken = desktopMode ? (localStorage.getItem('user') ? DESKTOP_TOKEN : null) : localStorage.getItem('token') || null

// Giá trị cũ hỏng (vd. chuỗi "undefined") không được làm sập cả app.
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

const useAuthStore = create((set) => ({
  user: readStoredUser(),
  token: storedToken,
  // false cho tới khi lấy xong quyền mới từ /auth/me (chỉ khi có token); tránh nháy trang 403 vì quyền cũ.
  ready: !storedToken,

  // App máy tính: tiến trình chính đã đăng nhập xong, chỉ ghi người dùng.
  setDesktopUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token: DESKTOP_TOKEN, ready: true })
  },

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
    if (desktopMode) desktop.logout().catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, ready: true })
  },
}))

export default useAuthStore
