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
const { runUpdate, mirrorInstallers, serveInstaller, updateFromMain } = require('./updater')
const { setupKeys, createBackup, restoreBackup, readBackup } = require('./backup')
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
const { machineKey } = require('./office')
const { frontendDist: FRONTEND_DIST } = require('./paths')
const os = require('os')
const { powerSaveBlocker } = require('electron')
const lanServer = require('./lan-server')
const { ensureCert } = require('./lan-cert')
const { LAN_PORT } = require('./lan')
const discovery = require('./discovery')
const lanClient = require('./lan-client')

// Tên app quyết định thư mục dữ liệu (~/.config/MCAH, %APPDATA%\MCAH); đặt trước khi dùng app.getPath.
app.setName('MCAH')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const PAGES = path.join(__dirname, 'pages')
// Hai API cần cấu hình SMTP của máy này: tiến trình chính gắn vào lúc chuyển tiếp, giao diện không thấy mật khẩu.
const MAIL_PREPARE = /^\/api\/v1\/opportunities\/\d+\/mail\/prepare$/
const SMTP_PATHS = [/^\/api\/v1\/opportunities\/\d+\/send-mail$/, /^\/api\/v1\/system\/smtp-test$/]

let backend = null
let backendEnvVars = null
let database = null
let mainWindow = null
let logs = null
let lan = null // { cert, key, fingerprint, secret, server } khi máy này là máy chính
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

// Máy nhân viên: không mở Postgres / Fastify; phiên và mọi /api đi qua máy chính.
async function startupStaff() {
  staffMode = true
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
  if (lanClient.isStaff()) return startupStaff()
  database = await step('DB_START', () => startDatabase(userData))
  const env = backendEnv(userData, database.env, await freePort(), { soffice: findSoffice(), mailDir: attachmentDir() })
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
  env.MCAH_SIGNER_URL = sign.url
  env.MCAH_SIGNER_TOKEN = sign.token
  await step('DB_MIGRATE', () => runScript('scripts/migrate.js', env, userData, logs.backend))
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
  runUpdate(mainWindow, { quiet: true })
  setInterval(() => runUpdate(mainWindow, { quiet: true }), 6 * 3600 * 1000)
}

// Tên máy trong mạng văn phòng (hiện ở màn ghép và Cài đặt): tên máy của hệ điều hành, chỉ chữ số và gạch.
const lanHostName = () => os.hostname().split('.')[0].replace(/[^A-Za-z0-9-]/g, '-').slice(0, 63) || 'MCAH'

// Mở cổng HTTPS cho máy nhân viên, quảng bá trong mạng (mDNS), không cho máy ngủ khi MCAH đang mở.
async function startLan() {
  if (!lan || lan.server || lan.starting) return
  lan.starting = true
  try {
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

// Trạng thái máy chính cho thẻ trong Cài đặt trên máy này (wireframe màn 6).
function lanStatus() {
  if (!lan?.server) return null
  const addresses = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address)
  return { name: lanHostName(), port: LAN_PORT, addresses, fingerprint: lan.fingerprint, keepAwake: Boolean(lan.blocker !== undefined && powerSaveBlocker.isStarted(lan.blocker)) }
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
