const pool = require('../config/db')
const { ADMIN_ROLE_CODE, ALL_PERMISSIONS } = require('../constants/permissions')

// Một câu SQL: trạng thái tài khoản, vai trò, phạm vi và mảng quyền.
const ACCESS_SQL = `SELECT u.email, u.is_active, u.deleted_at, u.role_id,
        r.code AS role_code, r.name AS role_name, r.scopes AS role_scopes,
        COALESCE(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions
 FROM "user" u
 LEFT JOIN "role" r ON r.id = u.role_id
 LEFT JOIN role_permission rp ON rp.role_id = r.id
 WHERE u.id = ?
 GROUP BY u.id, r.id`

// Trả null khi tài khoản không tồn tại, đã khoá hoặc đã xoá mềm.
async function loadAccess(userId, db = pool) {
  const [rows] = await db.query(ACCESS_SQL, [userId])
  const row = rows[0]
  if (!row || row.deleted_at || !row.is_active) return null
  const isAdmin = row.role_code === ADMIN_ROLE_CODE
  return {
    userId,
    email: row.email,
    roleId: row.role_id ?? null,
    roleCode: row.role_code ?? null,
    roleName: row.role_name ?? null,
    isAdmin,
    isSystemRole: row.role_code != null,
    permissions: new Set(isAdmin ? ALL_PERMISSIONS : row.permissions || []),
    scopes: isAdmin ? {} : row.role_scopes || {},
  }
}

// Hook onRequest dùng sau authenticate: thiếu bất kỳ quyền nào thì 403.
function can(...perms) {
  return async function requirePermission(request, reply) {
    const have = request.access?.permissions
    if (!have || !perms.every((perm) => have.has(perm))) {
      return reply.code(403).send({ error: 'Không có quyền' })
    }
  }
}

// 'all' | 'own'. Quản trị viên luôn 'all'.
function scopeOf(request, module) {
  if (request.access?.isAdmin) return 'all'
  return request.access?.scopes?.[module] === 'own' ? 'own' : 'all'
}

// `column` là hằng số trong code, không bao giờ lấy từ input.
function ownFilter(request, module, column) {
  if (scopeOf(request, module) !== 'own') return { sql: '', params: [] }
  return { sql: ` AND ${column} = ?`, params: [request.access.userId] }
}

// Dùng sau khi đọc một bản ghi theo id; ngoài phạm vi thì 404 (không lộ là có tồn tại).
function assertInScope(request, module, row, message = 'Không tìm thấy') {
  if (scopeOf(request, module) !== 'own') return
  if (!row || row.created_by == null || Number(row.created_by) !== Number(request.access.userId)) {
    throw { statusCode: 404, message }
  }
}

// Dạng trả cho frontend ở /auth/login và /auth/me.
function toClientUser(access) {
  return {
    id: access.userId,
    email: access.email,
    is_active: true,
    role: access.roleId == null ? null : { id: access.roleId, name: access.roleName, is_system: access.isSystemRole },
    permissions: [...access.permissions],
    scopes: access.scopes,
  }
}

module.exports = { toClientUser, loadAccess, can, scopeOf, ownFilter, assertInScope }
