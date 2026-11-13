// Mở thư mục hồ sơ / xuất hồ sơ ra thư mục (docs/mcah-ke-hoach-desktop-gd4.md 3.2, wireframe màn 4, 5).
// Máy chính: mở thẳng thư mục thật trong thư mục hồ sơ. Máy nhân viên: tải từng tệp qua máy chính vào bản xem tạm chỉ đọc
// (<userData>/tmp/xem, xoá khi đóng app / đăng xuất / mở app lần sau). Xuất: chép vào "MCAH - Hồ sơ xuất <ngày>" ở nơi người dùng chọn
// (khác tên thư mục hồ sơ thật "MCAH - Hồ sơ" để xuất vào Tài liệu không đè lên nó).
const fs = require('fs')
const path = require('path')
const { app, shell, dialog } = require('electron')

const viewRoot = () => path.join(app.getPath('userData'), 'tmp', 'xem')
const EXPORT_README = 'Đây là bản sao xuất từ MCAH, KHÔNG được mã hoá.\r\nAi mở được thư mục này là đọc được giấy tờ.\r\nSửa ở đây không vào app MCAH.\r\n'

const json = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || 'Không lấy được danh sách tệp')
  return data
}

// api(pathname) → Response (main.js gắn phiên, đi thẳng backend hoặc qua máy chính).
async function download(api, files, root, onProgress) {
  let done = 0
  for (const f of files) {
    const res = await api(`/api/v1/files/raw?seafarer_id=${f.seafarer_id}&ref=${encodeURIComponent(f.ref)}`)
    if (!res.ok) throw new Error(`Không tải được ${path.basename(f.path)}`)
    const target = path.join(root, ...f.path.split('/'))
    if (!path.resolve(target).startsWith(path.resolve(root) + path.sep)) continue
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()))
    onProgress?.(++done, files.length)
  }
  return done
}

// Chỉ đọc cho bản xem tạm (sửa ở đây không vào app).
function readOnly(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) readOnly(full)
    else fs.chmodSync(full, 0o444)
  }
}

async function openFolder(api, seafarerId) {
  const tree = await json(await api(`/api/v1/files/tree?seafarer_ids=${seafarerId}`))
  const folder = tree.folders[0]
  if (!folder) throw new Error('Không tìm thấy hồ sơ')
  if (folder.real) {
    fs.mkdirSync(folder.real, { recursive: true })
    const error = await shell.openPath(folder.real)
    if (error) throw new Error(error)
    return { opened: folder.real }
  }
  const root = viewRoot()
  const target = path.join(root, ...folder.folder.split('/'))
  fs.rmSync(target, { recursive: true, force: true })
  await download(api, tree.files, root)
  fs.mkdirSync(target, { recursive: true })
  readOnly(target)
  const error = await shell.openPath(target)
  if (error) throw new Error(error)
  return { opened: target }
}

async function exportFolder(api, window, { seafarerIds = null, all = false }, onProgress) {
  const query = all ? 'all=1' : `seafarer_ids=${seafarerIds.join(',')}`
  const tree = await json(await api(`/api/v1/files/tree?${query}`))
  const pick = await dialog.showOpenDialog(window, { title: 'Chọn nơi xuất hồ sơ', properties: ['openDirectory', 'createDirectory'] })
  if (pick.canceled || !pick.filePaths[0]) return { canceled: true }
  const root = path.join(pick.filePaths[0], `MCAH - Hồ sơ xuất ${new Date().toISOString().slice(0, 10)}`)
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'Đọc tôi.txt'), EXPORT_README)
  for (const f of tree.folders) fs.mkdirSync(path.join(root, ...f.folder.split('/')), { recursive: true })
  const files = await download(api, tree.files, root, onProgress)
  return { folder: root, people: tree.folders.length, files }
}

const cleanViews = () => fs.rmSync(viewRoot(), { recursive: true, force: true })

module.exports = { openFolder, exportFolder, cleanViews }
