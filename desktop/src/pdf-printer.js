// Cổng in PDF nội bộ: thay LibreOffice, dùng Chromium có sẵn trong Electron (chạy giống nhau trên Windows, Ubuntu, macOS).
// Backend dựng mỗi form thành trang HTML in được (backend/src/utils/sheet_html.js sheetToPrintHtml) rồi gửi
// POST http://127.0.0.1:<cổng>/pdf { pages: [{ html, footer }] } kèm x-pdf-token (mã ngẫu nhiên mỗi lần chạy app);
// tiến trình chính in từng trang trong cửa sổ ẩn (không chạy script, không ra mạng), trả { pdfs: [base64] } cùng thứ tự.
const fs = require('fs')
const path = require('path')
const http = require('http')
const crypto = require('crypto')
const { BrowserWindow, session } = require('electron')

const MAX_BODY = 60 * 1024 * 1024
const PARTITION = 'pdf-printer'

let win = null
let queue = Promise.resolve()

function printerWindow() {
  if (win && !win.isDestroyed()) return win
  const ses = session.fromPartition(PARTITION)
  // Trang in chỉ đọc tệp tạm của chính nó và ảnh nhúng sẵn (data:), không gọi ra ngoài.
  ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !/^(file|data):/.test(details.url) }))
  win = new BrowserWindow({ show: false, webPreferences: { partition: PARTITION, javascript: false, sandbox: true, contextIsolation: true } })
  return win
}

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Chân trang của Excel ("Page &P", "&L…&C…&R…") → mẫu chân trang của Chromium. Chỉ hiểu số trang, tổng số trang và chữ.
function footerTemplate(footer) {
  if (!footer) return null
  const parts = { L: '', C: '', R: '' }
  let side = 'C'
  for (const piece of String(footer).split(/(&[LCR])/)) {
    if (/^&[LCR]$/.test(piece)) side = piece[1]
    else parts[side] += piece
  }
  const text = (s) => esc(s.replace(/&"[^"]*"|&\d+|&[BIUSE]/g, '')).replace(/&amp;P/g, '<span class="pageNumber"></span>').replace(/&amp;N/g, '<span class="totalPages"></span>').replace(/&amp;&amp;/g, '&amp;')
  const cell = (s, align) => `<div style="flex:1;text-align:${align}">${text(s)}</div>`
  return `<div style="width:100%;display:flex;font:9px 'Times New Roman',serif;padding:0 0.4in">${cell(parts.L, 'left')}${cell(parts.C, 'center')}${cell(parts.R, 'right')}</div>`
}

async function printOne(page, dir) {
  const file = path.join(dir, `${crypto.randomUUID()}.html`)
  fs.writeFileSync(file, page.html)
  try {
    const w = printerWindow()
    await w.loadFile(file)
    const footer = footerTemplate(page.footer)
    return await w.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      ...(footer ? { displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer } : {}),
    })
  } finally {
    fs.rmSync(file, { force: true })
  }
}

// Mỗi lần in một trang: một cửa sổ ẩn dùng chung, nên xếp hàng.
function printAll(pages, dir) {
  const run = queue.then(async () => {
    const out = []
    for (const page of pages) out.push(await printOne(page, dir))
    return out
  })
  queue = run.catch(() => {})
  return run
}

// tmpDir: thư mục tạm của app (xoá sạch mỗi lần mở app).
function start({ tmpDir }) {
  const token = crypto.randomBytes(24).toString('base64url')
  const dir = path.join(tmpDir, 'pdf')
  const server = http.createServer((req, res) => {
    const reply = (status, data) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data))
    if (req.method !== 'POST' || req.url !== '/pdf') return reply(404, {})
    const given = Buffer.from(String(req.headers['x-pdf-token'] || ''))
    if (given.length !== token.length || !crypto.timingSafeEqual(given, Buffer.from(token))) return reply(401, {})
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) req.destroy()
      else chunks.push(chunk)
    })
    req.on('end', async () => {
      try {
        const { pages } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!Array.isArray(pages) || !pages.length || pages.some((p) => typeof p?.html !== 'string')) return reply(400, { error: 'Yêu cầu in không hợp lệ' })
        fs.mkdirSync(dir, { recursive: true })
        const pdfs = await printAll(pages, dir)
        reply(200, { pdfs: pdfs.map((pdf) => pdf.toString('base64')) })
      } catch (error) {
        reply(500, { error: error.message })
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, token, close: () => server.close() }))
  })
}

module.exports = { start, footerTemplate }
