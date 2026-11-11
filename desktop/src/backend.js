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

function backendEnv(userData, dbEnv, port) {
  const uploadDir = path.join(userData, 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })
  return {
    ...dbEnv,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    JWT_SECRET: readOrCreateSecret(path.join(userData, 'jwt-secret'), 48),
    UPLOAD_DIR: uploadDir,
    FORMS_DIR: formsDir,
  }
}

// Chạy một script của backend tới khi xong (vd. migrate.js).
function runScript(script, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE_BIN, [path.join(BACKEND_DIR, script)], { cwd, env: { PATH: process.env.PATH, ...env }, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} thoát với mã ${code}`))))
  })
}

// Mở tiến trình Fastify, chờ /health trả lời rồi mới trả về.
async function startBackend(env, cwd) {
  const child = spawn(NODE_BIN, ['-r', GUARD, path.join(BACKEND_DIR, 'server.js')], {
    cwd,
    env: { PATH: process.env.PATH, ...env },
    stdio: ['pipe', 'inherit', 'inherit'],
  })
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
