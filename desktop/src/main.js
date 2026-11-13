// Tiến trình chính của app MCAH. Giao diện là bản build của frontend/, phục vụ qua giao thức app:// để đường dẫn
// kiểu /admin/... của createBrowserRouter vẫn đúng khi tải lại trang (file:// thì không).
// Khởi động: màn chờ → Postgres → migration → Fastify → giao diện; hỏng bước nào thì hiện màn lỗi có mã (GĐ1 mục 3.2).
const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, Menu, protocol, net, shell, dialog } = require('electron')
const { pathToFileURL } = require('url')
const { Readable } = require('stream')
const { startDatabase, killNow, freePort, isRunning } = require('./db')
const { backendEnv, runScript, startBackend } = require('./backend')
const { cloudPublicKey } = require('./browser-login')
const { runUpdate, mirrorInstallers, serveInstaller, updateFromMain, install, PLATFORM } = require('./updater')
const updateGuard = require('./update-guard')
const { createBackup, restoreBackup, readManifest } = require('./backup')
const { rotatingLog, captureConsole } = require('./logs')
const { attachmentDir, cleanAttachmentDir, saveAttachments } = require('./mail')
const { findSoffice } = require('./pdf-component')
const { smtpConfig } = require('./settings')
const { registerIpc } = require('./ipc')
const session = require('./session')
const pin = require('./pin')
const { getSettings } = require('./settings')
const signer = require('./signer')
const { cloudUrl } = require('./browser-login')
const { machineKey, removeOldKeyFiles, markMove, pendingMove } = require('./office')
const { frontendDist: FRONTEND_DIST } = require('./paths')
const os = require('os')
const { powerSaveBlocker } = require('electron')
const lanServer = require('./lan-server')
const { ensureCert } = require('./lan-cert')
const { LAN_PORT } = require('./lan')
const discovery = require('./discovery')
const lanClient = require('./lan-client')
const readableView = require('./readable-view')
const diskEncryption = require('./disk-encryption')

// Tên app quyết định thư mục dữ liệu (~/.config/MCAH, %APPDATA%\MCAH); đặt trước khi dùng app.getPath.
app.setName('MCAH')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const PAGES = path.join(__dirname, 'pages')
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
// Hai API cần cấu hình SMTP của máy này: tiến trình chính gắn vào lúc chuyển tiếp, giao diện không thấy mật khẩu.
const MAIL_PREPARE = /^\/api\/v1\/opportunities\/\d+\/mail\/prepare$/
const SMTP_PATHS = [/^\/api\/v1\/opportunities\/\d+\/send-mail$/, /^\/api\/v1\/system\/smtp-test$/]

let backend = null
let backendEnvVars = null
let database = null
let mainWindow = null
let logs = null
let lan = null // { cert, key, fingerprint, secret, server } khi máy này là máy chính
let signerInfo = null // { url, token } của cổng ký (signer.js)
let staffMode = false // máy nhân viên: /api đi qua máy chính (lan-client.js), máy này không chạy Postgres / Fastify

