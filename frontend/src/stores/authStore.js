import { create } from 'zustand'
import { authApi } from '../api'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,

  login: async (email, password) => {
    const res = await authApi.login({ email, password })
    const { user, token } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token })
    return user
  },

  refreshUser: async () => {
    const res = await authApi.me()
    const user = res.data
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
    return user
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },
}))

export default useAuthStore
