// PostgreSQL nhúng: thư mục dữ liệu nằm trong userData của app, chỉ nghe 127.0.0.1, mật khẩu ngẫu nhiên.
// Gọi thẳng initdb / pg_ctl / postgres (bản lấy từ gói @embedded-postgres, khi đóng gói nằm ở resources/postgres):
// thư viện embedded-postgres tính đường dẫn từ trong app.asar nên không chạy được khi đã đóng gói.
// Giai đoạn 0: mật khẩu cất trong tệp quyền 0600; giai đoạn 4 chuyển sang két hệ điều hành.
const path = require('path')
const fs = require('fs')
const net = require('net')
const crypto = require('crypto')
const { execFile, spawn } = require('child_process')
const { postgresBin, EXE } = require('./paths')

const DB_NAME = 'seasmart'
const DB_USER = 'seasmart'
const bin = (name) => path.join(postgresBin, name + EXE)

// Hỏi hệ điều hành một cổng trống trên 127.0.0.1.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

function readOrCreateSecret(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const secret = crypto.randomBytes(24).toString('base64url')
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

function run(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { maxBuffer: 1e7 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${path.basename(file)}: ${stderr || error.message}`))
      else resolve(stdout)
    })
    if (input !== undefined) child.stdin.end(input)
  })
}

// PID của postmaster đang giữ thư mục dữ liệu (dòng 1 của postmaster.pid), null nếu không còn chạy.
function runningPostmaster(dataDir) {
  try {
    const pid = parseInt(fs.readFileSync(path.join(dataDir, 'postmaster.pid'), 'utf8').split('\n')[0], 10)
    process.kill(pid, 0)
    return pid
  } catch {
    return null
  }
}

// Gửi SIGINT (tắt nhanh, an toàn) cho postmaster rồi chờ nó thoát. Dùng khi lần trước app chết đột ngột.
async function stopStale(dataDir) {
  const pid = runningPostmaster(dataDir)
  if (!pid) return
  process.kill(pid, 'SIGINT')
  for (let i = 0; i < 100 && runningPostmaster(dataDir); i++) await new Promise((r) => setTimeout(r, 100))
}

// Tắt đồng bộ, dùng được trong process.on('exit') khi không còn chờ promise được.
function killNow(dataDir) {
  const pid = runningPostmaster(dataDir)
  if (pid) process.kill(pid, 'SIGINT')
}

// Lần đầu: tạo cụm dữ liệu (chỉ chủ tài khoản hệ điều hành đọc được) và CSDL, khi Postgres chưa mở cổng nào.
async function initCluster(dataDir, password) {
  const pwFile = path.join(path.dirname(dataDir), '.pw-init')
  fs.writeFileSync(pwFile, password, { mode: 0o600 })
  try {
    await run(bin('initdb'), ['-D', dataDir, '-U', DB_USER, '--pwfile', pwFile, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C.UTF-8'])
  } finally {
    fs.rmSync(pwFile, { force: true })
  }
  await run(bin('postgres'), ['--single', '-D', dataDir, 'postgres'], `CREATE DATABASE ${DB_NAME};\n`)
}

async function startDatabase(userData) {
  const dataDir = path.join(userData, 'pgdata')
  await stopStale(dataDir)
  const password = readOrCreateSecret(path.join(userData, 'db-secret'))
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) await initCluster(dataDir, password)
  const port = await freePort()
  const child = spawn(bin('postgres'), ['-D', dataDir, '-p', String(port), '-c', 'listen_addresses=127.0.0.1'], { stdio: 'ignore' })
  child.on('error', () => {})
  // Chờ Postgres nhận kết nối.
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) throw new Error(`Postgres thoát khi khởi động (mã ${child.exitCode})`)
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, '127.0.0.1', () => s.end(() => resolve(true)))
      s.on('error', () => resolve(false))
    })
    if (ok && runningPostmaster(dataDir)) break
    if (i > 300) throw new Error('Postgres không khởi động sau 30 giây')
    await new Promise((r) => setTimeout(r, 100))
  }
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', resolve)
    child.kill('SIGINT')
  })
  const env = { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER, DB_PASSWORD: password, DB_NAME }
  return { pg: { stop }, env, dataDir }
}

const isRunning = (userData) => runningPostmaster(path.join(userData, 'pgdata')) !== null

module.exports = { startDatabase, killNow, freePort, isRunning }