// /api/ và /public/ chuyển tiếp sang Fastify. Tệp có thật trong dist thì trả tệp đó, còn lại (đường dẫn của router) trả index.html.
// /api: tiến trình chính gắn JWT của phiên (giao diện không giữ token, mọi Authorization giao diện tự gửi bị bỏ).
// Máy chính trả 401 cho request có phiên → phiên hết (quá mốc offline, bị khoá): bỏ phiên, giao diện về đăng nhập.
async function serveFrontend(request) {
  const { pathname, search } = new URL(request.url)
  if ((backend || staffMode) && (pathname.startsWith('/api/') || pathname.startsWith('/public/'))) {
    const headers = new Headers(request.headers)
    headers.delete('origin')
    headers.delete('x-mcah-smtp')
    headers.delete('authorization')
    // Đang khoá (mã PIN): không cho đọc / ghi dữ liệu.
    if (pin.isLocked() && pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'MCAH đang khoá, nhập mã PIN để tiếp tục', code: 'LOCKED' }), { status: 423, headers: { 'content-type': 'application/json' } })
    }
    const jwt = session.jwt()
    if (jwt) headers.set('authorization', `Bearer ${jwt}`)
    if (request.method === 'POST' && SMTP_PATHS.some((re) => re.test(pathname))) {
      const smtp = smtpConfig()
      if (smtp) headers.set('x-mcah-smtp', Buffer.from(JSON.stringify(smtp)).toString('base64'))
    }
    if (staffMode) {
      const response = await lanClient.forward({ method: request.method, pathname: pathname + search, headers: Object.fromEntries(headers), body: request.body ? Readable.fromWeb(request.body) : null })
      if (response.status === 401 && jwt && session.jwt() === jwt) session.expired()
      // Soạn thư bằng app mail: máy chính trả nội dung tệp, ghi vào thư mục gửi thư của máy này (mail.js).
      if (response.ok && MAIL_PREPARE.test(pathname)) {
        const { files } = await response.json()
        return Response.json({ files: saveAttachments(files || []) })
      }
      return response
    }
    const response = await net.fetch(backend.url + pathname + search, {
      method: request.method,
      headers,
      body: request.body,
      duplex: 'half',
      bypassCustomProtocolHandlers: true,
    })
    if (response.status === 401 && jwt && session.jwt() === jwt) session.expired()
    return response
  }
  const file = path.normalize(path.join(FRONTEND_DIST, decodeURIComponent(pathname)))
  const inside = file.startsWith(FRONTEND_DIST + path.sep)
  const target = inside && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(FRONTEND_DIST, 'index.html')
  const res = await net.fetch(pathToFileURL(target).toString())
  // CSP (docs/mcah-ke-hoach-desktop-gd4.md 3.7): chỉ chạy script của app; dữ liệu lạ (tên chứa <script>…) không chạy được.
  if (!target.endsWith('.html')) return res
  const headers = new Headers(res.headers)
  headers.set('Content-Security-Policy', CSP)
  return new Response(res.body, { status: res.status, headers })
}

const GUIDE = /^app:\/\/mcah\/huong-dan\//

// Link ngoài mở bằng trình duyệt hệ thống; trang hướng dẫn mở trong cửa sổ app riêng (không preload); còn lại chặn.
function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (GUIDE.test(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 1100, height: 800, title: 'Hướng dẫn MCAH', webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } },
      }
    }
    if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Điều hướng ngay trong cửa sổ: giữ trong app://mcah; mailto:, tel:, http(s) giao cho hệ điều hành; còn lại chặn.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://mcah/')) return
    event.preventDefault()
    if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url)
  })
  win.webContents.on('did-create-window', (child) => guardNavigation(child))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MCAH',
    backgroundColor: '#f4f4f6',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  })
  guardNavigation(win)
  // Bản phát hành: không cho mở DevTools (Ctrl+Shift+I…). Cờ --inspect bị tắt bằng Electron fuses lúc đóng gói.
  if (app.isPackaged) win.webContents.on('devtools-opened', () => win.webContents.closeDevTools())
  win.loadFile(path.join(PAGES, 'splash.html'))
  return win
}

function showError(code) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadFile(path.join(PAGES, 'error.html'), { query: { code, at: new Date().toLocaleString('vi-VN') } })
}

const logDir = () => path.join(app.getPath('userData'), 'logs')

// Mỗi bước khởi động gắn một mã lỗi cho màn lỗi; ổ đầy thì báo DISK_FULL.
async function step(code, fn) {
  try {
    return await fn()
  } catch (error) {
    error.startupCode = /ENOSPC|No space left/i.test(String(error.message) + error.code) ? 'DISK_FULL' : code
    throw error
  }
}

async function restartBackend(soffice) {
  if (backend) {
    backend.child.kill()
    await new Promise((r) => (backend.child.exitCode !== null ? r() : backend.child.once('exit', r)))
  }
  backendEnvVars = { ...backendEnvVars, SOFFICE_PATH: soffice || backendEnvVars.SOFFICE_PATH }
  backend = await startBackend(backendEnvVars, app.getPath('userData'), logs.backend)
}

async function rollbackUpdate(error) {
  console.error(`Cập nhật lỗi khi chuyển dữ liệu, quay về bản cũ: ${error.message}`)
  await database.pg.stop()
  database = null
  const from = updateGuard.pending()?.from
  const installer = updateGuard.rollback(PLATFORM)
  await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    message: 'Cập nhật không thành công',
    detail: installer
      ? `Đã trả dữ liệu về như trước khi cập nhật. MCAH sẽ cài lại bản ${from}. Không mất gì.\nMã lỗi: MIGRATE. Gửi mã này cho bộ phận hỗ trợ MCAH.`
      : `Đã trả dữ liệu về như trước khi cập nhật nhưng máy không còn bộ cài bản ${from}. Liên hệ bộ phận hỗ trợ MCAH, đừng mở lại MCAH trước khi được hướng dẫn.`,
    buttons: ['Đồng ý'],
  })
  if (installer) {
    await install(installer).catch((e) => console.error(`Không cài lại được bản cũ: ${e.message}`))
    if (PLATFORM === 'linux') app.relaunch()
  }
  app.exit(0)
}

