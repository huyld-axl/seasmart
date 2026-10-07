import api from './client'

// Bộ giấy tờ xuất (/api/v1/exports) và link ký của thuyền viên (/api/v1/public/sign).
export const exportApi = {
  list: (params) => api.get('/exports', { params }).then((r) => r.data),
  get: (id) => api.get(`/exports/${id}`).then((r) => r.data),
  create: (body) => api.post('/exports', body).then((r) => r.data),
  approve: (id) => api.post(`/exports/${id}/approve`, {}).then((r) => r.data),
  reject: (id, reason) => api.post(`/exports/${id}/reject`, { reason }).then((r) => r.data),
  sign: (id, signer) => api.post(`/exports/${id}/sign`, { signer }).then((r) => r.data),
  smsStatus: () => api.get('/exports/sms').then((r) => r.data),
  sendSms: (id) => api.post(`/exports/${id}/sms`, {}).then((r) => r.data),
  download: (id) => api.get(`/exports/${id}/download`, { responseType: 'blob' }),
}

export const publicSignApi = {
  get: (token) => api.get(`/public/sign/${token}`).then((r) => r.data),
  sign: (token, body) => api.post(`/public/sign/${token}`, body).then((r) => r.data),
}
