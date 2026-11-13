// Kho tệp dùng chung (docs/mcah-ke-hoach-desktop-gd4.md 3.1, 3.2). Mọi đọc / ghi / chuyển / xoá tệp của backend đi qua
// đây; không service nào gọi fs thẳng vào UPLOAD_DIR hay thư mục hồ sơ (test file_store_guard chặn).
//   App máy tính có MCAH_FILES_DIR: giấy tờ, chân dung, logo, hồ sơ đã gửi nằm trong thư mục hồ sơ dễ đọc (mã "hs:").
//   Bản web: mọi tệp trong UPLOAD_DIR tên ngẫu nhiên (mã "u:"), như trước.
// Quy tắc: ghi tệp xong mới ghi dòng DB; không sửa tệp tại chỗ; xoá chỉ qua trash (thùng rác 180 ngày, ngoài thư mục hồ sơ).
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const pool = require('../config/db')
const config = require('../config')
const { unique, README } = require('./readable_tree')

const treeRoot = () => process.env.MCAH_FILES_DIR || ''
const treeEnabled = () => Boolean(treeRoot())
const uploadRoot = () => path.resolve(config.upload.dir)
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const fail = (message) => ({ statusCode: 404, message })

// Mã tệp → đường dẫn tuyệt đối. Dữ liệu cũ: đường tuyệt đối hoặc "/uploads/…" (document_url chứng chỉ nạp tay).
function abs(ref) {
  if (!ref) return null
  if (ref.startsWith('hs:')) return path.join(treeRoot(), ...ref.slice(3).split('/'))
  if (ref.startsWith('u:')) return path.join(uploadRoot(), ...ref.slice(2).split('/'))
  if (ref.startsWith('/uploads/')) return path.join(uploadRoot(), ...ref.slice('/uploads/'.length).split('/'))
  return ref
}

// Đổi chỗ tệp; khác ổ đĩa (thư mục hồ sơ ở ổ D, thư mục app ở ổ C) thì chép rồi xoá bản cũ.
function moveFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  try {
    fs.renameSync(from, to)
  } catch (error) {
    if (error.code !== 'EXDEV') throw error
    fs.copyFileSync(from, to)
    fs.rmSync(from)
  }
}

const isTree = (ref) => String(ref || '').startsWith('hs:')
const relOf = (ref) => ref.slice(3)

function ensureReadme() {
  const file = path.join(treeRoot(), 'Đọc tôi.txt')
  if (!fs.existsSync(file)) {
    fs.mkdirSync(treeRoot(), { recursive: true })
    fs.writeFileSync(file, README)
  }
}

// Ghi tệp mới. tree: đường tương đối mong muốn trong thư mục hồ sơ (bỏ qua ở bản web); kind, ext: cho tệp nội bộ.
async function put(buffer, { tree = null, kind = 'misc', ext = '' } = {}, db = pool) {
  let ref
  if (tree && treeEnabled()) {
    ensureReadme()
    ref = `hs:${await freeRel(tree, db)}`
  } else {
    const id = crypto.randomBytes(16).toString('hex')
    ref = `u:${kind}/${id.slice(0, 2)}/${id}${ext || (tree ? path.posix.extname(tree) : '')}`
  }
  const file = abs(ref)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(`${file}.part`, buffer)
  fs.renameSync(`${file}.part`, file)
  await db.query('INSERT INTO stored_file (ref, sha256, size) VALUES (?, ?, ?) ON CONFLICT (ref) DO UPDATE SET sha256 = EXCLUDED.sha256, size = EXCLUDED.size', [ref, sha256(buffer), buffer.length])
  return ref
}

// Đường tương đối chưa có tệp nào (trên đĩa lẫn đang chờ chuyển tới): trùng thì thêm " (2)", " (3)".
async function freeRel(rel, db = pool) {
  const taken = new Set()
  for (let candidate = rel, i = 0; i < 50; i++) {
    const [[pending]] = await db.query('SELECT 1 AS x FROM file_move WHERE to_ref = ? AND done_at IS NULL', [`hs:${candidate}`])
    if (!fs.existsSync(abs(`hs:${candidate}`)) && !pending) return candidate
    taken.add(candidate.toLowerCase())
    candidate = unique(rel, taken)
  }
  throw new Error('Không đặt được tên tệp')
}

// Tìm chỗ thật của tệp: đúng chỗ → chỗ cũ đang chờ chuyển → tìm trong thư mục hồ sơ theo cỡ + sha256
// (người dùng lỡ tay di chuyển). Tìm thấy ở chỗ khác thì trả đường đó (không tự sửa DB ở đây).
async function locate(ref, db = pool) {
  const file = abs(ref)
  if (file && fs.existsSync(file)) return file
  if (!isTree(ref)) return null
  const [[move]] = await db.query('SELECT from_ref FROM file_move WHERE to_ref = ? AND done_at IS NULL ORDER BY id DESC LIMIT 1', [ref])
  if (move && fs.existsSync(abs(move.from_ref))) return abs(move.from_ref)
  const [[meta]] = await db.query('SELECT sha256, size FROM stored_file WHERE ref = ?', [ref])
  return meta ? findBySha(meta) : null
}

