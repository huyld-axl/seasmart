import api from './client'

// Báo cáo tháng (docs/catoro-ke-hoach-bao-cao.md). key: sales | cost | cashflow | base; xuất thêm 'all' (cả 4 báo cáo).
export const reportApi = {
  get: (key, month) => api.get(`/reports/${key}`, { params: { month } }).then((r) => r.data),
  export: (key, month) => api.get(`/reports/${key}/export`, { params: { month }, responseType: 'blob', timeout: 180000 }),
}
