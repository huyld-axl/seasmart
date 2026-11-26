// Chuyển file Excel đã điền sang PDF.
// - App máy tính: dựng sheet chính thành trang HTML (giống bản xem trước) và nhờ tiến trình chính in bằng Chromium của
//   app (desktop/src/pdf-printer.js, MCAH_PDF_URL + MCAH_PDF_TOKEN). Không cần cài gì thêm, chạy mọi hệ điều hành.
// - Bản web: LibreOffice chạy ngầm (soffice --headless) trên máy chủ; đặt SOFFICE_PATH trong .env nếu lệnh không phải `soffice`.

const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const ExcelJS = require('exceljs')
const { tmpRoot } = require('./tmp_dir')
const { sheetToPrintHtml } = require('./sheet_html')

const SOFFICE = process.env.SOFFICE_PATH || 'soffice'
const PDF_URL = process.env.MCAH_PDF_URL || ''
const PDF_TOKEN = process.env.MCAH_PDF_TOKEN || ''
const TIMEOUT_MS = 120000
// Hồ sơ LibreOffice riêng để không đụng bản đang mở trên máy; dùng lại giữa các lần cho nhanh.
const PROFILE_DIR = path.join(os.tmpdir(), 'mcah-soffice-profile')
const FAILED = { statusCode: 500, message: 'Không chuyển được sang PDF. Thử lại hoặc tải bản Excel.' }

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(SOFFICE, args, { timeout: TIMEOUT_MS }, (error) => (error ? reject(FAILED) : resolve()))
  })
}

async function convertWithSoffice(buffers) {
  const dir = await fs.mkdtemp(path.join(tmpRoot(), 'pdf-'))
  try {
    const inputs = buffers.map((_, i) => path.join(dir, `${i}.xlsx`))
    await Promise.all(buffers.map((buffer, i) => fs.writeFile(inputs[i], buffer)))
    await run(['--headless', '--norestore', `-env:UserInstallation=${pathToFileURL(PROFILE_DIR).href}`, '--convert-to', 'pdf', '--outdir', dir, ...inputs])
    return await Promise.all(buffers.map((_, i) => fs.readFile(path.join(dir, `${i}.pdf`)).catch(() => null)))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

// Sheet chính = sheet đầu tiên còn hiện (layoutForPdf đã ẩn các sheet khác).
async function printPage(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets.find((sheet) => sheet.state === 'visible') || wb.worksheets[0]
  return sheetToPrintHtml(ws, wb)
}

async function convertWithPrinter(buffers) {
  const pages = await Promise.all(buffers.map(printPage))
  let res
  try {
    res = await fetch(`${PDF_URL}/pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pdf-token': PDF_TOKEN },
      body: JSON.stringify({ pages }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw FAILED
  }
  if (!res.ok) throw FAILED
  const { pdfs } = await res.json()
  return pdfs.map((pdf) => (pdf ? Buffer.from(pdf, 'base64') : null))
}

const convert = (buffers) => (PDF_URL ? convertWithPrinter(buffers) : convertWithSoffice(buffers))

// LibreOffice dùng chung một hồ sơ, Chromium dùng chung một cửa sổ in: chạy lần lượt từng yêu cầu.
let queue = Promise.resolve()

// Nhận mảng Buffer .xlsx, trả mảng Buffer .pdf cùng thứ tự (null nếu file đó không chuyển được).
function xlsxToPdf(buffers) {
  const result = queue.then(() => convert(buffers))
  queue = result.catch(() => {})
  return result
}

module.exports = { xlsxToPdf }
