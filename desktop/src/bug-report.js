// Báo lỗi khi app không mở được: gom thông tin máy + phần cuối các tệp log (đã ẩn thông tin cá nhân) rồi gửi lên máy chủ
// dịch vụ (cloud/src/routes/bug_report.js). Không có mạng thì lưu thành tệp .txt để người dùng gửi tay.
// Hàm thuần, không phụ thuộc Electron: main.js đưa thông tin vào (dễ thử).
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const { scrub } = require('./logs')

const TAIL_BYTES = 200 * 1024
// Chỉ các log này; không bao giờ đọc thư mục dữ liệu, khoá, DB.
const LOG_FILES = ['main.log', 'main.log.1', 'backend.log', 'backend.log.1', 'postgres.log']

// Tên tài khoản Windows / Linux nằm trong đường dẫn (C:\Users\An\..., /home/an/...) cũng là thông tin cá nhân.
const scrubPaths = (text) => text.replace(/([\\/](?:Users|home)[\\/])[^\\/\r\n"')]+/gi, '$1[user]')
// Từng dòng, dòng quá dài bị cắt: các regex ẩn email / số giấy chậm theo bình phương trên một dòng dài không ngắt.
const MAX_LINE = 2000
const clean = (text) => text.split('\n').map((line) => scrubPaths(scrub(line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}[…]` : line))).join('\n')

function tail(file) {
  try {
    const { size } = fs.statSync(file)
    const fd = fs.openSync(file, 'r')
    try {
      const length = Math.min(size, TAIL_BYTES)
      const buf = Buffer.alloc(length)
      fs.readSync(fd, buf, 0, length, size - length)
      return (size > length ? '[…cắt bớt phần đầu…]\n' : '') + buf.toString('utf8')
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

// Chỗ trống ổ đĩa và trạng thái thư mục dữ liệu Postgres: hai nguyên nhân hay gặp của lỗi mở app.
function diskInfo(userData) {
  const info = {}
  try {
    const s = fs.statfsSync(userData)
    info.freeGB = Math.round((s.bavail * s.bsize) / 1e8) / 10
  } catch {}
  const pgdata = path.join(userData, 'pgdata')
  info.pgdata = { exists: fs.existsSync(pgdata), postmasterPid: fs.existsSync(path.join(pgdata, 'postmaster.pid')) }
  return info
}

function build({ userData, errorCode, errorMessage, at, note, appVersion, packaged }) {
  const files = {}
  for (const name of LOG_FILES) {
    const text = tail(path.join(userData, 'logs', name))
    if (text !== null) files[name] = clean(text)
  }
  const meta = {
    errorCode: errorCode || 'UNKNOWN',
    errorMessage: clean(String(errorMessage || '')).slice(0, 2000),
    at: at || new Date().toISOString(),
    note: String(note || '').slice(0, 2000),
    appVersion,
    packaged: Boolean(packaged),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osVersion: typeof os.version === 'function' ? os.version() : '',
    cpu: `${os.cpus()[0]?.model || '?'} × ${os.cpus().length}`,
    memGB: { total: Math.round(os.totalmem() / 1e8) / 10, free: Math.round(os.freemem() / 1e8) / 10 },
    versions: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
    disk: diskInfo(userData),
    sentAt: new Date().toISOString(),
  }
  return { meta, files }
}

// Cùng dạng với trang quản trị tải về: thông tin máy rồi từng tệp log.
const toText = ({ meta, files }) => [JSON.stringify(meta, null, 2), ...Object.entries(files).map(([name, content]) => `\n===== ${name} =====\n${content}`)].join('\n')

async function send(report, cloudUrl, fetchImpl = fetch) {
  const res = await fetchImpl(`${cloudUrl}/api/bug-report`, {
    method: 'POST',
    headers: { 'content-type': 'application/gzip' },
    body: zlib.gzipSync(JSON.stringify(report)),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Máy chủ trả ${res.status}`)
  return (await res.json()).id
}

// Gửi; lỗi mạng / máy chủ thì lưu tệp vào thư mục `dir` (Tải xuống) và trả đường dẫn.
async function sendOrSave(report, { cloudUrl, dir, fetchImpl }) {
  try {
    return { status: 'sent', id: await send(report, cloudUrl, fetchImpl) }
  } catch (error) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const file = path.join(dir, `mcah-bao-loi-${stamp}.txt`)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, toText(report))
    return { status: 'saved', path: file, reason: error.message }
  }
}

module.exports = { build, toText, send, sendOrSave }
