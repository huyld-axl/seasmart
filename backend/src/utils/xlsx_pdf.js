// Chuyển file Excel đã điền sang PDF bằng LibreOffice chạy ngầm (soffice --headless).
// Máy chủ cần cài LibreOffice; đặt SOFFICE_PATH trong .env nếu lệnh không phải `soffice`.

const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const SOFFICE = process.env.SOFFICE_PATH || 'soffice'
const TIMEOUT_MS = 120000
// Hồ sơ LibreOffice riêng để không đụng bản đang mở trên máy; dùng lại giữa các lần cho nhanh.
const PROFILE_DIR = path.join(os.tmpdir(), 'mcah-soffice-profile')

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(SOFFICE, args, { timeout: TIMEOUT_MS }, (error) => {
      if (!error) return resolve()
      if (error.code === 'ENOENT') return reject({ statusCode: 501, message: 'Máy chủ chưa cài LibreOffice nên chưa xuất được PDF. Hãy tải bản Excel.' })
      return reject({ statusCode: 500, message: 'Không chuyển được sang PDF. Thử lại hoặc tải bản Excel.' })
    })
  })
}

async function convert(buffers) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcah-pdf-'))
  try {
    const inputs = buffers.map((_, i) => path.join(dir, `${i}.xlsx`))
    await Promise.all(buffers.map((buffer, i) => fs.writeFile(inputs[i], buffer)))
    await run(['--headless', '--norestore', `-env:UserInstallation=file://${PROFILE_DIR}`, '--convert-to', 'pdf', '--outdir', dir, ...inputs])
    return await Promise.all(buffers.map((_, i) => fs.readFile(path.join(dir, `${i}.pdf`)).catch(() => null)))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

// LibreOffice dùng chung một hồ sơ nên chạy lần lượt từng yêu cầu.
let queue = Promise.resolve()

// Nhận mảng Buffer .xlsx, trả mảng Buffer .pdf cùng thứ tự (null nếu file đó không chuyển được).
function xlsxToPdf(buffers) {
  const result = queue.then(() => convert(buffers))
  queue = result.catch(() => {})
  return result
}

module.exports = { xlsxToPdf }
