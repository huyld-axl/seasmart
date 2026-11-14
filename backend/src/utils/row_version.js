// Chống ghi đè (docs/mcah-ke-hoach-desktop-gd3.md 3.4). Gọi sau khi đã SELECT ... FOR UPDATE bản ghi: form gửi lại
// `version` đã đọc lúc mở; khác số hiện tại nghĩa là người khác đã lưu sau đó → 409 kèm ai sửa, lúc nào.
// Không gửi `version` (màn cũ, sửa nhanh một ô) thì vẫn cho lưu như trước.
async function assertVersion(db, before, expected) {
  if (expected === undefined || expected === null || expected === '') return
  if (Number(before.version) === Number(expected)) return
  let changedBy = null
  if (before.updated_by) {
    const [[user]] = await db.query('SELECT email FROM "user" WHERE id = ?', [before.updated_by])
    changedBy = user?.email || null
  }
  // Cột updated_at kiểu TIMESTAMP không múi giờ, phiên DB ở UTC nhưng pg đọc ra theo giờ máy: đổi về đúng mốc UTC.
  const at = before.updated_at instanceof Date ? new Date(before.updated_at.getTime() - before.updated_at.getTimezoneOffset() * 60000) : before.updated_at || null
  throw {
    statusCode: 409,
    code: 'CONFLICT',
    message: 'Bản ghi vừa được người khác sửa',
    conflict: { changed_by: changedBy, changed_at: at, version: before.version },
  }
}

// Tách `version` khỏi thân yêu cầu để phần còn lại đi qua pickAllowed như cũ.
function takeVersion(body) {
  const { version, ...rest } = body || {}
  return { version, data: rest }
}

// Câu UPDATE không khoá dòng trước (danh mục, chứng chỉ, tài khoản): thêm điều kiện version vào WHERE; không đổi dòng
// nào thì đọc lại để báo 409 đúng người sửa (hoặc để nơi gọi báo 404 nếu dòng không còn).
const versionWhere = (expected) => (expected === undefined || expected === null || expected === '' ? { sql: '', params: [] } : { sql: ' AND version = ?', params: [Number(expected)] })

async function failIfStale(db, table, id, expected, affectedRows) {
  if (affectedRows || expected === undefined || expected === null || expected === '') return
  const [[row]] = await db.query(`SELECT * FROM "${table}" WHERE id = ?`, [id])
  if (row) await assertVersion(db, row, expected)
}

module.exports = { assertVersion, takeVersion, versionWhere, failIfStale }
