import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
})

// Gắn JWT token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Xử lý lỗi global
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else {
      const msg =
        err.response?.data?.error || err.response?.data?.message || err.message || 'Có lỗi xảy ra'
      message.error(msg)
    }
    return Promise.reject(err)
  }
)

export default api
