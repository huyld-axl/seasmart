// Sắp thư mục hồ sơ dễ đọc (docs/mcah-ke-hoach-desktop-gd4.md 3.2): mỗi tệp của một thuyền viên / đối tác phải nằm đúng
// chỗ readable_tree tính ra từ hồ sơ hiện tại. Hồ sơ đổi (tên, số giấy, hạn, có bản mới…) → enqueue; worker chạy
// relayout: chuyển tệp sai chỗ, giấy AI đọc chưa có tệp riêng thì cắt từ bản tải lên. Chỉ chạy khi có thư mục hồ sơ.
const path = require('path')
const pool = require('../config/db')
const fileStore = require('../utils/file_store')
const tree = require('../utils/readable_tree')

const extOf = (ref, fallback = '') => path.posix.extname(String(ref || '')) || fallback

// Đặt tệp vào đúng chỗ trong thư mục hồ sơ: đã ở thư mục hồ sơ thì chuyển; tệp cũ ở kho nội bộ (dữ liệu trước giai đoạn 4)
// thì chép vào thư mục hồ sơ rồi đưa bản cũ vào thùng rác. → mã tệp mới (hoặc mã cũ nếu không đổi / không còn tệp).
async function place(db, ref, rel) {
  if (!ref) return ref
  if (fileStore.isTree(ref)) return fileStore.move(ref, rel, db)
  if (!(await fileStore.exists(ref, db))) return ref
  const next = await fileStore.put(await fileStore.read(ref, db), { tree: rel }, db)
  await require('../utils/file_trash').trashFiles(ref, 'Chuyển vào thư mục hồ sơ', db)
  return next
}

async function enqueue(db, ownerType, ownerId) {
  if (!fileStore.treeEnabled() || !ownerId) return
  await db.query('INSERT INTO file_relayout (owner_type, owner_id) VALUES (?, ?) ON CONFLICT (owner_type, owner_id) DO UPDATE SET queued_at = NOW()', [ownerType, ownerId])
}

// Bản cũ: cùng loại giấy, không phải bản mới nhất (ngày cấp, rồi hạn, rồi id lớn nhất là bản hiện hành).
function markSuperseded(certs) {
  const latest = new Map()
  const score = (c) => [c.issued_date ? new Date(c.issued_date).getTime() : 0, c.expiry_date ? new Date(c.expiry_date).getTime() : 0, c.id]
  const newer = (a, b) => { const x = score(a); const y = score(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }
  for (const c of certs) {
    if (!c.certificate_type_id) continue
    const cur = latest.get(c.certificate_type_id)
    if (!cur || newer(c, cur)) latest.set(c.certificate_type_id, c)
  }
  return certs.map((c) => ({ ...c, superseded: Boolean(c.certificate_type_id && latest.get(c.certificate_type_id) !== c) }))
}

// Cắt tệp riêng cho một giấy AI đọc: bản tải lên là PDF thì lấy đúng các trang; là ảnh thì ghép ảnh trang thành PDF
// (một trang ảnh thì giữ ảnh). → { buffer, ext } hoặc null
async function cutDocument(db, documentId) {
  const { PDFDocument } = require('pdf-lib')
  const [[doc]] = await db.query('SELECT d.page_from, d.page_to, d.upload_id, u.storage_path, u.mime_type FROM seafarer_document d LEFT JOIN document_upload u ON u.id = d.upload_id WHERE d.id = ?', [documentId])
  if (!doc?.upload_id) return null
  const from = doc.page_from || 1
  const to = doc.page_to || from
  if (doc.mime_type === 'application/pdf' && (await fileStore.exists(doc.storage_path, db))) {
    const src = await PDFDocument.load(await fileStore.read(doc.storage_path, db), { ignoreEncryption: true })
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i).filter((i) => i < src.getPageCount()))
    pages.forEach((p) => out.addPage(p))
    return { buffer: Buffer.from(await out.save()), ext: '.pdf' }
  }
  const [pages] = await db.query('SELECT image_path FROM document_upload_page WHERE upload_id = ? AND page_no BETWEEN ? AND ? ORDER BY page_no', [doc.upload_id, from, to])
  const images = []
  for (const p of pages) if (await fileStore.exists(p.image_path, db)) images.push(await fileStore.read(p.image_path, db))
  if (!images.length) return null
  if (images.length === 1) return { buffer: images[0], ext: '.jpg' }
  const out = await PDFDocument.create()
  for (const img of images) {
    const jpg = await out.embedJpg(img)
    out.addPage([jpg.width, jpg.height]).drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
  }
  return { buffer: Buffer.from(await out.save()), ext: '.pdf' }
}

