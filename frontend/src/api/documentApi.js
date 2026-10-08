import api from './client'

// Giấy tờ AI đọc (/api/v1/documents): tải lên, duyệt từng ô, đưa vào hồ sơ.
export const documentApi = {
  list: (seafarerId) => api.get(`/documents/seafarer/${seafarerId}`).then((r) => r.data),
  upload: (seafarerId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/documents/seafarer/${seafarerId}`, form).then((r) => r.data)
  },
  decide: (id, key, action, value) => api.put(`/documents/${id}/fields/${key}`, value === undefined ? { action } : { action, value }).then((r) => r.data),
  retry: (id) => api.post(`/documents/${id}/retry`, {}).then((r) => r.data),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
  publish: (seafarerId) => api.post(`/documents/seafarer/${seafarerId}/publish`, {}).then((r) => r.data),
  file: (id) => api.get(`/documents/${id}/file`, { responseType: 'blob' }).then((r) => r.data),
}
