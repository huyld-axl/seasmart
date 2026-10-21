import api from './client'

export const roleApi = {
  // Tên + mô tả các vai trò cho ô chọn ở màn Tài khoản (cần account.view, không cần role.manage).
  options: () => api.get('/roles/options').then((r) => r.data.data),
  catalog: () => api.get('/roles/catalog').then((r) => r.data),
  list: () => api.get('/roles').then((r) => r.data.data),
  create: (data) => api.post('/roles', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/roles/${id}`, data).then((r) => r.data.data),
  savePermissions: (roles) => api.put('/roles/permissions', { roles }).then((r) => r.data.data),
  remove: (id) => api.delete(`/roles/${id}`),
}