function findBySha({ sha256: want, size }, deadline = Date.now() + 5000) {
  const stack = [treeRoot()]
  while (stack.length && Date.now() < deadline) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && fs.statSync(full).size === Number(size) && sha256(fs.readFileSync(full)) === want) return full
    }
  }
  return null
}

async function read(ref, db = pool) {
  const file = await locate(ref, db)
  if (!file) throw fail('Tệp không còn trong thư mục hồ sơ')
  return fs.readFileSync(file)
}

async function stream(ref, db = pool) {
  const file = await locate(ref, db)
  if (!file) throw fail('Tệp không còn trong thư mục hồ sơ')
  return fs.createReadStream(file)
}

const exists = async (ref, db = pool) => Boolean(ref && (await locate(ref, db)))

// Chuyển một tệp trong thư mục hồ sơ tới đường tương đối mới. Ghi file_move trước, chuyển, đánh dấu xong. → mã mới
async function move(ref, rel, db = pool) {
  if (!isTree(ref) || !treeEnabled() || relOf(ref) === rel) return ref
  const to = `hs:${await freeRel(rel, db)}`
  const [{ insertId }] = await db.query('INSERT INTO file_move (from_ref, to_ref) VALUES (?, ?)', [ref, to])
  await db.query('INSERT INTO stored_file (ref, sha256, size) SELECT ?, sha256, size FROM stored_file WHERE ref = ? ON CONFLICT (ref) DO NOTHING', [to, ref])
  await finishMove({ id: insertId, from_ref: ref, to_ref: to }, db)
  return to
}

async function finishMove(row, db = pool) {
  try {
    const from = await locate(row.from_ref, db)
    const to = abs(row.to_ref)
    if (from && !fs.existsSync(to)) {
      moveFile(from, to)
      removeEmptyDirs(path.dirname(from))
    }
    await db.query('UPDATE file_move SET done_at = NOW(), error = NULL WHERE id = ?', [row.id])
  } catch (error) {
    // Windows: tệp đang mở trong trình xem. Job thử lại; đọc tệp vẫn tìm được ở chỗ cũ.
    await db.query('UPDATE file_move SET error = ? WHERE id = ?', [String(error.code || error.message).slice(0, 200), row.id])
  }
}

// Xoá thư mục rỗng còn lại sau khi chuyển (không đi lên quá gốc thư mục hồ sơ).
function removeEmptyDirs(dir) {
  const root = path.resolve(treeRoot())
  for (let d = path.resolve(dir); d.startsWith(root + path.sep); d = path.dirname(d)) {
    try {
      if (fs.readdirSync(d).length) return
      fs.rmdirSync(d)
    } catch {
      return
    }
  }
}

// Job: làm lại các lần chuyển chưa xong (gọi mỗi phút và lúc khởi động).
async function retryMoves(db = pool) {
  const [rows] = await db.query('SELECT id, from_ref, to_ref FROM file_move WHERE done_at IS NULL ORDER BY id LIMIT 200')
  for (const row of rows) await finishMove(row, db)
  return rows.length
}

// Đưa tệp vào thùng rác: tệp trong thư mục hồ sơ được chuyển ra thư mục nội bộ để người dùng không còn thấy.
// → mã tệp trong thùng rác (để ghi file_trash).
async function trashRef(ref, db = pool) {
  if (!ref) return null
  if (!isTree(ref)) return abs(ref)
  const from = await locate(ref, db)
  if (!from) return null
  const id = crypto.randomBytes(8).toString('hex')
  const to = abs(`u:trash/${id}-${path.basename(from)}`)
  moveFile(from, to)
  removeEmptyDirs(path.dirname(from))
  return to
}

// Tệp phát sinh từ một tệp (ảnh thu nhỏ…): để ở kho nội bộ theo mã tệp gốc, thiếu thì tạo bằng make(buffer gốc).
// Tệp gốc chuyển chỗ thì mã đổi, ảnh nhỏ tạo lại lúc cần. → mã tệp phát sinh
const pendingDerived = new Map()
async function derived(ref, suffix, make, db = pool) {
  const out = `u:derived/${crypto.createHash('sha1').update(String(ref)).digest('hex')}${suffix}`
  if (fs.existsSync(abs(out))) return out
  if (!pendingDerived.has(out)) {
    pendingDerived.set(out, (async () => {
      const buffer = await make(await read(ref, db))
      fs.mkdirSync(path.dirname(abs(out)), { recursive: true })
      fs.writeFileSync(abs(out), buffer)
      return out
    })().finally(() => pendingDerived.delete(out)))
  }
  return pendingDerived.get(out)
}

// Bỏ tệp vừa ghi trong cùng request mà request đó lỗi (CLAUDE.md 6.1: dọn rác của chính nó).
async function discardNew(ref, db = pool) {
  fs.rmSync(abs(ref), { force: true })
  await db.query('DELETE FROM stored_file WHERE ref = ?', [ref])
}

module.exports = { discardNew, derived, abs, put, read, stream, exists, locate, move, retryMoves, trashRef, treeEnabled, treeRoot, isTree, relOf, sha256 }
