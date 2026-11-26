// App máy tính: PDF in qua cổng in của app (Chromium), không cần LibreOffice; SMTP của máy chỉ nhận từ header khi chạy desktop.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import http from 'http'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')

async function sampleXlsx() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Mẫu')
  ws.getCell('A1').value = 'Xin chào'
  ws.getCell('A2').value = { richText: [{ font: { name: 'Wingdings' }, text: '\uf071' }, { font: { name: 'Times New Roman' }, text: ' Loại' }] }
  ws.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.4, bottom: 0.3, header: 0.2, footer: 0.2 } }
  ws.headerFooter = { oddFooter: 'Page &P' }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('xlsxToPdf trong app máy tính', () => {
  let server
  let received = null
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        if (req.headers['x-pdf-token'] !== 'ma-thu') return res.writeHead(401).end('{}')
        received = JSON.parse(raw)
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ pdfs: received.pages.map(() => Buffer.from('%PDF-thu').toString('base64')) }))
      })
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    process.env.MCAH_PDF_URL = `http://127.0.0.1:${server.address().port}`
    process.env.MCAH_PDF_TOKEN = 'ma-thu'
    delete require.cache[require.resolve('../xlsx_pdf')]
  })
  afterAll(() => {
    server.close()
    delete process.env.MCAH_PDF_URL
    delete process.env.MCAH_PDF_TOKEN
    delete require.cache[require.resolve('../xlsx_pdf')]
  })

  it('gửi trang in (khổ A4, lề, chân trang) tới cổng in và trả PDF cùng thứ tự', async () => {
    const { xlsxToPdf } = require('../xlsx_pdf')
    const pdfs = await xlsxToPdf([await sampleXlsx(), await sampleXlsx()])
    expect(pdfs.map((b) => b.toString())).toEqual(['%PDF-thu', '%PDF-thu'])
    expect(received.pages).toHaveLength(2)
    const page = received.pages[0]
    expect(page.footer).toBe('Page &P')
    expect(page.html).toContain('@page{size:A4 portrait;margin:0.4in 0.5in 0.3in 0.5in}')
    expect(page.html).toContain('Xin chào')
    // Ký hiệu Wingdings thành ký tự Unicode, không còn tên phông Wingdings.
    expect(page.html).toContain('❑')
    expect(page.html).not.toContain('Wingdings')
  })
})

describe('desktopSmtp', () => {
  const smtp = { host: 'smtp.gmail.com', port: 465, secure: true, user: 'a@b.vn', password: 'p' }
  const header = Buffer.from(JSON.stringify(smtp)).toString('base64')
  const load = (desktop) => {
    process.env.JWT_SECRET ||= 'x'.repeat(40)
    const config = require('../../config')
    config.desktop = desktop
    return require('../desktop_smtp').desktopSmtp
  }

  it('đọc cấu hình từ header khi chạy desktop và yêu cầu từ máy này', () => {
    expect(load(true)({ headers: { 'x-mcah-smtp': header }, ip: '127.0.0.1' })).toEqual(smtp)
  })
  it('bỏ qua khi là bản web, khi yêu cầu từ máy khác, khi header hỏng', () => {
    expect(load(false)({ headers: { 'x-mcah-smtp': header }, ip: '127.0.0.1' })).toBeNull()
    expect(load(true)({ headers: { 'x-mcah-smtp': header }, ip: '10.0.0.5' })).toBeNull()
    expect(load(true)({ headers: { 'x-mcah-smtp': 'không-phải-base64-json' }, ip: '127.0.0.1' })).toBeNull()
  })
})
