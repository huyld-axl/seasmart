// Tự cập nhật (giai đoạn 0, bước 0.7). Không dùng electron-updater: cả hai hệ điều hành đều kiểm chữ ký Ed25519
// của bên mình (Linux không có kiểm chữ ký sẵn).
//   <CATORO_UPDATE_URL>/latest.json = { version, files: { linux: { name, sha256, size }, win: {...} }, signature }
//   signature = Ed25519 trên JSON của { version, files } (khoá riêng chỉ ở máy phát hành, khoá công khai gói trong app).
// Tải bộ cài về thư mục tạm của app, kiểm SHA-256, hỏi người dùng, rồi cài:
//   Ubuntu: pkexec dpkg -i (Ubuntu hiện hộp thoại xin mật khẩu quản trị) rồi mở lại app.
//   Windows: chạy bộ cài NSIS im lặng (/S, cài cho người dùng, không cần quyền quản trị), bộ cài tự mở lại app.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { app, dialog } = require('electron')
const { releasePublicKeyFile } = require('./paths')
const { canonical } = require('./manifest')
const progress = require('./update-progress')

// Đọc mỗi lần dùng: app có thể đã học địa chỉ mới từ bản tin cập nhật (endpoints.js).
const endpoints = require('./endpoints')
const updateBase = () => endpoints.updateUrl()
const PLATFORM = process.platform === 'win32' ? 'win' : 'linux'

// Kênh cập nhật (docs/catoro-ke-hoach-desktop-gd6.md 3.4): thử nghiệm ở <địa chỉ>/beta. main.js đặt nguồn kênh
// (máy chính: cài đặt của máy; máy nhân viên: hỏi máy chính). Chỉ nhận bản MỚI HƠN nên đổi kênh không hạ bản.
let channelOf = async () => 'stable'
const setChannelSource = (fn) => { channelOf = fn }
const channelUrl = async () => `${updateBase()}${(await channelOf().catch(() => 'stable')) === 'beta' ? '/beta' : ''}`

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
  if (!updateBase() || !fs.existsSync(releasePublicKeyFile)) return null
  const base = await channelUrl()
  const r = await fetch(`${base}/latest.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Không lấy được thông tin bản mới (${r.status})`)
  const manifest = await r.json()
  if (!verifyManifest(manifest, fs.readFileSync(releasePublicKeyFile, 'utf8'))) throw new Error('Chữ ký bản cập nhật không hợp lệ, bỏ qua')
  // Bản tin đã ký mang địa chỉ máy chủ / chỗ phát mới (đổi tên miền): học ngay, kể cả khi không có bản mới hơn.
  endpoints.learn(manifest.endpoints)
  const file = manifest.files?.[PLATFORM]
  if (!file || !newer(manifest.version, app.getVersion())) return null
  if (!/^[\w.\- ]+$/.test(file.name) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Thông tin bản cập nhật sai định dạng')
  return { version: manifest.version, has_migrations: manifest.last_migration !== lastMigration(), notes: manifest.notes || '', base, ...file }
}

