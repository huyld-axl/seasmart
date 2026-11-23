import api from './client'

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  // Ô chọn người phụ trách: tài khoản đang hoạt động, ai đăng nhập cũng gọi được.
  options: () => api.get('/users/options'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  resendInvite: (id) => api.post(`/users/${id}/resend-invite`),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
}
