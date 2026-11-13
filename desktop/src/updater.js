// Tự cập nhật (giai đoạn 0, bước 0.7). Không dùng electron-updater: cả hai hệ điều hành đều kiểm chữ ký Ed25519
// của bên mình (Linux không có kiểm chữ ký sẵn).
//   <MCAH_UPDATE_URL>/latest.json = { version, files: { linux: { name, sha256, size }, win: {...} }, signature }
//   signature = Ed25519 trên JSON của { version, files } (khoá riêng chỉ ở máy phát hành, khoá công khai gói trong app).
// Tải bộ cài về thư mục tạm của app, kiểm SHA-256, hỏi người dùng, rồi cài:
//   Ubuntu: pkexec dpkg -i (Ubuntu hiện hộp thoại xin mật khẩu quản trị) rồi mở lại app.
//   Windows: chạy bộ cài NSIS im lặng (/S, cài cho người dùng, không cần quyền quản trị), bộ cài tự mở lại app.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { app, dialog } = require('electron')
const { releasePublicKeyFile, updateUrlFile } = require('./paths')
const { canonical } = require('./manifest')

// Địa chỉ phát hành: MCAH_UPDATE_URL, hoặc tệp update-url.txt gói kèm lúc build.
const UPDATE_URL = (process.env.MCAH_UPDATE_URL || (fs.existsSync(updateUrlFile) ? fs.readFileSync(updateUrlFile, 'utf8').trim() : '')).replace(/\/+$/, '')
const PLATFORM = process.platform === 'win32' ? 'win' : 'linux'

// Migration cuối gói trong bản đang chạy (so với last_migration của bản mới).
function lastMigration() {
  const dir = path.join(require('./paths').backendDir, 'migrations/postgres')
  try {
    return fs.readdirSync(dir).filter((n) => /^\d+.*\.sql$/.test(n)).sort().pop() || null
  } catch {
    return null
  }
}

// So phiên bản dạng a.b.c.
function newer(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  return false
}

function verifyManifest(manifest, publicKeyPem) {
  const { signature, ...signed } = manifest
  if (!signature) return false
  return crypto.verify(null, Buffer.from(canonical(signed)), crypto.createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'))
}

// Bản mới hợp lệ cho máy này, hoặc null. Sai chữ ký thì báo lỗi, không bao giờ tải tiếp.
async function checkForUpdate() {
  if (!UPDATE_URL || !fs.existsSync(releasePublicKeyFile)) return null
  const r = await fetch(`${UPDATE_URL}/latest.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Không lấy được thông tin bản mới (${r.status})`)
  const manifest = await r.json()
  if (!verifyManifest(manifest, fs.readFileSync(releasePublicKeyFile, 'utf8'))) throw new Error('Chữ ký bản cập nhật không hợp lệ, bỏ qua')
  const file = manifest.files?.[PLATFORM]
  if (!file || !newer(manifest.version, app.getVersion())) return null
  if (!/^[\w.\- ]+$/.test(file.name) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Thông tin bản cập nhật sai định dạng')
  return { version: manifest.version, has_migrations: manifest.last_migration !== lastMigration(), ...file }
}

async function download(update) {
  const dir = path.join(app.getPath('userData'), 'updates')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const r = await fetch(`${UPDATE_URL}/${encodeURIComponent(update.name)}`)
  if (!r.ok) throw new Error(`Không tải được bản cập nhật (${r.status})`)
  const data = Buffer.from(await r.arrayBuffer())
  if (crypto.createHash('sha256').update(data).digest('hex') !== update.sha256) throw new Error('Tệp cập nhật tải về bị sai (SHA-256 không khớp)')
  const file = path.join(dir, update.name)
  fs.writeFileSync(file, data)
  return file
}

function install(file) {
  return new Promise((resolve, reject) => {
    const [cmd, args] = PLATFORM === 'win' ? [file, ['/S', '--force-run']] : ['pkexec', ['dpkg', '-i', file]]
    const child = spawn(cmd, args, { stdio: 'ignore', detached: PLATFORM === 'win' })
    child.on('error', reject)
    if (PLATFORM === 'win') {
      child.unref()
      resolve()
      return
    }
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(code === 126 || code === 127 ? 'Chưa nhập mật khẩu quản trị, chưa cập nhật' : `dpkg thoát với mã ${code}`))))
  })
}

