import api from './client'
export { notificationApi } from './notificationApi'

function cleanListParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null)
  )
}

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

export const seafarerApi = {
  list: (params) => api.get('/seafarers', { params: cleanListParams(params) }),
  getById: (id) => api.get(`/seafarers/${id}`),
  create: (data) => api.post('/seafarers', data),
  update: (id, data) => api.put(`/seafarers/${id}`, data),
  remove: (id) => api.delete(`/seafarers/${id}`),
  getContacts: (id) => api.get(`/seafarers/${id}/contacts`),
  createContact: (id, data) => api.post(`/seafarers/${id}/contacts`, data),
  deleteContact: (id, contactId) => api.delete(`/seafarers/${id}/contacts/${contactId}`),
  getPhoto: (id) => api.get(`/seafarers/${id}/photo`, { responseType: 'blob' }).then((r) => r.data),
  uploadPhoto: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/seafarers/${id}/photo`, form)
  },
  removePhoto: (id) => api.delete(`/seafarers/${id}/photo`),
  downloadTemplate: () => api.get('/import/excel/template', { responseType: 'blob' }),
  importFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/excel', form)
  },
  listForms: () => api.get('/seafarers/forms'),
  exportForm: (id, formKey) =>
    api.get(`/seafarers/${id}/export-form/${formKey}`, { responseType: 'blob' }),
}

export const certificateApi = {
  list: (seafarerId) => api.get(`/seafarers/${seafarerId}/certificates`),
  create: (seafarerId, data) => api.post(`/seafarers/${seafarerId}/certificates`, data),
  update: (seafarerId, id, data) => api.put(`/seafarers/${seafarerId}/certificates/${id}`, data),
  remove: (seafarerId, id) => api.delete(`/seafarers/${seafarerId}/certificates/${id}`),
  upload: (seafarerId, id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/seafarers/${seafarerId}/certificates/${id}/upload`, form)
  },
}

export const lookupApi = {
  ranks: () => api.get('/lookup/ranks'),
  certificateTypes: () => api.get('/lookup/certificate-types'),
  countries: () => api.get('/lookup/countries'),
  vesselTypes: () => api.get('/lookup/vessel-types'),
  ports: () => api.get('/lookup/ports'),
  vessels: (search) => api.get('/lookup/vessels', search ? { params: { search } } : {}),
}
