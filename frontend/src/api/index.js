import api from './client'
// export { notificationApi } from './notificationApi'

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  requestVerify: () => api.post('/auth/verify/request'),
  confirmVerify: (data) => api.post('/auth/verify/confirm', data),
}

export const seafarerPortalApi = {
  getProfile: () => api.get('/portal/seafarer/profile'),
  updateProfile: (values) => api.put('/portal/seafarer/profile', values),

  getCertificates: () => api.get('/portal/seafarer/certificates'),
  createCertificate: (payload, file) => {
    // Backend expects multipart where file part fieldname is "file"
    const form = new FormData()
    if (payload?.certificate_type_id != null)
      form.append('certificate_type_id', String(payload.certificate_type_id))
    if (payload?.certificate_number != null)
      form.append('certificate_number', String(payload.certificate_number))
    if (payload?.issued_date != null) form.append('issued_date', String(payload.issued_date))
    if (payload?.expiry_date != null) form.append('expiry_date', String(payload.expiry_date))
    if (file) form.append('file', file)
    return api.post('/portal/seafarer/certificates', form)
  },
  deleteCertificate: (id) => api.delete(`/portal/seafarer/certificates/${id}`),
  removeCertificateFile: (id) => api.delete(`/portal/seafarer/certificates/${id}/file`),
  getContracts: () => api.get('/portal/seafarer/contracts'),
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
  updateContact: (id, contactId, data) => api.put(`/seafarers/${id}/contacts/${contactId}`, data),
  deleteContact: (id, contactId) => api.delete(`/seafarers/${id}/contacts/${contactId}`),
  getEducations: (id) => api.get(`/seafarers/${id}/educations`),
  updateEducations: (id, data) => api.put(`/seafarers/${id}/educations`, data),
  uploadAvatar: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/seafarers/${id}/avatar`, form)
  },
  downloadTemplate: () => api.get('/import/excel/template', { responseType: 'blob' }),
  importFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/excel', form, { timeout: 120000 })
  },
  listForms: () => api.get('/seafarers/forms'),
  exportForm: (id, formKey) =>
    api.get(`/seafarers/${id}/export-form/${formKey}`, { responseType: 'blob' }),
  exportCV: (id) => api.get(`/seafarers/${id}/export-cv`, { responseType: 'blob' }),
  exportCVEng: (id) => api.get(`/seafarers/${id}/export-cv-eng`, { responseType: 'blob' }),
  getDispatchDecisionSelection: (ids) =>
    api.post('/seafarers/dispatch-decision-selection', { ids }),
  exportDispatchDecision: (payload) =>
    api.post('/seafarers/export-dispatch-decision', payload, { responseType: 'blob' }),
  stats: () => api.get('/seafarers/stats'),
  certsExpiring: (days = 90) => api.get('/seafarers/certs-expiring', { params: { days } }),
}

export const seafarerCallApi = {
  list: (seafarerId, params) => api.get(`/seafarers/${seafarerId}/calls`, { params }),
  create: (seafarerId, data) => api.post(`/seafarers/${seafarerId}/calls`, data),
  remove: (seafarerId, id) => api.delete(`/seafarers/${seafarerId}/calls/${id}`),
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
  extract: (seafarerId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/seafarers/${seafarerId}/certificates/extract`, form, { timeout: 60000 })
  },
  removeFile: (seafarerId, id) => api.delete(`/seafarers/${seafarerId}/certificates/${id}/file`),
}

export const seamanBookApi = {
  list: (seafarerId) => api.get(`/seafarers/${seafarerId}/seaman-books`),
  create: (seafarerId, data) => api.post(`/seafarers/${seafarerId}/seaman-books`, data),
  update: (seafarerId, id, data) => api.put(`/seafarers/${seafarerId}/seaman-books/${id}`, data),
  remove: (seafarerId, id) => api.delete(`/seafarers/${seafarerId}/seaman-books/${id}`),
}

