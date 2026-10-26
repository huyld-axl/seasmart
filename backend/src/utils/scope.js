const pool = require('../config/db')
const { scopeOf, assertInScope } = require('../plugins/access')

// Bảng có cột created_by theo từng mục có phạm vi (tên bảng là hằng số, không lấy từ input).
const SCOPED_TABLES = {
  seafarer: 'seafarer',
  export: 'export_pack',
  opportunity: 'opportunity',
  voyage: 'seafarer_voyage',
  contract: 'seafarer_contract',
  bill: 'contract_bill',
}

// id tài khoản khi phạm vi là 'own', ngược lại null. Dùng để truyền xuống service lọc danh sách.
function ownerIdFor(request, module) {
  return scopeOf(request, module) === 'own' ? request.access.userId : null
}

// Bản ghi một bảng có phạm vi: ngoài phạm vi (hoặc không tồn tại khi phạm vi own) thì 404.
async function assertRecordInScope(request, module, id, message, db = pool) {
  if (scopeOf(request, module) !== 'own') return
  const table = SCOPED_TABLES[module]
  const [rows] = await db.query(`SELECT created_by FROM "${table}" WHERE id = ? AND deleted_at IS NULL`, [id])
  assertInScope(request, module, rows[0], message)
}

// Dữ liệu con của thuyền viên (giấy tờ, chứng chỉ, lịch sử đi tàu, người thân, ảnh) theo phạm vi thuyền viên cha.
function assertSeafarerInScope(request, seafarerId, db = pool) {
  return assertRecordInScope(request, 'seafarer', seafarerId, 'Không tìm thấy thuyền viên', db)
}

// Dữ liệu con tra qua id của chính nó: bảng con là hằng số trong code.
const CHILD_TABLES = {
  upload: 'document_upload',
  document: 'seafarer_document',
  sea_service: 'sea_service',
}

async function assertChildInScope(request, kind, id, db = pool) {
  if (scopeOf(request, 'seafarer') !== 'own') return
  const [rows] = await db.query(`SELECT seafarer_id FROM "${CHILD_TABLES[kind]}" WHERE id = ? AND deleted_at IS NULL`, [id])
  if (!rows[0]) throw { statusCode: 404, message: 'Không tìm thấy' }
  await assertSeafarerInScope(request, rows[0].seafarer_id, db)
}

async function assertDocumentsInScope(request, ids, db = pool) {
  if (scopeOf(request, 'seafarer') !== 'own') return
  const [rows] = await db.query('SELECT DISTINCT seafarer_id FROM "seafarer_document" WHERE id IN (?) AND deleted_at IS NULL', [ids])
  for (const row of rows) await assertSeafarerInScope(request, row.seafarer_id, db)
}

module.exports = { ownerIdFor, assertRecordInScope, assertSeafarerInScope, assertChildInScope, assertDocumentsInScope }
