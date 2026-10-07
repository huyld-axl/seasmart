import api from './client'

function crud(resource) {
  return {
    list: (params) => api.get(`/admin/master/${resource}`, { params }).then((r) => r.data),
    create: (data) => api.post(`/admin/master/${resource}`, data).then((r) => r.data),
    update: (id, data) => api.put(`/admin/master/${resource}/${id}`, data).then((r) => r.data),
    remove: (id) => api.delete(`/admin/master/${resource}/${id}`),
    restore: (id) => api.post(`/admin/master/${resource}/${id}/restore`),
  }
}

export const vesselApi = crud('vessels')
export const shipOwnerApi = crud('ship-owners')
