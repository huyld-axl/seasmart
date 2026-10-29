import api from './client'

const data = (r) => r.data

// Cơ hội: một vị trí chủ tàu cần người, ứng viên, đề xuất, ghi nhận gửi chủ tàu, chốt người.
export const opportunityApi = {
  list: (params) => api.get('/opportunities', { params }).then(data),
  get: (id) => api.get(`/opportunities/${id}`).then(data),
  create: (body) => api.post('/opportunities', body).then(data),
  update: (id, body) => api.put(`/opportunities/${id}`, body).then(data),
  duplicate: (id, body) => api.post(`/opportunities/${id}/duplicate`, body || {}).then(data),
  close: (id, body) => api.post(`/opportunities/${id}/close`, body).then(data),
  reopen: (id) => api.post(`/opportunities/${id}/reopen`).then(data),
  remove: (id) => api.delete(`/opportunities/${id}`).then(data),
  presets: (params) => api.get('/opportunities/requirement-presets', { params }).then(data),
  savePreset: (rankId, requirements) => api.put(`/opportunities/requirement-presets/${rankId}`, { requirements }).then(data),
  suggestions: (id, params) => api.get(`/opportunities/${id}/suggestions`, { params }).then(data),
  addCandidates: (id, body) => api.post(`/opportunities/${id}/candidates`, body).then(data),
  removeCandidate: (id, seafarerId) => api.delete(`/opportunities/${id}/candidates/${seafarerId}`).then(data),
  selectOwner: (id, seafarerId) => api.post(`/opportunities/${id}/candidates/${seafarerId}/owner-selected`).then(data),
  unselectOwner: (id, seafarerId) => api.delete(`/opportunities/${id}/candidates/${seafarerId}/owner-selected`).then(data),
  recordSend: (id, body) => api.post(`/opportunities/${id}/sends`, body).then(data),
  // Hồ sơ nộp của một ứng viên; ensurePack tạo / bổ sung bộ biểu mẫu theo yêu cầu.
  submission: (id, seafarerId) => api.get(`/opportunities/${id}/candidates/${seafarerId}/submission`).then(data),
  ensurePack: (id, seafarerId) => api.post(`/opportunities/${id}/candidates/${seafarerId}/submission/pack`).then(data),
  place: (id, body) => api.post(`/opportunities/${id}/place`, body).then(data),
}