// onProgress(done, total): gọi theo từng phần tải về, để cửa sổ cập nhật vẽ phần trăm.
async function download(update, onProgress = () => {}) {
  const dir = path.join(app.getPath('userData'), 'updates')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const r = await fetch(`${update.base || updateBase()}/${encodeURIComponent(update.name)}`)
  if (!r.ok) throw new Error(`Không tải được bản cập nhật (${r.status})`)
  const total = Number(r.headers.get('content-length')) || update.size || 0
  const chunks = []
  let done = 0
  for await (const chunk of r.body) {
    chunks.push(chunk)
    done += chunk.length
    onProgress(done, total)
  }
  const data = Buffer.concat(chunks)
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

const INSTALL_HINT = PLATFORM === 'linux' ? 'Ubuntu sẽ hiện hộp hỏi mật khẩu quản trị của máy: nhập để cài tiếp.' : 'Catoro sẽ tự đóng rồi mở lại bản mới.'

// Cài bộ cài đã tải, cửa sổ tiến độ báo đang cài; xong thì đóng app để bản mới chạy.
async function installAndRestart(file, shown, version) {
  shown.set({ title: `Đang cài Catoro ${version}…`, hint: INSTALL_HINT })
  await install(file)
  shown.set({ title: `Đã cài Catoro ${version}, đang mở lại…`, hint: 'Catoro sẽ tự mở lại sau vài giây.' })
  if (PLATFORM === 'linux') app.relaunch()
  app.quit()
}

// Kiểm, hỏi, tải, cài. Trả về true khi app sắp thoát để bản mới chạy.
// quiet (tự kiểm định kỳ): không báo "đang dùng bản mới nhất" và lỗi lúc kiểm; nhưng người dùng đã bấm
// "Cập nhật ngay" thì lỗi tải / cài luôn được báo.
async function runUpdate(window, { quiet = false, beforeInstall = null } = {}) {
  let shown = null
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
      title: 'Có bản mới',
      message: `Có bản mới Catoro ${update.version} (đang dùng ${app.getVersion()}) · tải ${Math.round(update.size / 1024 / 1024)} MB`,
      // Ghi chú thay đổi (docs/catoro-ke-hoach-desktop-gd6.md 3.5, wireframe màn 1).
      detail: [
        update.notes ? `Có gì mới:\n${update.notes}` : '',
        update.has_migrations ? 'Các máy trong văn phòng sẽ tạm không lưu được trong vài phút.' : '',
        PLATFORM === 'linux' ? 'Ubuntu sẽ hỏi mật khẩu quản trị của máy để cài.' : 'App sẽ tự đóng và mở lại.',
      ].filter(Boolean).join('\n\n'),
    })
    if (response !== 0) return false
    shown = progress.open(window)
    const title = `Đang tải Catoro ${update.version}…`
    shown.set({ title, done: 0, total: update.size })
    const file = await download(update, (done, total) => shown.set({ title, done, total }))
    // Máy chính, bản mới có đổi dữ liệu (docs/catoro-ke-hoach-desktop-gd4.md 3.5): dừng ghi, chụp DB, giữ bộ cài bản đang chạy.
    if (update.has_migrations && beforeInstall) {
      shown.set({ title: 'Đang chụp lại dữ liệu trước khi cài…', hint: 'Các máy trong văn phòng tạm không lưu được trong vài phút.' })
      await beforeInstall(update)
    }
    await installAndRestart(file, shown, update.version)
    return true
  } catch (error) {
    shown?.close()
    if (!quiet || shown) dialog.showErrorBox('Không cập nhật được', error.message)
    else console.error(`Cập nhật: ${error.message}`)
    return false
  }
}

// Máy chính giữ bộ cài mới nhất của cả hai hệ điều hành để máy nhân viên tải qua mạng văn phòng, không cần internet
// (docs/catoro-ke-hoach-desktop-gd3.md 3.5). Thư mục lan-installers: latest.json (đã ký) + tệp của từng hệ điều hành.
const mirrorDir = () => path.join(app.getPath('userData'), 'lan-installers')

async function mirrorInstallers() {
  if (!updateBase() || !fs.existsSync(releasePublicKeyFile)) return
  const base = await channelUrl()
  const r = await fetch(`${base}/latest.json`, { cache: 'no-store' })
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
    const res = await fetch(`${base}/${encodeURIComponent(file.name)}`)
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
    detail: `Máy chính đang dùng Catoro ${manifest.version}, máy này ${app.getVersion()}. Catoro sẽ tải bộ cài từ máy chính (không cần internet) rồi cài.${PLATFORM === 'linux' ? ' Ubuntu sẽ hỏi mật khẩu quản trị.' : ''}`,
    buttons: ['Cập nhật'],
  })
  const shown = progress.open(window)
  try {
    shown.set({ title: `Đang tải Catoro ${manifest.version} từ máy chính…` })
    const data = await fetchFromMain(file.name)
    if (crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('Bộ cài tải từ máy chính bị sai (SHA-256 không khớp), không cài')
    const dir = path.join(app.getPath('userData'), 'updates')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, file.name)
    fs.writeFileSync(target, data)
    await installAndRestart(target, shown, manifest.version)
  } catch (error) {
    shown.close()
    throw error
  }
}

module.exports = { setChannelSource, install, PLATFORM, runUpdate, checkForUpdate, download, verifyManifest, mirrorInstallers, serveInstaller, updateFromMain }
