// Log đổi người phụ trách → { before, after } cho AuditTimeline (payload JSONB có thể về dạng chuỗi).
export function assignChange(entry) {
  if (entry.action !== 'ASSIGN' || !entry.payload) return {}
  const data = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload
  return { before: data.from?.name ?? 'Chưa giao', after: data.to?.name ?? '—' }
}
