import api from './client'

// Chuyến: một thuyền viên đi một tàu. Lên tàu ghi khi chốt trên cơ hội hoặc khi tạo chuyến tay.
export const voyageApi = {
  list: (params) => api.get('/voyages', { params }).then((r) => r.data),
  get: (id) => api.get(`/voyages/${id}`).then((r) => r.data),
  create: (data) => api.post('/voyages', data).then((r) => r.data),
  editDates: (id, body) => api.patch(`/voyages/${id}/dates`, body).then((r) => r.data),
  leavePlan: (id, body) => api.post(`/voyages/${id}/leave-plan`, body).then((r) => r.data),
  leave: (id, body) => api.post(`/voyages/${id}/leave`, body).then((r) => r.data),
  leaveMany: (body) => api.post('/voyages/leave', body).then((r) => r.data),
  remove: (id, body) => api.delete(`/voyages/${id}`, { data: body || {} }).then((r) => r.data),
  crewTimeline: (params) => api.get('/voyages/crew-timeline', { params }).then((r) => r.data),
}

// Yêu cầu thanh toán (bill phải thu) sinh khi duyệt hợp đồng.
export const billApi = {
  list: (params) => api.get('/bills', { params }).then((r) => r.data),
  get: (id) => api.get(`/bills/${id}`).then((r) => r.data),
  update: (id, data) => api.put(`/bills/${id}`, data).then((r) => r.data),
  move: (id, action, body) => api.post(`/bills/${id}/${action}`, body || {}).then((r) => r.data),
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