// Trước khi cài bản mới có đổi dữ liệu: dừng ghi, chép DB, giữ bộ cài bản đang chạy.
const beforeInstall = (update) => updateGuard.prepare({
  update,
  stopBackend: async () => {
    lan?.server?.close()
    if (backend) {
      backend.child.kill()
      await new Promise((r) => (backend.child.exitCode !== null ? r() : backend.child.once('exit', r)))
    }
  },
  stopDatabase: async () => {
    await database.pg.stop()
    database = null
  },
})

// Máy nhân viên: không mở Postgres / Fastify; phiên và mọi /api đi qua máy chính.
async function startupStaff() {
  staffMode = true
  readableView.cleanViews()
  session.init(null, lanClient.call)
  watchSession()
  watchLan()
  await mainWindow.loadURL('app://mcah/')
  runUpdate(mainWindow, { quiet: true })
  setInterval(() => runUpdate(mainWindow, { quiet: true }), 6 * 3600 * 1000)
}

function watchSession() {
  session.events.on('changed', () => {
    mainWindow?.webContents.send('mcah:session-changed', session.info())
    // Đăng xuất / hết phiên: xoá bản xem tạm của thư mục hồ sơ.
    if (!session.info().loggedIn) readableView.cleanViews()
    // Vừa tạo văn phòng: máy này thành máy chính, mở cổng cho máy nhân viên.
    if (!staffMode && session.info().loggedIn && fs.existsSync(path.join(app.getPath('userData'), 'machine-key.bin'))) startLan()
  })
  pin.events.on('changed', (locked) => mainWindow?.webContents.send('mcah:lock-changed', locked))
  pin.watch({ lockMinutes: () => getSettings().lockMinutes, loggedIn: () => Boolean(session.jwt()) })
}

// Máy nhân viên: báo giao diện khi mất / có lại máy chính; bị Gỡ thì mở lại app ở chế độ ghép.
function watchLan() {
  lanClient.events.on('online', (value) => mainWindow?.webContents.send('mcah:lan-online', value))
  let updating = false
  lanClient.events.on('update-required', () => {
    if (updating) return
    updating = true
    updateFromMain(mainWindow, (name) => lanClient.download(name)).catch((error) => {
      updating = false
      dialog.showErrorBox('Không cập nhật được theo máy chính', error.message)
    })
  })
  lanClient.events.on('removed', () => {
    session.expired('device_removed')
    app.relaunch()
    app.quit()
  })
}

// Vừa ghép xong (ngay hoặc sau khi quản trị duyệt): chuyển sang máy nhân viên, đăng nhập lại bằng vé đang chờ qua máy chính.
async function becomeStaff() {
  staffMode = true
  watchLan()
  return session.becomeStaff(lanClient.call)
}

async function startup() {
  const userData = app.getPath('userData')
  removeOldKeyFiles()
  if (lanClient.isStaff()) return startupStaff()
  database = await step('DB_START', () => startDatabase(userData))
  const env = backendEnv(userData, database.env, await freePort(), { soffice: findSoffice(), mailDir: attachmentDir(), filesDir: filesDir() })
  // Máy chính: chứng chỉ HTTPS trong mạng văn phòng; backend báo dấu vân tay lên máy chủ dịch vụ (giai đoạn 3).
  try {
    const cert = await ensureCert(lanHostName())
    lan = { ...cert, secret: lanServer.newSecret(), server: null }
    Object.assign(env, { MCAH_LAN_FINGERPRINT: cert.fingerprint, MCAH_LAN_NAME: lanHostName(), MCAH_LAN_PORT: String(LAN_PORT), MCAH_LAN_SECRET: lan.secret })
  } catch (error) {
    console.error(`Không tạo được chứng chỉ trong mạng văn phòng: ${error.message}`)
  }
  const ticketKey = cloudPublicKey()
  if (ticketKey) env.DESKTOP_TICKET_PUBLIC_KEY = ticketKey
  // Cổng ký: backend gọi máy chủ dịch vụ (mời, bỏ thành viên, AI, tra tàu) qua tiến trình chính giữ khoá máy chính.
  const sign = await signer.start({ cloudUrl, machineKey })
  signerInfo = sign
  env.MCAH_SIGNER_URL = sign.url
  env.MCAH_SIGNER_TOKEN = sign.token
  env.MCAH_MAINTENANCE_FILE = updateGuard.maintenanceFile()
  try {
    await step('DB_MIGRATE', () => runScript('scripts/migrate.js', env, userData, logs.backend))
  } catch (error) {
    // Bản mới đổi dữ liệu lỗi (docs/mcah-ke-hoach-desktop-gd4.md 3.5): trả DB về, cài lại bản cũ.
    if (updateGuard.canRollback()) return rollbackUpdate(error)
    throw error
  }
  if (updateGuard.pending()) updateGuard.finish()
  backendEnvVars = env
  backend = await step('BACKEND_START', () => startBackend(env, userData, logs.backend))
  session.init(() => backend.url)
  watchSession()
  if (fs.existsSync(path.join(userData, 'machine-key.bin'))) startLan()
  try {
    cleanAttachmentDir()
  } catch (error) {
    console.error(`Không dọn được thư mục gửi thư: ${error.message}`)
  }
  await mainWindow.loadURL('app://mcah/')
  // Kiểm bản mới lúc mở app và mỗi 6 giờ, im lặng nếu không có hoặc lỗi mạng.
  runUpdate(mainWindow, { quiet: true, beforeInstall })
  setInterval(() => runUpdate(mainWindow, { quiet: true, beforeInstall }), 6 * 3600 * 1000)
}