async function relayoutSeafarer(db, id) {
  const [[s]] = await db.query('SELECT id, full_name, seafarer_code, photo_path, deleted_at FROM seafarer WHERE id = ?', [id])
  if (!s) return
  const [rows] = await db.query(
    `SELECT sc.id, sc.certificate_type_id, sc.certificate_number, sc.issued_date, sc.expiry_date, sc.document_url, sc.tree_file,
            sc.source_document_id, sc.certificate_name_raw, ct.name_vi AS type_name, ct.category
     FROM seafarer_certificate sc LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL`, [id])
  for (const c of markSuperseded(rows)) {
    const info = { ...c, type_name: c.type_name || c.certificate_name_raw }
    // Chứng chỉ nạp tay: tệp nằm ở document_url.
    if (c.document_url) {
      const current = require('../utils/file_trash').certificateFilePath(id, c.document_url)
      const ref = await place(db, current, tree.certificatePath(s, info, extOf(fileStore.abs(current))))
      if (ref !== c.document_url) await db.query('UPDATE seafarer_certificate SET document_url = ? WHERE id = ?', [ref, c.id])
    }
    // Giấy AI đọc: tệp riêng cắt từ bản tải lên.
    if (c.source_document_id && !c.document_url) {
      if (!c.tree_file) {
        const cut = await cutDocument(db, c.source_document_id).catch(() => null)
        if (cut) {
          const ref = await fileStore.put(cut.buffer, { tree: tree.certificatePath(s, info, cut.ext) }, db)
          await db.query('UPDATE seafarer_certificate SET tree_file = ? WHERE id = ?', [ref, c.id])
        }
      } else {
        const ref = await fileStore.move(c.tree_file, tree.certificatePath(s, info, extOf(c.tree_file, '.pdf')), db)
        if (ref !== c.tree_file) await db.query('UPDATE seafarer_certificate SET tree_file = ? WHERE id = ?', [ref, c.id])
      }
    }
  }
  if (s.photo_path && !s.deleted_at) {
    const ref = await place(db, s.photo_path, tree.photoPath(s, extOf(fileStore.abs(s.photo_path), '.jpg')))
    if (ref !== s.photo_path) await db.query('UPDATE seafarer SET photo_path = ? WHERE id = ?', [ref, id])
  }
  const [sends] = await db.query(
    `SELECT c.id, c.storage_path, s.sent_at, so.company_name AS partner_name
     FROM opportunity_send_copy c JOIN opportunity_send s ON s.id = c.send_id
     LEFT JOIN opportunity o ON o.id = s.opportunity_id LEFT JOIN ship_owner so ON so.id = o.ship_owner_id
     WHERE c.seafarer_id = ?`, [id])
  for (const row of sends) {
    if (!row.storage_path) continue
    const ref = await place(db, row.storage_path, tree.sentPath(s, row))
    if (ref !== row.storage_path) await db.query('UPDATE opportunity_send_copy SET storage_path = ? WHERE id = ?', [ref, row.id])
  }
}

async function relayoutPartner(db, id) {
  const [[o]] = await db.query('SELECT id, company_name, logo_path FROM ship_owner WHERE id = ?', [id])
  if (!o?.logo_path) return
  const ref = await place(db, o.logo_path, tree.logoPath(o, extOf(fileStore.abs(o.logo_path), '.png')))
  if (ref !== o.logo_path) await db.query('UPDATE ship_owner SET logo_path = ? WHERE id = ?', [ref, id])
}

