import api from './client'

export const roleApi = {
  catalog: () => api.get('/roles/catalog').then((r) => r.data),
  list: () => api.get('/roles').then((r) => r.data.data),
  create: (data) => api.post('/roles', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/roles/${id}`, data).then((r) => r.data.data),
  savePermissions: (roles) => api.put('/roles/permissions', { roles }).then((r) => r.data.data),
  remove: (id) => api.delete(`/roles/${id}`),
}
