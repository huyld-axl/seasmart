import api from './client'

function crud(resource) {
  return {
    list: (params) => api.get(`/admin/master/${resource}`, { params }).then((r) => r.data),
    get: (id) => api.get(`/admin/master/${resource}/${id}`).then((r) => r.data),
    create: (data) => api.post(`/admin/master/${resource}`, data).then((r) => r.data),
    update: (id, data) => api.put(`/admin/master/${resource}/${id}`, data).then((r) => r.data),
    remove: (id) => api.delete(`/admin/master/${resource}/${id}`),
    restore: (id) => api.post(`/admin/master/${resource}/${id}/restore`),
  }
}

export const vesselApi = {
  ...crud('vessels'),
  // Các chuyến đi tàu đã khớp với tàu (đang trên tàu là chuyến chưa có ngày rời).
  service: (id) => api.get(`/admin/master/vessels/${id}/service`).then((r) => r.data),
  // Danh mục tàu thế giới (kho tra cứu). Trả { data, total }, mỗi dòng kèm prefill và unmatched cho form Thêm tàu.
  catalog: (params) => api.get('/admin/master/vessels/catalog', { params }).then((r) => r.data),
  // Lấy thông tin thông minh: tra IMO ở nguồn ngoài, trả bản đề xuất (không ghi vào tàu). Mỗi IMO có thời gian chờ ở máy chủ.
  // Nguồn ngoài có thể mất tới một phút nên nới giới hạn chờ (mặc định của client là 15 giây).
  lookup: (imo) => api.get(`/admin/master/vessels/lookup/${imo}`, { timeout: 70000 }).then((r) => r.data),
  lookupStatus: () => api.get('/admin/master/vessels/lookup-status').then((r) => r.data),
}
// Thêm nhanh loại tàu ngay trong form tàu (cần quyền catalog.update).
export const vesselTypeApi = {
  create: (data) => api.post('/admin/master/vessel-types', data).then((r) => r.data),
}
export const shipOwnerApi = {
  ...crud('ship-owners'),
  vessels: (id) => api.get(`/admin/master/ship-owners/${id}/vessels`).then((r) => r.data),
  linkVessel: (id, data) => api.post(`/admin/master/ship-owners/${id}/vessels`, data).then((r) => r.data),
  vesselCrew: (id, vesselId) => api.get(`/admin/master/ship-owners/${id}/vessels/${vesselId}/crew`).then((r) => r.data),
  // Quét danh thiếp để điền form (không lưu gì). AI đọc ngay trong lời gọi nên cho thời gian chờ dài.
  scanCard: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/admin/master/ship-owners/scan-card', form, { timeout: 120000 }).then((r) => r.data)
  },
}

// Logo công ty đối tác: ảnh cần token nên lấy dạng blob, tải lên bằng multipart field "file".
export const shipOwnerLogoApi = {
  get: (id, size = 'full') => api.get(`/admin/master/ship-owners/${id}/logo`, { params: { size }, responseType: 'blob' }).then((r) => r.data),
  upload: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/admin/master/ship-owners/${id}/logo`, form).then((r) => r.data)
  },
  remove: (id) => api.delete(`/admin/master/ship-owners/${id}/logo`).then((r) => r.data),
}
