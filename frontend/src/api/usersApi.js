import api from './client'

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  search: (q) => api.get('/users/search', { params: { q } }).then((r) => r.data.data || []),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
}
