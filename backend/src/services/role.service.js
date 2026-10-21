const { withTransaction } = require('../utils/transaction')
const {
  ALL_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  normalizePermissions,
  normalizeScopes,
} = require('../constants/permissions')

const NOT_FOUND = { statusCode: 404, message: 'Không tìm thấy vai trò' }
const SYSTEM_ROLE = { statusCode: 400, message: 'Không sửa được vai trò Quản trị viên' }

const cleanName = (value) => String(value ?? '').trim()
const cleanDescription = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function shapeRole(row, permissionsByRole) {
  const isSystem = row.code != null
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_system: isSystem,
    user_count: Number(row.user_count) || 0,
    permissions: row.code === 'admin' ? [...ALL_PERMISSIONS] : permissionsByRole.get(row.id) || [],
    scopes: row.code === 'admin' ? {} : row.scopes || {},
    created_at: row.created_at,
  }
}

const roleService = {
  // Quản trị viên đầu tiên, rồi theo thời điểm tạo.
  async list(db) {
    const [rows] = await db.query(
      `SELECT r.id, r.code, r.name, r.description, r.scopes, r.created_at,
              (SELECT COUNT(*) FROM "user" u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS user_count
       FROM "role" r
       ORDER BY (r.code IS NULL), r.created_at, r.id`
    )
    const [perms] = await db.query('SELECT role_id, permission FROM role_permission')
    const byRole = new Map()
    for (const { role_id, permission } of perms) {
      if (!byRole.has(role_id)) byRole.set(role_id, [])
      byRole.get(role_id).push(permission)
    }
    for (const [id, list] of byRole) byRole.set(id, normalizePermissions(list))
    return rows.map((row) => shapeRole(row, byRole))
  },

  async getById(db, id) {
    const role = (await this.list(db)).find((r) => r.id === Number(id))
    if (!role) throw NOT_FOUND
    return role
  },

  async assertNameFree(db, name, exceptId = null) {
    const [rows] = await db.query('SELECT id FROM "role" WHERE lower(name) = lower(?) AND id <> ?', [
      name,
      exceptId ?? 0,
    ])
    if (rows.length) throw { statusCode: 409, message: 'Đã có vai trò tên này' }
  },

  async create(db, { name, description, copy_from_role_id }, userId) {
    const roleName = cleanName(name)
    if (!roleName) throw { statusCode: 400, message: 'Nhập tên vai trò' }
    await this.assertNameFree(db, roleName)

    let permissions = []
    let scopes = {}
    if (copy_from_role_id != null) {
      const source = await this.getById(db, copy_from_role_id)
      permissions = source.is_system ? [...GRANTABLE_PERMISSIONS] : source.permissions
      scopes = source.is_system ? {} : source.scopes
    }

    const id = await withTransaction(db, async (conn) => {
      const [result] = await conn.query('INSERT INTO "role" SET ?', [
        {
          name: roleName,
          description: cleanDescription(description),
          scopes: JSON.stringify(normalizeScopes(scopes)),
          created_by: userId ?? null,
        },
      ])
      const roleId = result.insertId
      const list = normalizePermissions(permissions)
      if (list.length) {
        await conn.query('INSERT INTO role_permission (role_id, permission) VALUES ?', [
          list.map((permission) => [roleId, permission]),
        ])
      }
      return roleId
    }).catch((error) => {
      if (error.code === '23505') throw { statusCode: 409, message: 'Đã có vai trò tên này' }
      throw error
    })
    return this.getById(db, id)
  },

  async update(db, id, { name, description }) {
    const role = await this.getById(db, id)
    if (role.is_system) throw SYSTEM_ROLE
    const roleName = cleanName(name)
    if (!roleName) throw { statusCode: 400, message: 'Nhập tên vai trò' }
    await this.assertNameFree(db, roleName, role.id)
    try {
      await db.query('UPDATE "role" SET name = ?, description = ? WHERE id = ?', [
        roleName,
        cleanDescription(description),
        role.id,
      ])
    } catch (error) {
      if (error.code === '23505') throw { statusCode: 409, message: 'Đã có vai trò tên này' }
      throw error
    }
    return this.getById(db, role.id)
  },

  // Lưu cả lô trong một transaction. Quyền được chuẩn hoá (tự thêm view, bỏ mã adminOnly) ở đây.
  async savePermissions(db, roles) {
    const ids = roles.map((r) => Number(r.id))
    if (new Set(ids).size !== ids.length) throw { statusCode: 400, message: 'Vai trò bị lặp trong danh sách' }
    const current = await this.list(db)
    for (const id of ids) {
      const role = current.find((r) => r.id === id)
      if (!role) throw NOT_FOUND
      if (role.is_system) throw SYSTEM_ROLE
    }
    await withTransaction(db, async (conn) => {
      for (const item of roles) {
        const roleId = Number(item.id)
        const permissions = normalizePermissions(item.permissions)
        await conn.query('DELETE FROM role_permission WHERE role_id = ?', [roleId])
        if (permissions.length) {
          await conn.query('INSERT INTO role_permission (role_id, permission) VALUES ?', [
            permissions.map((permission) => [roleId, permission]),
          ])
        }
        await conn.query('UPDATE "role" SET scopes = ? WHERE id = ?', [
          JSON.stringify(normalizeScopes(item.scopes)),
          roleId,
        ])
      }
    })
    return this.list(db)
  },

  async remove(db, id) {
    const role = await this.getById(db, id)
    if (role.is_system) throw { statusCode: 400, message: 'Không xoá được vai trò Quản trị viên' }
    if (role.user_count > 0) {
      throw { statusCode: 409, message: `Còn ${role.user_count} tài khoản đang dùng vai trò này` }
    }
    await withTransaction(db, async (conn) => {
      // Chỉ còn tài khoản đã xoá mềm: gỡ vai trò để khoá ngoại không chặn.
      await conn.query('UPDATE "user" SET role_id = NULL WHERE role_id = ?', [role.id])
      await conn.query('DELETE FROM "role" WHERE id = ?', [role.id])
    })
    return { success: true }
  },
}

module.exports = { roleService }