// Kiểm, hỏi, tải, cài. Trả về true khi app sắp thoát để bản mới chạy.
async function runUpdate(window, { quiet = false, beforeInstall = null } = {}) {
  try {
    const update = await checkForUpdate()
    if (!update) {
      if (!quiet) dialog.showMessageBox(window, { message: `Đang dùng bản mới nhất (${app.getVersion()}).` })
      return false
    }
    const { response } = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Cập nhật ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
      message: `Có bản mới ${update.version} (đang dùng ${app.getVersion()}).`,
      detail: PLATFORM === 'linux' ? 'Ubuntu sẽ hỏi mật khẩu quản trị của máy để cài.' : 'App sẽ tự đóng và mở lại.',
    })
    if (response !== 0) return false
    const file = await download(update)
    // Máy chính, bản mới có đổi dữ liệu (docs/mcah-ke-hoach-desktop-gd4.md 3.5): dừng ghi, chụp DB, giữ bộ cài bản đang chạy.
    if (update.has_migrations && beforeInstall) await beforeInstall(update)
    await install(file)
    if (PLATFORM === 'linux') app.relaunch()
    app.quit()
    return true
  } catch (error) {
    if (!quiet) dialog.showErrorBox('Không cập nhật được', error.message)
    else console.error(`Cập nhật: ${error.message}`)
    return false
  }
}

// Máy chính giữ bộ cài mới nhất của cả hai hệ điều hành để máy nhân viên tải qua mạng văn phòng, không cần internet
// (docs/mcah-ke-hoach-desktop-gd3.md 3.5). Thư mục lan-installers: latest.json (đã ký) + tệp của từng hệ điều hành.
const mirrorDir = () => path.join(app.getPath('userData'), 'lan-installers')

async function mirrorInstallers() {
  if (!UPDATE_URL || !fs.existsSync(releasePublicKeyFile)) return
  const r = await fetch(`${UPDATE_URL}/latest.json`, { cache: 'no-store' })
  if (!r.ok) return
  const manifest = await r.json()
  if (!verifyManifest(manifest, fs.readFileSync(releasePublicKeyFile, 'utf8'))) throw new Error('Chữ ký bản cập nhật không hợp lệ')
  const dir = mirrorDir()
  const saved = path.join(dir, 'latest.json')
  if (fs.existsSync(saved) && JSON.parse(fs.readFileSync(saved, 'utf8')).version === manifest.version) return
  const tmp = `${dir}.tmp`
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  for (const file of Object.values(manifest.files || {})) {
    if (!/^[\w.\- ]+$/.test(file.name) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Thông tin bản cập nhật sai định dạng')
    const res = await fetch(`${UPDATE_URL}/${encodeURIComponent(file.name)}`)
    if (!res.ok) throw new Error(`Không tải được ${file.name} (${res.status})`)
    const data = Buffer.from(await res.arrayBuffer())
    if (crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`${file.name}: SHA-256 không khớp`)
    fs.writeFileSync(path.join(tmp, file.name), data)
  }
  fs.writeFileSync(path.join(tmp, 'latest.json'), JSON.stringify(manifest))
  fs.rmSync(dir, { recursive: true, force: true })
  fs.renameSync(tmp, dir)
}

// Gửi một tệp trong lan-installers cho máy nhân viên (tên phải có trong latest.json).
function serveInstaller(name, res) {
  const dir = mirrorDir()
  const manifestFile = path.join(dir, 'latest.json')
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null
  const allowed = name === 'latest.json' || Object.values(manifest?.files || {}).some((f) => f.name === name)
  if (!manifest || !allowed) return res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Máy chính chưa có bộ cài này"}')
  const file = path.join(dir, name)
  res.writeHead(200, { 'content-type': name.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'content-length': fs.statSync(file).size })
  fs.createReadStream(file).pipe(res)
}

// Máy nhân viên: cập nhật theo máy chính (wireframe màn 5). fetchFromMain(name) → Buffer qua mạng văn phòng (đã ghim).
async function updateFromMain(window, fetchFromMain) {
  const manifest = JSON.parse((await fetchFromMain('latest.json')).toString('utf8'))
  if (!verifyManifest(manifest, fs.readFileSync(releasePublicKeyFile, 'utf8'))) throw new Error('Chữ ký bộ cài trên máy chính không hợp lệ, không cài')
  const file = manifest.files?.[PLATFORM]
  if (!file || !newer(manifest.version, app.getVersion())) throw new Error('Máy chính chưa có bộ cài mới hơn cho máy này')
  await dialog.showMessageBox(window, {
    message: `Cần cập nhật để nối máy chính`,
    detail: `Máy chính đang dùng MCAH ${manifest.version}, máy này ${app.getVersion()}. MCAH sẽ tải bộ cài từ máy chính (không cần internet) rồi cài.${PLATFORM === 'linux' ? ' Ubuntu sẽ hỏi mật khẩu quản trị.' : ''}`,
    buttons: ['Cập nhật'],
  })
  const data = await fetchFromMain(file.name)
  if (crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('Bộ cài tải từ máy chính bị sai (SHA-256 không khớp), không cài')
  const dir = path.join(app.getPath('userData'), 'updates')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, file.name)
  fs.writeFileSync(target, data)
  await install(target)
  if (PLATFORM === 'linux') app.relaunch()
  app.quit()
}

module.exports = { install, PLATFORM, runUpdate, checkForUpdate, download, verifyManifest, mirrorInstallers, serveInstaller, updateFromMain }
