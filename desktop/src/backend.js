// Chạy Fastify của backend/ trong tiến trình con bằng Node thường, không dùng Node của Electron:
// trên Linux, sharp đọc JPEG trong Electron bị segfault (xung đột thư viện JPEG). Bản đóng gói kèm file Node riêng.
// Cấu hình truyền hết qua biến môi trường; thư mục làm việc là userData nên dotenv không đọc nhầm backend/.env.
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')

const { backendDir: BACKEND_DIR, formsDir, nodeBin: NODE_BIN } = require('./paths')
// Node chạy backend phải cùng bản lớn với Node đã cài node_modules của backend (module biên dịch sẵn).
// Node riêng không đọc được trong app.asar, nên tệp canh này được để ngoài gói (asarUnpack).
const GUARD = path.join(__dirname, 'backend-guard.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)

function readOrCreateSecret(file, bytes) {
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const secret = crypto.randomBytes(bytes).toString('base64url')
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

// soffice: đường dẫn LibreOffice đã dò; null thì đặt một đường dẫn không có để backend trả lỗi
// "Cần cài thành phần xuất PDF" (không chạy nhầm `soffice` lạ trên PATH). mailDir: thư mục gửi thư (mail.js).
// filesDir: thư mục hồ sơ dễ đọc (docs/mcah-ke-hoach-desktop-gd4.md 3.2, Q-B2: Tài liệu/MCAH - Hồ sơ).
// Thư mục tạm của app (<userData>/tmp) xoá sạch mỗi lần khởi động.
function backendEnv(userData, dbEnv, port, { soffice = null, mailDir, filesDir = null } = {}) {
  const uploadDir = path.join(userData, 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })
  const tmpDir = path.join(userData, 'tmp')
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  return {
    ...dbEnv,
    NODE_ENV: 'production',
    MCAH_DESKTOP: '1',
    // AI đọc giấy tờ, tra IMO, danh mục tàu chạy ở máy chủ dịch vụ MCAH (bộ cài không có khoá).
    AI_PROVIDER: 'cloud',
    VESSEL_LOOKUP_PROVIDER: 'cloud',
    SOFFICE_PATH: soffice || path.join(userData, 'chua-cai-libreoffice', 'soffice'),
    MAIL_DIR: mailDir,
    HOST: '127.0.0.1',
    PORT: String(port),
    JWT_SECRET: readOrCreateSecret(path.join(userData, 'jwt-secret'), 48),
    UPLOAD_DIR: uploadDir,
    // Backend đã gom thành khối (giai đoạn 5): đường dẫn mẫu thư, migration… tính từ đây.
    MCAH_BACKEND_ROOT: BACKEND_DIR,
    MCAH_TMP_DIR: tmpDir,
    ...(filesDir ? { MCAH_FILES_DIR: filesDir } : {}),
    FORMS_DIR: formsDir,
  }
}

// Đầu ra của tiến trình con đi vào log (rotatingLog) nếu có, không thì ra terminal.
const pipeTo = (child, log) => {
  if (!log) return
  child.stdout.on('data', (d) => log.write(d))
  child.stderr.on('data', (d) => log.write(d))
}

// Chạy một script của backend tới khi xong (vd. migrate.js).
function runScript(script, env, cwd, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE_BIN, [path.join(BACKEND_DIR, script)], { cwd, env: { PATH: process.env.PATH, ...env }, stdio: log ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
    pipeTo(child, log)
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} thoát với mã ${code}`))))
  })
}

// Mở tiến trình Fastify, chờ /health trả lời rồi mới trả về.
async function startBackend(env, cwd, log) {
  const child = spawn(NODE_BIN, ['-r', GUARD, path.join(BACKEND_DIR, 'server.js')], {
    cwd,
    env: { PATH: process.env.PATH, ...env },
    stdio: ['pipe', log ? 'pipe' : 'inherit', log ? 'pipe' : 'inherit'],
  })
  pipeTo(child, log)
  let exited = false
  child.on('exit', (code, signal) => {
    exited = true
    console.error(`Tiến trình Fastify thoát, mã ${code ?? signal}`)
  })
  const url = `http://127.0.0.1:${env.PORT}`
  for (let i = 0; i < 300; i++) {
    if (exited) throw new Error('Fastify thoát khi đang khởi động')
    try {
      if ((await fetch(`${url}/health`)).ok) return { child, url }
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  child.kill()
  throw new Error('Fastify không trả lời /health sau 30 giây')
}

module.exports = { backendEnv, runScript, startBackend }
