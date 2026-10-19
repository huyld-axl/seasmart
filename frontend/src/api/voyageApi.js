import api from './client'

// Chuyến tàu (vị trí dự kiến, bắt đầu / kết thúc chuyến).
export const voyageApi = {
  list: (params) => api.get('/voyages', { params }).then((r) => r.data),
  get: (id) => api.get(`/voyages/${id}`).then((r) => r.data),
  create: (data) => api.post('/voyages', data).then((r) => r.data),
  update: (id, data) => api.put(`/voyages/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/voyages/${id}`).then((r) => r.data),
  start: (id, body) => api.post(`/voyages/${id}/start`, body).then((r) => r.data),
  end: (id, body) => api.post(`/voyages/${id}/end`, body).then((r) => r.data),
}

// Hợp đồng thuyền viên. Tên khác contractApi cũ (employment-contracts) để không đụng nhau.
export const seafarerContractApi = {
  list: (params) => api.get('/contracts', { params }).then((r) => r.data),
  get: (id) => api.get(`/contracts/${id}`).then((r) => r.data),
  create: (data) => api.post('/contracts', data).then((r) => r.data),
  update: (id, data) => api.put(`/contracts/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/contracts/${id}`).then((r) => r.data),
  submit: (id) => api.post(`/contracts/${id}/submit`).then((r) => r.data),
  withdraw: (id) => api.post(`/contracts/${id}/withdraw`).then((r) => r.data),
  approve: (id, body) => api.post(`/contracts/${id}/approve`, body).then((r) => r.data),
  reject: (id, body) => api.post(`/contracts/${id}/reject`, body).then((r) => r.data),
}