// Thư mục hồ sơ dễ đọc trên máy chính: đặt trong Cài đặt (sau này), mặc định Tài liệu/MCAH - Hồ sơ.
// MCAH_FILES_DIR (dev) để thử nhiều bản app trên một máy.
const filesDir = () => process.env.MCAH_FILES_DIR || getSettings().filesDir || path.join(app.getPath('documents'), 'MCAH - Hồ sơ')

// Tên máy trong mạng văn phòng (hiện ở màn ghép và Cài đặt): tên máy của hệ điều hành, chỉ chữ số và gạch.
const lanHostName = () => os.hostname().split('.')[0].replace(/[^A-Za-z0-9-]/g, '-').slice(0, 63) || 'MCAH'

// Mở cổng HTTPS cho máy nhân viên, quảng bá trong mạng (mDNS), không cho máy ngủ khi MCAH đang mở.
async function startLan() {
  if (!lan || lan.server || lan.starting || pendingMove()) return
  lan.starting = true
  try {
    // Văn phòng đã chuyển sang máy chính khác (docs/mcah-ke-hoach-desktop-gd4.md 3.4, W9): ngừng phục vụ.
    const office = await fetch(`${backend.url}/api/v1/lan/hello`, { headers: { 'x-mcah-lan': lan.secret } }).then((r) => r.json()).catch(() => ({}))
    if (office.office_id && (await machineReplaced(office.office_id))) {
      lan.replaced = true
      mainWindow?.loadFile(path.join(PAGES, 'moved.html'), { query: { office: office.office_name || '' } })
      return
    }
    lan.server = await lanServer.start({
      cert: lan.cert,
      key: lan.key,
      port: LAN_PORT,
      secret: lan.secret,
      backendUrl: () => backend.url,
      appVersion: () => app.getVersion(),
      installerFor: serveInstaller,
    })
    const hello = await fetch(`${backend.url}/api/v1/lan/hello`, { headers: { 'x-mcah-lan': lan.secret } }).then((r) => r.json()).catch(() => ({}))
    if (hello.office_id) discovery.advertise({ name: lanHostName(), port: LAN_PORT, officeId: hello.office_id })
    lan.blocker = powerSaveBlocker.start('prevent-app-suspension')
    // Mã hoá ổ đĩa chứa thư mục hồ sơ (kiểm lúc mở và mỗi ngày; thẻ máy chính trong Cài đặt hiện kết quả).
    const checkDisk = async () => { diskState = await diskEncryption.check(filesDir()) }
    checkDisk()
    setInterval(checkDisk, 24 * 3600 * 1000).unref?.()
    // Giữ bộ cài mới nhất cho máy nhân viên (tải qua mạng văn phòng); lỗi mạng thì để lần sau.
    const mirror = () => mirrorInstallers().catch((error) => console.error(`Bộ cài cho máy nhân viên: ${error.message}`))
    mirror()
    setInterval(mirror, 6 * 3600 * 1000)
    console.error(`Cổng máy chính mở ở ${LAN_PORT} (${lanHostName()})`)
  } catch (error) {
    console.error(`Không mở được cổng máy chính ${LAN_PORT}: ${error.message}`)
  } finally {
    lan.starting = false
  }
}