export const deploymentApi = {
  list: (seafarerId) => api.get(`/seafarers/${seafarerId}/deployments`),
  listAll: (params) => api.get('/deployments', { params }),
  getById: (id) => api.get(`/deployments/${id}`),
  create: (seafarerId, data) => api.post(`/seafarers/${seafarerId}/deployments`, data),
  update: (id, data) => api.put(`/deployments/${id}`, data),
  changeStatus: (id, status, options) => api.put(`/deployments/${id}/status`, { status, options }),
  remove: (id) => api.delete(`/deployments/${id}`),
  bulkRemove: (ids) => api.delete('/deployments/bulk', { data: { ids } }),
  getChecklist: (id) => api.get(`/deployments/${id}/checklist`),
  updateChecklistItem: (id, key, is_checked, notes) =>
    api.put(`/deployments/${id}/checklist/${key}`, { is_checked, notes }),
  uploadChecklistAttachment: (id, key, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/deployments/${id}/checklist/${key}/attachment`, form)
  },
  deleteChecklistAttachment: (id, key) =>
    api.delete(`/deployments/${id}/checklist/${key}/attachment`),
  getDocumentUrl: (id, type) => `/api/v1/deployments/${id}/documents/${type}`,
  stats: () => api.get('/deployments/stats'),
}

export const formTemplateApi = {
  list: () => api.get('/forms'),
  upload: (formKey, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.put(`/forms/${formKey}/template`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const vesselApi = {
  list: (params) => api.get('/vessels', { params }),
  getById: (id) => api.get(`/vessels/${id}`),
  fetchExternalByImo: (imo, refresh = false) =>
    api.get(`/vessels/external/${imo}`, { params: refresh ? { refresh: 1 } : {} }),
  vesselTypes: () => api.get('/vessels/types'),
  create: (data) => api.post('/vessels', data),
  update: (id, data) => api.put(`/vessels/${id}`, data),
  remove: (id) => api.delete(`/vessels/${id}`),
  nameSearch: (q) => api.get('/vessels/name-search', { params: { q } }),
  getShipDbStatus: () => api.get('/vessels/ship-db/status'),
  uploadShipDb: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/vessels/ship-db/upload', form)
  },
  seedShipCatalog: () => api.post('/vessels/ship-db/seed', {}, { timeout: 300000 }),
}

export const partnerApi = {
  list: (params) => api.get('/partners', { params }),
  getById: (id) => api.get(`/partners/${id}`),
  create: (data) => api.post('/partners', data),
  update: (id, data) => api.put(`/partners/${id}`, data),
  remove: (id) => api.delete(`/partners/${id}`),
}

export const shipOwnerApi = partnerApi

export const jobApi = {
  list: (params) => api.get('/jobs', { params }),
  getById: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  updatePayment: (id, data) => api.put(`/jobs/${id}/payment`, data),
  listPayments: (id) => api.get(`/jobs/${id}/payments`),
  createPayment: (id, data) => api.post(`/jobs/${id}/payments`, data),
  updatePaymentRecord: (id, paymentId, data) => api.put(`/jobs/${id}/payments/${paymentId}`, data),
  assign: (id, data) => api.post(`/jobs/${id}/assign`, data),
  remove: (id) => api.delete(`/jobs/${id}`),
  stats: () => api.get('/jobs/stats'),
}

export const salaryApi = {
  // Per-deployment
  listByDeployment: (deploymentId) => api.get(`/salary/deployment/${deploymentId}`),
  bulkGenerate: (month) => api.post('/salary/bulk-generate', { month }),
  bulkMarkPaid: (month) => api.put('/salary/bulk-mark-paid', { month }),
  update: (id, data) => api.put(`/salary/${id}`, data),
  remove: (id) => api.delete(`/salary/${id}`),
  // List & stats
  list: (params) => api.get('/salary', { params }),
  stats: (month) => api.get('/salary/stats', { params: month ? { month } : {} }),
  unpaidBySeafarer: (seafarerId) =>
    api.get('/salary/unpaid-by-seafarer', { params: { seafarer_id: seafarerId } }),
  // Finance overview
  financeOverview: (from, to) =>
    api.get('/salary/finance/overview', { params: { from, to: to || from } }),
  monthFull: (month, partnerId) =>
    api.get('/salary/month-full', {
      params: { month, ...(partnerId ? { partner_id: partnerId } : {}) },
    }),
  exportRevenue: (from, to) =>
    api.get('/salary/export-revenue', { params: { from, to }, responseType: 'blob' }),
  // Exchange rates
  listExchangeRates: (month) =>
    api.get('/salary/exchange-rates', { params: month ? { month } : {} }),
  upsertExchangeRate: (data) => api.post('/salary/exchange-rates', data),
  upsertRevenueExchangeRate: (data) => api.post('/salary/revenue-exchange-rate', data),
  // Deductions
  listDeductions: (salaryId) => api.get(`/salary/${salaryId}/deductions`),
  addDeduction: (salaryId, data) => api.post(`/salary/${salaryId}/deductions`, data),
  updateDeduction: (id, data) => api.put(`/salary/deductions/${id}`, data),
  removeDeduction: (id) => api.delete(`/salary/deductions/${id}`),
  // Other costs
  listOtherCosts: (salaryId) => api.get(`/salary/${salaryId}/other-costs`),
  addOtherCost: (salaryId, data) => api.post(`/salary/${salaryId}/other-costs`, data),
  updateOtherCost: (id, data) => api.put(`/salary/other-costs/${id}`, data),
  removeOtherCost: (id) => api.delete(`/salary/other-costs/${id}`),
}

export const revenueApi = {
  list: (month, partnerId) =>
    api.get('/revenue', { params: { month, ...(partnerId ? { partner_id: partnerId } : {}) } }),
  update: (id, data) => api.put(`/revenue/${id}`, data),
  upsertExchangeRate: (data) => api.post('/revenue/exchange-rate', data),
  bulkMarkPaid: (month) => api.put('/revenue/bulk-mark-paid', { month }),
}

export const lookupApi = {
  ranks: () => api.get('/lookup/ranks'),
  certificateTypes: () => api.get('/lookup/certificate-types'),
  countries: () => api.get('/lookup/countries'),
  vessels: (search) => api.get('/lookup/vessels', search ? { params: { search } } : {}),
  partners: (search) => api.get('/lookup/partners', search ? { params: { search } } : {}),
  shipOwners: (search) => api.get('/lookup/partners', search ? { params: { search } } : {}),
}
