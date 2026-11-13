// Cập nhật có đổi dữ liệu trên máy chính (docs/mcah-ke-hoach-desktop-gd4.md 3.5, Q-B1):
//   trước khi cài: cờ bảo trì (backend trả 503 cho lệnh ghi) → chờ request đang chạy → tắt backend + Postgres →
//   chép nguyên thư mục DB (pgdata-truoc-cap-nhat) và bộ cài bản đang chạy (bo-cai-quay-ve) → ghi update-pending.json.
//   bản mới khởi động: migration lỗi → trả thư mục DB cũ về, cài lại bộ cài bản cũ. Tệp hồ sơ không bị migration đụng.
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const dir = () => app.getPath('userData')
const f = (name) => path.join(dir(), name)
const PENDING = 'update-pending.json'
const DB_COPY = 'pgdata-truoc-cap-nhat'
const INSTALLER_COPY = 'bo-cai-quay-ve'
const MAINTENANCE = 'bao-tri'

const maintenanceFile = () => f(MAINTENANCE)

async function prepare({ update, stopBackend, stopDatabase }) {
  fs.writeFileSync(maintenanceFile(), new Date().toISOString())
  await new Promise((r) => setTimeout(r, 5000))
  await stopBackend()
  await stopDatabase()
  fs.rmSync(f(DB_COPY), { recursive: true, force: true })
  fs.cpSync(f('pgdata'), f(DB_COPY), { recursive: true })
  fs.rmSync(f(INSTALLER_COPY), { recursive: true, force: true })
  if (fs.existsSync(f('lan-installers'))) fs.cpSync(f('lan-installers'), f(INSTALLER_COPY), { recursive: true })
  fs.writeFileSync(f(PENDING), JSON.stringify({ from: app.getVersion(), to: update.version, at: new Date().toISOString() }))
}

const pending = () => {
  try {
    return JSON.parse(fs.readFileSync(f(PENDING), 'utf8'))
  } catch {
    return null
  }
}

// Bản mới đã chạy migration xong: bỏ bản sao và cờ.
function finish() {
  for (const name of [PENDING, DB_COPY, INSTALLER_COPY, MAINTENANCE]) fs.rmSync(f(name), { recursive: true, force: true })
}

// Migration lỗi: trả DB về như trước (Postgres phải đang tắt). → đường dẫn bộ cài bản cũ, hoặc null nếu không có.
function rollback(platform) {
  const p = pending()
  fs.rmSync(f('pgdata'), { recursive: true, force: true })
  fs.renameSync(f(DB_COPY), f('pgdata'))
  fs.rmSync(f(MAINTENANCE), { force: true })
  const manifestFile = path.join(f(INSTALLER_COPY), 'latest.json')
  if (!fs.existsSync(manifestFile)) return null
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const file = manifest.files?.[platform]
  if (!file || manifest.version !== p?.from) return null
  return path.join(f(INSTALLER_COPY), file.name)
}

const canRollback = () => Boolean(pending() && fs.existsSync(f(DB_COPY)))

module.exports = { prepare, pending, finish, rollback, canRollback, maintenanceFile }
