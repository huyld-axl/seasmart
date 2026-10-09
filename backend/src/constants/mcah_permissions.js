const READ_ROLES = ['admin', 'operator', 'reviewer']
const WRITE_ROLES = ['admin', 'operator']
const APPROVE_ROLES = ['admin', 'reviewer']
function allowed(role, method, url) {
  const pathname = url.split('?')[0].replace(/\/$/, '')
  if (pathname.startsWith('/api/v1/users')) return role === 'admin'
  if (/\/(approve|reject)$/.test(pathname) && pathname.startsWith('/api/v1/exports/')) return APPROVE_ROLES.includes(role)
  if (['GET', 'HEAD'].includes(method)) return READ_ROLES.includes(role)
  if (/^\/api\/v1\/documents\/\d+\/fields\//.test(pathname) && method === 'PUT') return READ_ROLES.includes(role)
  return WRITE_ROLES.includes(role)
}
function assertApprover(user, creatorId) {
  if (!APPROVE_ROLES.includes(user?.role) || String(creatorId) === String(user?.id)) {
    throw { statusCode: 403, message: 'Chỉ admin/reviewer khác người tạo được duyệt hoặc trả lại' }
  }
}
module.exports = { READ_ROLES, WRITE_ROLES, APPROVE_ROLES, allowed, assertApprover }
