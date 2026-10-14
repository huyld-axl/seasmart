import api from './client'

// Bộ giấy tờ xuất (/api/v1/exports).
export const exportApi = {
  list: (params) => api.get('/exports', { params }).then((r) => r.data),
  get: (id) => api.get(`/exports/${id}`).then((r) => r.data),
  create: (body) => api.post('/exports', body).then((r) => r.data),
  preview: (body) => api.post('/exports/preview', body).then((r) => r.data),
  update: (id, body) => api.put(`/exports/${id}`, body).then((r) => r.data),
  // Cả bộ trong một .zip. format: 'pdf' | 'xlsx' | 'all'; gridlines: file có đường lưới ô hay không. Chuyển PDF có thể mất vài chục giây với bộ nhiều giấy.
  download: (id, format, gridlines = false) => api.get(`/exports/${id}/download`, { params: { format, gridlines }, responseType: 'blob', timeout: 180000 }),
  // Một giấy của bộ. format: 'pdf' | 'xlsx'.
  downloadDoc: (id, key, format, gridlines = false) => api.get(`/exports/${id}/docs/${key}/download`, { params: { format, gridlines }, responseType: 'blob', timeout: 180000 }),
}
