// App máy tính: thiếu LibreOffice trả 424 + code để giao diện mời cài; SMTP của máy chỉ nhận từ header khi chạy desktop.
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('xlsxToPdf khi máy chưa có LibreOffice', () => {
  beforeAll(() => {
    process.env.SOFFICE_PATH = '/khong-co/soffice'
  })
  it('trả 424 PDF_COMPONENT_MISSING (không phải 5xx bị giấu câu báo)', async () => {
    const { xlsxToPdf } = require('../xlsx_pdf')
    await expect(xlsxToPdf([Buffer.from('x')])).rejects.toMatchObject({ statusCode: 424, code: 'PDF_COMPONENT_MISSING' })
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
