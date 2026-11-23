// Người phụ trách (PIC): thuyền viên → hợp đồng → bill, chỉ kế thừa lúc tạo (docs/mcah-ke-hoach-nguoi-phu-trach.md).

// Người đầu tiên trong danh sách ứng viên còn tài khoản hoạt động; không ai thì null.
async function resolvePic(conn, candidates) {
  const ids = [...new Set(candidates.filter((id) => id != null).map(Number))]
  if (!ids.length) return null
  const [rows] = await conn.query('SELECT id FROM "user" WHERE id IN (?) AND is_active = 1 AND deleted_at IS NULL', [ids])
  const active = new Set(rows.map((row) => Number(row.id)))
  return ids.find((id) => active.has(id)) ?? null
}

// Người được giao phải là tài khoản đang hoạt động.
async function assertAssignable(conn, userId) {
  const [rows] = await conn.query('SELECT id FROM "user" WHERE id = ? AND is_active = 1 AND deleted_at IS NULL', [userId])
  if (!rows.length) throw { statusCode: 400, message: 'Tài khoản không tồn tại hoặc đã khoá' }
}

// Điều kiện phạm vi "chỉ của mình": mình tạo hoặc mình phụ trách. `alias` là hằng số trong code. Cần đẩy ownerId hai lần.
function ownSql(alias) {
  return `(${alias}.created_by = ? OR ${alias}.pic_user_id = ?)`
}

// Lọc danh sách theo người phụ trách: id hoặc 'none' (chưa giao). Giá trị lạ thì bỏ qua (không báo lỗi bộ lọc).
function picFilter(alias, value, params) {
  if (value === 'none') return ` AND ${alias}.pic_user_id IS NULL`
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return ''
  params.push(id)
  return ` AND ${alias}.pic_user_id = ?`
}

// Cột chọn tên người phụ trách; join bằng LEFT JOIN "user" <userAlias> ON <userAlias>.id = <alias>.pic_user_id.
function picColumns(userAlias) {
  return `${userAlias}.id AS pic_id, COALESCE(${userAlias}.full_name, ${userAlias}.email) AS pic_name, ${userAlias}.is_active AS pic_is_active`
}

function picOf(row) {
  if (row.pic_id == null) return null
  return { id: Number(row.pic_id), name: row.pic_name, is_active: Number(row.pic_is_active) === 1 }
}

module.exports = { resolvePic, assertAssignable, ownSql, picFilter, picColumns, picOf }
