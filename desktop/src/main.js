// Tiến trình chính của app MCAH (giai đoạn 0). Giao diện là bản build của frontend/, phục vụ qua giao thức app://
// để đường dẫn kiểu /admin/... của createBrowserRouter vẫn đúng khi tải lại trang (file:// thì không).
const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, Menu, dialog, protocol, net, shell } = require('electron')
const { pathToFileURL } = require('url')
const { startDatabase, killNow, freePort, isRunning } = require('./db')
const { backendEnv, runScript, startBackend } = require('./backend')
const { cloudPublicKey, getTicket, exchangeTicket } = require('./browser-login')
const { runUpdate } = require('./updater')
const { setupKeys, createBackup, restoreBackup, readBackup } = require('./backup')

const { frontendDist: FRONTEND_DIST } = require('./paths')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

let backend = null

// /api/ và /public/ chuyển tiếp sang Fastify. Tệp có thật trong dist thì trả tệp đó, còn lại (đường dẫn của router) trả index.html.
function serveFrontend(request) {
  const { pathname, search } = new URL(request.url)
  if (backend && (pathname.startsWith('/api/') || pathname.startsWith('/public/'))) {
    const headers = new Headers(request.headers)
    headers.delete('origin')
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

let mainWindow = null

// Đăng nhập qua trình duyệt rồi đưa phiên vào giao diện (giai đoạn 0 chưa sửa frontend: ghi thẳng localStorage
// đúng khoá authStore đang đọc, rồi mở trang tổng quan).
async function browserLogin() {
  try {
    const session = await exchangeTicket(backend.url, await getTicket())
    await mainWindow.webContents.executeJavaScript(
      `localStorage.setItem('token', ${JSON.stringify(session.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(session.user))})`
    )
    mainWindow.loadURL('app://mcah/dashboard')
    mainWindow.focus()
  } catch (error) {
    dialog.showErrorBox('Không đăng nhập được', error.message)
  }
}

function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Tài khoản',
      submenu: [
        { label: 'Đăng nhập qua trình duyệt', click: browserLogin },
        { label: 'Kiểm tra bản mới', click: () => runUpdate(mainWindow) },
        { type: 'separator' },
        { role: 'quit', label: 'Thoát' },
      ],
    },
    { role: 'editMenu', label: 'Sửa' },
  ]))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MCAH',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  // Link ngoài mở bằng trình duyệt hệ thống, không mở trong app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL('app://mcah/')
  mainWindow = win
}

let database = null

// Lệnh sao lưu chạy không mở cửa sổ (giai đoạn 0 chưa có màn; mật khẩu qua biến môi trường):
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

app.whenReady().then(async () => {
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
  protocol.handle('app', serveFrontend)
  database = await startDatabase(userData)
  const env = backendEnv(userData, database.env, await freePort())
  const ticketKey = cloudPublicKey()
  if (ticketKey) env.DESKTOP_TICKET_PUBLIC_KEY = ticketKey
  await runScript('scripts/migrate.js', env, userData)
  backend = await startBackend(env, userData)
  createMenu()
  createWindow()
  if (process.env.MCAH_LOGIN_ON_START) browserLogin()
  // Kiểm bản mới lúc mở app và mỗi 6 giờ, im lặng nếu không có hoặc lỗi mạng.
  runUpdate(mainWindow, { quiet: true })
  setInterval(() => runUpdate(mainWindow, { quiet: true }), 6 * 3600 * 1000)
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

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
