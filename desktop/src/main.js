// Tiến trình chính của app MCAH. Giao diện là bản build của frontend/, phục vụ qua giao thức app:// để đường dẫn
// kiểu /admin/... của createBrowserRouter vẫn đúng khi tải lại trang (file:// thì không).
// Khởi động: màn chờ → Postgres → migration → Fastify → giao diện; hỏng bước nào thì hiện màn lỗi có mã (GĐ1 mục 3.2).
const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron')
const { pathToFileURL } = require('url')
const { startDatabase, killNow, freePort, isRunning } = require('./db')
const { backendEnv, runScript, startBackend } = require('./backend')
const { cloudPublicKey } = require('./browser-login')
const { runUpdate } = require('./updater')
const { setupKeys, createBackup, restoreBackup, readBackup } = require('./backup')
const { rotatingLog, captureConsole } = require('./logs')
const { attachmentDir, cleanAttachmentDir } = require('./mail')
const { findSoffice } = require('./pdf-component')
const { smtpConfig } = require('./settings')
const { registerIpc } = require('./ipc')
const { frontendDist: FRONTEND_DIST } = require('./paths')

// Tên app quyết định thư mục dữ liệu (~/.config/MCAH, %APPDATA%\MCAH); đặt trước khi dùng app.getPath.
app.setName('MCAH')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const PAGES = path.join(__dirname, 'pages')
// Hai API cần cấu hình SMTP của máy này: tiến trình chính gắn vào lúc chuyển tiếp, giao diện không thấy mật khẩu.
const SMTP_PATHS = [/^\/api\/v1\/opportunities\/\d+\/send-mail$/, /^\/api\/v1\/system\/smtp-test$/]

let backend = null
let backendEnvVars = null
let database = null
let mainWindow = null
let logs = null

// /api/ và /public/ chuyển tiếp sang Fastify. Tệp có thật trong dist thì trả tệp đó, còn lại (đường dẫn của router) trả index.html.
function serveFrontend(request) {
  const { pathname, search } = new URL(request.url)
  if (backend && (pathname.startsWith('/api/') || pathname.startsWith('/public/'))) {
    const headers = new Headers(request.headers)
    headers.delete('origin')
    headers.delete('x-mcah-smtp')
    if (request.method === 'POST' && SMTP_PATHS.some((re) => re.test(pathname))) {
      const smtp = smtpConfig()
      if (smtp) headers.set('x-mcah-smtp', Buffer.from(JSON.stringify(smtp)).toString('base64'))
    }
    return net.fetch(backend.url + pathname + search, {
      method: request.method,
      headers,
      body: request.body,
      duplex: 'half',
      bypassCustomProtocolHandlers: true,
    })
  }
  const file = path.normalize(path.join(FRONTEND_DIST, decodeURIComponent(pathname)))
  const inside = file.startsWith(FRONTEND_DIST + path.sep)
  const target = inside && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(FRONTEND_DIST, 'index.html')
  return net.fetch(pathToFileURL(target).toString())
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

async function startup() {
  const userData = app.getPath('userData')
  database = await step('DB_START', () => startDatabase(userData))
  const env = backendEnv(userData, database.env, await freePort(), { soffice: findSoffice(), mailDir: attachmentDir() })
  const ticketKey = cloudPublicKey()
  if (ticketKey) env.DESKTOP_TICKET_PUBLIC_KEY = ticketKey
  await step('DB_MIGRATE', () => runScript('scripts/migrate.js', env, userData, logs.backend))
  backendEnvVars = env
  backend = await step('BACKEND_START', () => startBackend(env, userData, logs.backend))
  try {
    cleanAttachmentDir()
  } catch (error) {
    console.error(`Không dọn được thư mục gửi thư: ${error.message}`)
  }
  await mainWindow.loadURL('app://mcah/')
  // Kiểm bản mới lúc mở app và mỗi 6 giờ, im lặng nếu không có hoặc lỗi mạng.
  runUpdate(mainWindow, { quiet: true })
  setInterval(() => runUpdate(mainWindow, { quiet: true }), 6 * 3600 * 1000)
}

// Lệnh sao lưu chạy không mở cửa sổ (chưa có màn tới giai đoạn 4; mật khẩu qua biến môi trường):
//   --backup-setup        đặt mật khẩu (MCAH_BACKUP_PASSWORD), in mã khôi phục một lần
//   --backup=<tệp>        sao lưu ra tệp
//   --restore=<tệp>       khôi phục vào máy mới (chưa có dữ liệu), mở bằng MCAH_BACKUP_PASSWORD hoặc MCAH_RECOVERY_CODE
function cliCommand() {
  for (const arg of process.argv) {
    const m = /^--(backup-setup|backup|restore)(?:=(.+))?$/.exec(arg)
    if (m) return { name: m[1], file: m[2] && path.resolve(m[2]) }
  }
  return null
}

async function runCli(cmd, userData) {
  if (cmd.name === 'restore' && fs.existsSync(path.join(userData, 'pgdata'))) {
    throw new Error('Máy này đã có dữ liệu. Khôi phục chỉ làm trên máy mới (thư mục dữ liệu trống).')
  }
  if (isRunning(userData)) throw new Error('App đang mở. Đóng app rồi chạy lại lệnh.')
  if (cmd.name === 'backup-setup') {
    console.log(`Mã khôi phục dữ liệu (chép lại, chỉ hiện một lần): ${setupKeys(userData, process.env.MCAH_BACKUP_PASSWORD)}`)
    return
  }
  // Mở thử gói trước khi tạo gì trên máy: sai mật khẩu / gói hỏng thì máy vẫn trống, thử lại được.
  if (cmd.name === 'restore') {
    readBackup(cmd.file, { password: process.env.MCAH_BACKUP_PASSWORD, recoveryCode: process.env.MCAH_RECOVERY_CODE })
  }
  database = await startDatabase(userData)
  const env = backendEnv(userData, database.env, await freePort())
  await runScript('scripts/migrate.js', env, userData)
  if (cmd.name === 'backup') {
    const r = await createBackup({ userData, dbEnv: database.env, uploadDir: env.UPLOAD_DIR, appVersion: app.getVersion(), outFile: cmd.file })
    console.log(`Đã sao lưu: ${r.files} tệp, ${r.bytes} byte → ${cmd.file}`)
  } else {
    const r = await restoreBackup({
      file: cmd.file,
      password: process.env.MCAH_BACKUP_PASSWORD,
      recoveryCode: process.env.MCAH_RECOVERY_CODE,
      dbEnv: database.env,
      uploadDir: env.UPLOAD_DIR,
    })
    console.log(`Đã khôi phục bản sao lưu ${r.createdAt} (app ${r.appVersion}), ${r.files} tệp`)
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
    checkUpdate: () => runUpdate(mainWindow),
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

// Tắt Postgres trước khi thoát để không còn tiến trình mồ côi.
let stopping = false
app.on('before-quit', (event) => {
  if (!database || stopping) return
  event.preventDefault()
  stopping = true
  if (backend) backend.child.kill()
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
