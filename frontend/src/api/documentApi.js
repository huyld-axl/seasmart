import api from './client'

// Giấy tờ AI đọc (/api/v1/documents): tải lên, duyệt từng ô, đưa vào hồ sơ.
export const documentApi = {
  list: (seafarerId) => api.get(`/documents/seafarer/${seafarerId}`).then((r) => r.data),
  upload: (seafarerId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/documents/seafarer/${seafarerId}`, form).then((r) => r.data)
  },
  // Quét nhanh một tệp để điền form (không lưu gì). `kind` đứng trước `file` để máy chủ đọc được khi nhận tệp.
  scan: (file, kind = 'auto') => {
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    return api.post('/documents/scan', form).then((r) => r.data)
  },
  decide: (id, key, action, value) => api.put(`/documents/${id}/fields/${key}`, value === undefined ? { action } : { action, value }).then((r) => r.data),
  retry: (id) => api.post(`/documents/${id}/retry`, {}).then((r) => r.data),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
  publish: (seafarerId) => api.post(`/documents/seafarer/${seafarerId}/publish`, {}).then((r) => r.data),
  file: (id) => api.get(`/documents/${id}/file`, { responseType: 'blob' }).then((r) => r.data),
  get: (id) => api.get(`/documents/${id}`).then((r) => r.data),
  status: () => api.get('/documents/status').then((r) => r.data),
  // Đổi loại giấy: AI đọc lại giấy đó (khoảng 30 giây), trả giấy ở trạng thái đang đọc.
  retype: (id, docType) => api.put(`/documents/${id}/type`, { docType }).then((r) => r.data),
  // Chấp nhận mọi ô đọc rõ; ô ngày chưa chắc và số GCNKNCM ở lại cho người duyệt chạm.
  acceptClear: (id) => api.post(`/documents/${id}/accept-clear`, {}).then((r) => r.data),
  setVessel: (id, body) => api.put(`/documents/${id}/vessel`, body).then((r) => r.data),
  confirmOwner: (id) => api.post(`/documents/${id}/confirm-owner`, {}).then((r) => r.data),
  confirmCertificates: (ids) => api.post('/documents/certificates/confirm', { ids }).then((r) => r.data),
  retryUpload: (uploadId) => api.post(`/documents/uploads/${uploadId}/retry`, {}).then((r) => r.data),
  removeUpload: (uploadId) => api.delete(`/documents/uploads/${uploadId}`).then((r) => r.data),
  regroup: (uploadId, parts) => api.post(`/documents/uploads/${uploadId}/regroup`, { parts }).then((r) => r.data),
  // Địa chỉ ảnh trang (dùng làm src của <img>, cần tiêu đề xác thực nên lấy qua `pageImage`).
  pageImage: (uploadId, pageNo, size = 'full') =>
    api.get(`/documents/uploads/${uploadId}/pages/${pageNo}/image`, { params: { size }, responseType: 'blob' }).then((r) => r.data),
  uploadFile: (uploadId) => api.get(`/documents/uploads/${uploadId}/file`, { responseType: 'blob' }).then((r) => r.data),
}