// Lần đầu bật thư mục hồ sơ (máy có dữ liệu từ trước): xếp lại mọi thuyền viên và đối tác.
async function enqueueAll(db = pool) {
  if (!fileStore.treeEnabled()) return
  await db.query('INSERT INTO file_relayout (owner_type, owner_id) SELECT \'seafarer\', id FROM seafarer WHERE deleted_at IS NULL ON CONFLICT DO NOTHING')
  await db.query('INSERT INTO file_relayout (owner_type, owner_id) SELECT \'partner\', id FROM ship_owner WHERE deleted_at IS NULL ON CONFLICT DO NOTHING')
}

// Worker: lấy từng chủ trong hàng đợi, sắp lại. Lỗi một chủ thì để lại hàng đợi, lần sau thử tiếp.
async function processQueue(logger, db = pool) {
  if (!fileStore.treeEnabled()) return 0
  const [rows] = await db.query('SELECT owner_type, owner_id, queued_at FROM file_relayout ORDER BY queued_at LIMIT 50')
  for (const row of rows) {
    try {
      if (row.owner_type === 'seafarer') await relayoutSeafarer(db, row.owner_id)
      else if (row.owner_type === 'partner') await relayoutPartner(db, row.owner_id)
      await db.query('DELETE FROM file_relayout WHERE owner_type = ? AND owner_id = ? AND queued_at = ?', [row.owner_type, row.owner_id, row.queued_at])
    } catch (err) {
      logger?.warn?.({ err: err.message, owner: row.owner_type }, 'Chưa sắp được thư mục hồ sơ, thử lại sau')
    }
  }
  return rows.length
}

// Tệp của một thuyền viên theo cấu trúc thư mục hồ sơ (mở thư mục trên máy nhân viên, xuất ra thư mục):
// [{ path: đường tương đối dễ đọc, ref: mã tệp }]. Chỉ tệp còn trên đĩa; tệp đã xoá mềm không có.
async function filesOfSeafarer(db, id) {
  const [[s]] = await db.query('SELECT id, full_name, seafarer_code, photo_path FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
  if (!s) return []
  const out = []
  const add = async (ref, rel) => { if (ref && (await fileStore.exists(ref, db))) out.push({ path: rel, ref }) }
  const [rows] = await db.query(
    `SELECT sc.id, sc.certificate_type_id, sc.certificate_number, sc.issued_date, sc.expiry_date, sc.document_url, sc.tree_file,
            sc.certificate_name_raw, ct.name_vi AS type_name, ct.category
     FROM seafarer_certificate sc LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL`, [id])
  const { certificateFilePath } = require('../utils/file_trash')
  for (const c of markSuperseded(rows)) {
    const ref = c.document_url ? certificateFilePath(id, c.document_url) : c.tree_file
    if (ref) await add(ref, tree.certificatePath(s, { ...c, type_name: c.type_name || c.certificate_name_raw }, extOf(fileStore.abs(ref), '.pdf')))
  }
  if (s.photo_path) await add(s.photo_path, tree.photoPath(s, extOf(fileStore.abs(s.photo_path), '.jpg')))
  const [sends] = await db.query(
    `SELECT c.storage_path, s.sent_at, so.company_name AS partner_name FROM opportunity_send_copy c JOIN opportunity_send s ON s.id = c.send_id
     LEFT JOIN opportunity o ON o.id = s.opportunity_id LEFT JOIN ship_owner so ON so.id = o.ship_owner_id WHERE c.seafarer_id = ?`, [id])
  for (const row of sends) await add(row.storage_path, tree.sentPath(s, row))
  // Trùng tên (hai giấy cùng loại, cùng số): thêm " (2)".
  const taken = new Set()
  return out.map((f) => ({ ...f, path: tree.unique(f.path, taken) }))
}

module.exports = { filesOfSeafarer, enqueueAll, enqueue, processQueue, relayoutSeafarer, relayoutPartner, markSuperseded, cutDocument }
