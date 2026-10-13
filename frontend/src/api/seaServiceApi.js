import api from './client'

// Chuyến đi tàu (/api/v1): đọc, thêm tay theo thuyền viên; sửa và xoá theo chuyến, bắt buộc kèm lý do
// (backend từ chối thiếu lý do, và ghi lý do vào lịch sử hồ sơ).
export const seaServiceApi = {
  list: (seafarerId) => api.get(`/seafarers/${seafarerId}/sea-services`).then((r) => r.data.data),
  create: (seafarerId, trip) => api.post(`/seafarers/${seafarerId}/sea-services`, trip).then((r) => r.data),
  update: (id, trip, reason) => api.put(`/sea-services/${id}`, { ...trip, reason }).then((r) => r.data),
  remove: (id, reason) => api.delete(`/sea-services/${id}`, { data: { reason } }).then((r) => r.data),
}