// Hỏi máy chủ dịch vụ (qua cổng ký) khoá máy này còn là máy chính không. Mất mạng thì coi như còn.
async function machineReplaced(officeId) {
  try {
    const r = await fetch(`${signerInfo.url}/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signer-token': signerInfo.token },
      body: JSON.stringify({ office_id: officeId, path: '/api/office/machine/status', method: 'GET' }),
      signal: AbortSignal.timeout(15000),
    }).then((x) => x.json())
    return r.status === 409 && r.body?.error === 'machine_replaced'
  } catch {
    return false
  }
}

// Gọi /api của văn phòng từ tiến trình chính với phiên hiện tại (máy chính: backend máy này; máy nhân viên: qua máy chính).
function apiGet(pathname) {
  const jwt = session.jwt()
  if (!jwt) return Promise.resolve(new Response('{"error":"Chưa đăng nhập"}', { status: 401 }))
  if (staffMode) return lanClient.forward({ method: 'GET', pathname, headers: { authorization: `Bearer ${jwt}` }, body: null })
  return fetch(`${backend.url}${pathname}`, { headers: { authorization: `Bearer ${jwt}` } })
}

// Trạng thái máy chính cho thẻ trong Cài đặt trên máy này (wireframe màn 6).
let diskState = 'unknown'
function lanStatus() {
  if (!lan?.server) return null
  const addresses = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address)
  return { name: lanHostName(), port: LAN_PORT, addresses, fingerprint: lan.fingerprint, keepAwake: Boolean(lan.blocker !== undefined && powerSaveBlocker.isStarted(lan.blocker)), diskEncryption: diskState, filesDir: filesDir() }
}

// Lệnh cho hỗ trợ MCAH (không có nút trong app, Q15; docs/mcah-ke-hoach-desktop-gd4.md 3.3, 3.4):
//   --backup=<tệp.zip>    chụp dữ liệu máy chính (DB + thư mục hồ sơ + kho nội bộ) ra tệp .zip thường
//   --restore=<tệp.zip>   nạp bản chụp vào máy mới (chưa có dữ liệu); chuyển máy chính trên máy chủ dịch vụ làm ở bước 4
function cliCommand() {
  for (const arg of process.argv) {
    const m = /^--(backup|restore)=(.+)$/.exec(arg)
    if (m) return { name: m[1], file: path.resolve(m[2]) }
  }
  return null
}

async function runCli(cmd, userData) {
  if (cmd.name === 'restore' && fs.existsSync(path.join(userData, 'pgdata'))) {
    throw new Error('Máy này đã có dữ liệu. Khôi phục chỉ làm trên máy mới (thư mục dữ liệu trống).')
  }
  if (isRunning(userData)) throw new Error('App đang mở. Đóng app rồi chạy lại lệnh.')
  // Đọc thử bản chụp trước khi tạo gì trên máy: hỏng thì máy vẫn trống.
  if (cmd.name === 'restore') {
    const m = await readManifest(cmd.file)
    console.log(`Bản chụp của ${m.office?.name || 'văn phòng'} lúc ${m.created_at} (MCAH ${m.app_version}), ${m.files.length} tệp`)
  }
  database = await startDatabase(userData)
  const env = backendEnv(userData, database.env, await freePort())
  await runScript('scripts/migrate.js', env, userData)
  if (cmd.name === 'backup') {
    const r = await createBackup({ dbEnv: database.env, uploadDir: env.UPLOAD_DIR, filesDir: filesDir(), appVersion: app.getVersion(), outFile: cmd.file })
    console.log(`Đã chụp: ${r.files} tệp, ${r.bytes} byte → ${cmd.file}${r.missing ? ` (thiếu ${r.missing} tệp trong thư mục hồ sơ)` : ''}`)
  } else {
    const r = await restoreBackup({ file: cmd.file, dbEnv: database.env, uploadDir: env.UPLOAD_DIR, filesDir: filesDir() })
    console.log(`Đã khôi phục bản chụp ${r.createdAt} (app ${r.appVersion}), ${r.files} tệp`)
    // Không mang quyền cũ sang máy mới: huỷ mọi máy nhân viên đã ghép, đổi khoá ký phiên; lần đăng nhập đầu của quản trị
    // chuyển máy chính trên máy chủ dịch vụ (session.completeMove).
    const { Client } = require('pg')
    const client = new Client({ host: database.env.DB_HOST, port: +database.env.DB_PORT, user: database.env.DB_USER, password: database.env.DB_PASSWORD, database: database.env.DB_NAME })
    await client.connect()
    await client.query("UPDATE office_device SET status = 'removed', token_hash = NULL, removed_at = NOW() WHERE status <> 'removed'")
    await client.end()
    fs.rmSync(path.join(userData, 'jwt-secret'), { force: true })
    if (r.office?.id) markMove(r.office.id)
    console.log('Máy nhân viên cũ đã bị huỷ. Quản trị mở MCAH, đăng nhập để chuyển văn phòng sang máy này.')
  }
}

async function main() {
  const userData = app.getPath('userData')
  const cmd = cliCommand()
  if (cmd) {
    try {
      await runCli(cmd, userData)
    } catch (error) {
      console.error(`LỖI: ${error.message}`)
      process.exitCode = 1
    }
    if (database) await database.pg.stop()
    // Khôi phục hỏng giữa chừng: xoá những gì vừa tạo để máy trở lại trống (đã kiểm lúc đầu là máy trống).
    if (cmd.name === 'restore' && process.exitCode && database) {
      for (const name of ['pgdata', 'uploads', 'db-secret', 'jwt-secret']) fs.rmSync(path.join(userData, name), { recursive: true, force: true })
    }
    database = null
    app.exit(process.exitCode || 0)
    return
  }

  // Một cửa sổ duy nhất: mở app lần hai thì đưa cửa sổ đang có lên trước.
  if (!app.requestSingleInstanceLock()) {
    app.exit(0)
    return
  }
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  logs = { main: rotatingLog(path.join(logDir(), 'main.log')), backend: rotatingLog(path.join(logDir(), 'backend.log')) }
  captureConsole(logs.main)
  protocol.handle('app', serveFrontend)
  // Bỏ menu Tài khoản của giai đoạn 0 (đã vào menu tài khoản trong giao diện); giữ menu Sửa cho cắt / dán.
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu', label: 'Sửa' }]))
  registerIpc({
    relaunch: () => {
      app.relaunch()
      app.quit()
    },
    openLogs: () => shell.openPath(logDir()),
    restartBackend,
    checkUpdate: () => runUpdate(mainWindow, staffMode ? {} : { beforeInstall }),
    lanStatus,
    lanFind: () => lanClient.find(session.pendingTicket()),
    // Lỗi có mã (WRONG_MACHINE, UNREACHABLE, …) trả về như kết quả để giao diện chọn màn (IPC làm mất mã của lỗi ném).
    lanPair: async (host) => {
      try {
        const result = await lanClient.pair(session.pendingTicket(), host)
        if (result.status === 'active') await becomeStaff()
        return result
      } catch (error) {
        if (!error.code) throw error
        return { status: 'error', code: error.code, message: error.message, host }
      }
    },
    lanPairStatus: async () => {
      const result = await lanClient.pairStatus()
      if (result.status === 'active' && !staffMode) await becomeStaff()
      return result
    },
    lanInfo: () => ({ staff: staffMode, main: lanClient.info(), pending: Boolean(lanClient.load()?.pairSecret) }),
    lanRetry: () => lanClient.retryNow(),
    openFolder: (id) => readableView.openFolder(apiGet, id),
    exportFolder: (opts) => readableView.exportFolder(apiGet, mainWindow, opts, (done, total) => mainWindow?.webContents.send('mcah:export-progress', { done, total })),
  })
  mainWindow = createWindow()
  try {
    await startup()
  } catch (error) {
    console.error(`Khởi động lỗi (${error.startupCode || 'UNKNOWN'}): ${error.stack || error.message}`)
    showError(error.startupCode || 'UNKNOWN')
  }
}

app.whenReady().then(main)

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => readableView.cleanViews())

// Tắt Postgres trước khi thoát để không còn tiến trình mồ côi.
let stopping = false
app.on('before-quit', (event) => {
  if (!database || stopping) return
  event.preventDefault()
  stopping = true
  if (backend) backend.child.kill()
  lan?.server?.close()
  discovery.stop()
  database.pg.stop().finally(() => app.exit(0))
})
// Bị tắt bằng tín hiệu (Ctrl+C, hệ điều hành tắt máy) thì không kịp chờ stop(): gửi tín hiệu tắt cho Postgres ngay.
process.on('exit', () => {
  if (backend) backend.child.kill()
  killNow(path.join(app.getPath('userData'), 'pgdata'))
})
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    console.error(`Nhận ${signal}, thoát`)
    process.exit(0)
  })
}
