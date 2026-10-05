import api from './client'

export const notificationApi = {
  getUnreadCount: () => api.get('/notifications/unread-count').then((r) => r.data.count),
  getNotifications: (params = {}) => api.get('/notifications', { params }).then((r) => r.data.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data.count),
}
