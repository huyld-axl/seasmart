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
}
export const shipOwnerApi = crud('ship-owners')
