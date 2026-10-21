import axios from 'axios'
import { toast } from '../components/ds/useToast'

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
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (!err.response) {
      // Chỉ báo chung khi mất kết nối (không có phản hồi); nhiều request cùng hỏng vẫn chỉ một toast.
      // Lỗi máy chủ trả về thì nơi gọi tự báo bằng câu có tên việc, để mỗi lỗi chỉ một toast.
      toast.offline()
    }
    return Promise.reject(err)
  }
)

export default api
