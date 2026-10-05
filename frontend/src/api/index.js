import api from './client'
export { notificationApi } from './notificationApi'

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  registerSeafarer: (data) => api.post('/auth/register/seafarer', data),
  me: () => api.get('/auth/me'),
  requestVerify: () => api.post('/auth/verify/request'),
  confirmVerify: (data) => api.post('/auth/verify/confirm', data),
}

export const seafarerApi = {
  list: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    return api.get('/seafarers', { params: clean })
  },
  getById: (id) => api.get(`/seafarers/${id}`),
  create: (data) => api.post('/seafarers', data),
  update: (id, data) => api.put(`/seafarers/${id}`, data),
  remove: (id) => api.delete(`/seafarers/${id}`),
  getContacts: (id) => api.get(`/seafarers/${id}/contacts`),
  createContact: (id, data) => api.post(`/seafarers/${id}/contacts`, data),
  deleteContact: (id, contactId) => api.delete(`/seafarers/${id}/contacts/${contactId}`),
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

export const trainingCenterApi = {
  list: (params) => api.get('/training-centers', { params }),
  getById: (id) => api.get(`/training-centers/${id}`),
  create: (data) => api.post('/training-centers', data),
  update: (id, data) => api.put(`/training-centers/${id}`, data),
  remove: (id) => api.delete(`/training-centers/${id}`),
}

export const courseApi = {
  list: (params) => api.get('/training-courses', { params }),
  getById: (id) => api.get(`/training-courses/${id}`),
  create: (data) => api.post('/training-courses', data),
  update: (id, data) => api.put(`/training-courses/${id}`, data),
  remove: (id) => api.delete(`/training-courses/${id}`),
}

export const enrollmentApi = {
  list: (params) => api.get('/enrollments', { params }),
  getById: (id) => api.get(`/enrollments/${id}`),
  create: (data) => api.post('/enrollments', data),
  update: (id, data) => api.put(`/enrollments/${id}`, data),
  addScores: (id, data) => api.post(`/enrollments/${id}/scores`, data),
}

export const contractApi = {
  list: (seafarerId) => api.get('/employment-contracts', { params: { seafarer_id: seafarerId } }),
  getById: (id) => api.get(`/employment-contracts/${id}`),
  create: (data) => api.post('/employment-contracts', data),
  update: (id, data) => api.put(`/employment-contracts/${id}`, data),
  remove: (id) => api.delete(`/employment-contracts/${id}`),
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

export const seafarerPortalApi = {
  getProfile: () => api.get('/portal/seafarer/profile'),
  updateProfile: (data) => api.put('/portal/seafarer/profile', data),
  getCertificates: () => api.get('/portal/seafarer/certificates'),
  getContracts: () => api.get('/portal/seafarer/contracts'),
  getEnrollments: () => api.get('/portal/seafarer/enrollments'),
  enroll: (course_id) => api.post('/portal/seafarer/enrollments', { course_id }),
  cancelEnrollment: (id) => api.delete(`/portal/seafarer/enrollments/${id}`),
  createCertificate: (data, file) => {
    if (file) {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => {
        if (v != null && v !== '') form.append(k, v)
      })
      form.append('file', file)
      return api.post('/portal/seafarer/certificates', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }
    return api.post('/portal/seafarer/certificates', data)
  },
  deleteCertificate: (id) => api.delete(`/portal/seafarer/certificates/${id}`),
}

export const lookupApi = {
  ranks: () => api.get('/lookup/ranks'),
  certificateTypes: () => api.get('/lookup/certificate-types'),
  courseTypes: () => api.get('/lookup/course-types'),
  countries: () => api.get('/lookup/countries'),
  vesselTypes: () => api.get('/lookup/vessel-types'),
  vessels: (search) => api.get('/lookup/vessels', search ? { params: { search } } : {}),
}
