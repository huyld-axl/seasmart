// Thư mục hồ sơ (docs/mcah-ke-hoach-desktop-gd4.md 3.2, wireframe màn 4, 5): danh sách tệp của thuyền viên theo cấu trúc
// dễ đọc, và tải từng tệp. Máy chính mở thẳng thư mục thật (folder); máy nhân viên / bản xuất dựng lại từ danh sách.
const path = require('path')
const pool = require('../../config/db')
const fileStore = require('../../utils/file_store')
const { filesOfSeafarer } = require('../../services/file_layout.service')
const { seafarerFolder } = require('../../utils/readable_tree')
const { assertSeafarerInScope } = require('../../utils/scope')

const MAX_BULK = 2000

async function filesRoutes(fastify) {
  const ids = (raw) => [...new Set(String(raw || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))]

  // ?seafarer_ids=1,2,3 (một người: quyền xem; nhiều người: quyền xuất hàng loạt) hoặc ?all=1 (xuất toàn bộ).
  fastify.get('/tree', { onRequest: [fastify.authenticate, fastify.can('seafarer.view')] }, async (request) => {
    let list = ids(request.query.seafarer_ids)
    const bulk = request.query.all === '1' || list.length > 1
    if (bulk && !request.access.permissions.has('seafarer.export_bulk')) throw { statusCode: 403, message: 'Cần quyền xuất hồ sơ hàng loạt' }
    if (request.query.all === '1') {
      const [rows] = await pool.query('SELECT id FROM seafarer WHERE deleted_at IS NULL ORDER BY id LIMIT ?', [MAX_BULK])
      list = rows.map((r) => r.id)
    }
    if (!list.length) throw { statusCode: 400, message: 'Chưa chọn thuyền viên' }
    const folders = []
    const files = []
    for (const id of list) {
      try {
        await assertSeafarerInScope(request, id)
      } catch {
        continue
      }
      const [[s]] = await pool.query('SELECT id, full_name, seafarer_code FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
      if (!s) continue
      const folder = seafarerFolder(s)
      // Máy chính, gọi từ chính máy này: đường dẫn thật để mở bằng File Explorer / Files.
      const real = fileStore.treeEnabled() && !request.lan ? path.join(fileStore.treeRoot(), ...folder.split('/')) : null
      folders.push({ seafarer_id: id, folder, real })
      for (const f of await filesOfSeafarer(pool, id)) files.push({ seafarer_id: id, path: f.path, ref: f.ref })
    }
    return { folders, files }
  })

  // Một tệp của thuyền viên (mã tệp phải thuộc người đó).
  fastify.get('/raw', { onRequest: [fastify.authenticate, fastify.can('seafarer.view')] }, async (request, reply) => {
    const id = Number(request.query.seafarer_id)
    await assertSeafarerInScope(request, id)
    const file = (await filesOfSeafarer(pool, id)).find((f) => f.ref === request.query.ref)
    if (!file) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
    reply.header('Content-Type', 'application/octet-stream')
    return reply.send(await fileStore.stream(file.ref))
  })
}

module.exports = filesRoutes
