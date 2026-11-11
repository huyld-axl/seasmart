import axios from 'axios'
import { toast } from '../components/ds/useToast'
import { isDesktop } from '../lib/desktop'
import usePdfComponentStore from '../stores/pdfComponentStore'

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

// Mã lỗi của máy chủ; với tải tệp (responseType blob) thì thân lỗi cũng là blob, đọc ra JSON.
async function errorCode(err) {
  const body = err.response?.data
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await body.text()).code
    } catch {
      return null
    }
  }
  return body?.code
}

// Xử lý lỗi global
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // App máy tính thiếu LibreOffice: mời cài, cài xong gửi lại đúng yêu cầu xuất vừa bấm (một lần).
    if (err.response?.status === 424 && isDesktop() && !err.config?._pdfRetried && (await errorCode(err)) === 'PDF_COMPONENT_MISSING') {
      if (await usePdfComponentStore.getState().ask()) return api.request({ ...err.config, _pdfRetried: true })
    }
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
