// Kiểm thử tích hợp trên DB riêng (không chạy khi thiếu INTEGRATION_DB_NAME).
// Chạy: INTEGRATION_DB_NAME=marineport_g15 npm test
// Nhà cung cấp AI chỉ được giả lập ở đây bằng vi.spyOn; ứng dụng không có đường chạy trả kết quả soạn sẵn.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
const DB_NAME = process.env.INTEGRATION_DB_NAME
const enabled = Boolean(DB_NAME) && DB_NAME !== 'marineport'

let pool, ai, documentService, makePdf, sharp, uploadDir

const asFile = (buffer, filename) => ({ toBuffer: async () => buffer, filename, file: { truncated: false } })

async function waitFor(check, label, timeoutMs = 15000) {
  const start = Date.now()
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() - start > timeoutMs) throw new Error(`Hết giờ chờ: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

// Kết quả đọc giả: một chứng chỉ rõ ràng.
const CERT_READING = {
  doc_type: 'certificate',
  page_label: '1 trang',
  fields: [
    { key: 'typeCode', raw: 'BST', value: 'BST', state: 'PROPOSED', note: '' },
    { key: 'valid', raw: '14/03/2028', value: '14/03/2028', state: 'PROPOSED', note: '' },
  ],
}

describe.skipIf(!enabled)('đường xử lý giấy tờ (DB tích hợp)', () => {
  let seafarerId

  beforeAll(async () => {
    process.env.DB_NAME = DB_NAME
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcah-upload-'))
    process.env.UPLOAD_DIR = uploadDir
    pool = require('../../config/db')
    const [[db]] = await pool.query('SELECT DATABASE() AS name')
    if (db.name !== DB_NAME) throw new Error(`Đang nối nhầm DB ${db.name}`)
    ai = require('../ai')
    ;({ documentService } = require('../document.service'))
    ;({ makePdf } = require('../../../test_support/make_pdf'))
    sharp = require('sharp')
    const [[row]] = await pool.query('SELECT id FROM seafarer WHERE deleted_at IS NULL ORDER BY id LIMIT 1')
    seafarerId = row.id
    await cleanup()
  })

  async function cleanup() {
    await pool.query('DELETE f FROM document_field f JOIN seafarer_document d ON d.id = f.document_id WHERE d.seafarer_id = ?', [seafarerId])
    await pool.query('DELETE FROM ai_call')
    await pool.query('DELETE FROM seafarer_document WHERE seafarer_id = ?', [seafarerId])
    await pool.query('DELETE p FROM document_upload_page p JOIN document_upload u ON u.id = p.upload_id WHERE u.seafarer_id = ?', [seafarerId])
    await pool.query('DELETE FROM document_upload WHERE seafarer_id = ?', [seafarerId])
  }

  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup()
    await pool.end()
    fs.rmSync(uploadDir, { recursive: true, force: true })
  })

  function fakeAi(readings) {
    vi.spyOn(ai, 'isConfigured').mockReturnValue(true)
    return vi.spyOn(ai, 'callVision').mockImplementation(async () => ({
      data: typeof readings === 'function' ? readings() : readings,
      model: 'fake-model', usage: { input: 100, output: 10 }, requestId: 'req_test', latencyMs: 5,
    }))
  }

  const uniquePdf = (pages) => makePdf(pages.map((text) => `${text} ${crypto.randomBytes(4).toString('hex')}`))

  it('PDF 10 trang thành 10 ảnh trang, một giấy, đọc xong thì upload DONE', async () => {
    const callVision = fakeAi(CERT_READING)
    const pdf = uniquePdf(Array.from({ length: 10 }, (_, i) => `Trang ${i + 1}`))
    const upload = await documentService.upload(seafarerId, asFile(pdf, 'sach.pdf'), 1)
    expect(upload).toMatchObject({ file_name: 'sach.pdf', mime_type: 'application/pdf', status: 'RECEIVED' })

    await waitFor(async () => (await documentService.getUpload(upload.id)).status === 'DONE', 'upload DONE')
    const done = await documentService.getUpload(upload.id)
    expect(done).toMatchObject({ page_count: 10, document_count: 1, error: null })

    const [pages] = await pool.query('SELECT * FROM document_upload_page WHERE upload_id = ? ORDER BY page_no', [upload.id])
    expect(pages.map((p) => p.page_no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const page of pages) {
      expect(fs.existsSync(page.image_path)).toBe(true)
      expect(fs.existsSync(page.thumb_path)).toBe(true)
      expect((await sharp(page.image_path).metadata()).format).toBe('jpeg')
    }

    const docs = await documentService.list(seafarerId)
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ upload_id: upload.id, page_from: 1, page_to: 10, doc_type: 'certificate', file_name: 'sach.pdf', type_source: 'AI' })
    // Giấy được đọc từ ảnh trang, không phải PDF.
    const images = callVision.mock.calls[0][0].images
    expect(images).toHaveLength(10)
    expect(images.every((image) => image.mimeType === 'image/jpeg')).toBe(true)
    // Nhật ký ai_call có số liệu, không có nội dung.
    const [calls] = await pool.query('SELECT * FROM ai_call WHERE upload_id = ?', [upload.id])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ status: 'OK', input_tokens: 100, output_tokens: 10, request_id: 'req_test', model: 'fake-model' })
  })

  it('thả trùng tệp thì trả tệp đã có; xoá rồi thả lại thì được', async () => {
    fakeAi(CERT_READING)
    const pdf = uniquePdf(['Một trang'])
    const first = await documentService.upload(seafarerId, asFile(pdf, 'a.pdf'), 1)
    await waitFor(async () => (await documentService.getUpload(first.id)).status === 'DONE', 'upload DONE')
    const again = await documentService.upload(seafarerId, asFile(pdf, 'doi-ten.pdf'), 1)
    expect(again).toMatchObject({ id: first.id, duplicate: true })
    const [[count]] = await pool.query('SELECT COUNT(*) AS n FROM document_upload WHERE seafarer_id = ? AND sha256 = ?', [seafarerId, crypto.createHash('sha256').update(pdf).digest('hex')])
    expect(count.n).toBe(1)

    await documentService.removeUpload(first.id)
    const third = await documentService.upload(seafarerId, asFile(pdf, 'a.pdf'), 1)
    expect(third.id).not.toBe(first.id)
    expect(third.duplicate).toBeUndefined()
    await waitFor(async () => (await documentService.getUpload(third.id)).status === 'DONE', 'upload DONE')
  })

  it('ảnh JPG là một trang; PDF hỏng thì upload FAILED kèm lý do', async () => {
    fakeAi(CERT_READING)
    const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: crypto.randomInt(255), g: 9, b: 9 } } }).jpeg().toBuffer()
    const image = await documentService.upload(seafarerId, asFile(jpg, 'anh.jpg'), 1)
    await waitFor(async () => (await documentService.getUpload(image.id)).status === 'DONE', 'ảnh DONE')
    expect((await documentService.getUpload(image.id)).page_count).toBe(1)

    // Có đủ magic bytes %PDF nhưng thân hỏng.
    const broken = Buffer.from(`%PDF-1.4 hỏng ${crypto.randomBytes(4).toString('hex')}`)
    const bad = await documentService.upload(seafarerId, asFile(broken, 'hong.pdf'), 1)
    await waitFor(async () => (await documentService.getUpload(bad.id)).status === 'FAILED', 'upload FAILED')
    expect((await documentService.getUpload(bad.id)).error).toMatch(/PDF/)
  })

  it('chưa cấu hình AI: cắt trang vẫn xong, giấy báo chưa cấu hình, không giả kết quả', async () => {
    vi.restoreAllMocks()
    vi.spyOn(ai, 'isConfigured').mockReturnValue(false)
    const callVision = vi.spyOn(ai, 'callVision')
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['Chưa cấu hình']), 'x.pdf'), 1)
    await waitFor(async () => (await documentService.getUpload(upload.id)).status === 'DONE', 'upload DONE')
    const [doc] = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(doc.status).toBe('FAILED')
    expect(doc.error).toMatch(/chưa được cấu hình/)
    expect(callVision).not.toHaveBeenCalled()
  })

  it('khôi phục: upload kẹt quá 5 phút được xử lý lại, giấy cũ chưa có trang tự cắt trang khi đọc', async () => {
    fakeAi(CERT_READING)
    // Upload kẹt giữa chừng: có tệp gốc, chưa có trang, đang SPLITTING từ 10 phút trước.
    const pdf = uniquePdf(['Kẹt 1', 'Kẹt 2'])
    const dir = path.join(uploadDir, 'documents', String(seafarerId))
    fs.mkdirSync(dir, { recursive: true })
    const stuckPath = path.join(dir, `stuck_${crypto.randomBytes(4).toString('hex')}.pdf`)
    fs.writeFileSync(stuckPath, pdf)
    const [r] = await pool.query(
      `INSERT INTO document_upload (seafarer_id, file_name, mime_type, file_size, storage_path, sha256, status, updated_at)
       VALUES (?, 'ket.pdf', 'application/pdf', ?, ?, ?, 'SPLITTING', NOW() - INTERVAL 10 MINUTE)`,
      [seafarerId, pdf.length, stuckPath, crypto.createHash('sha256').update(pdf).digest('hex')]
    )
    // Một upload bận nhưng mới (1 phút): không được đụng vào.
    const [fresh] = await pool.query(
      `INSERT INTO document_upload (seafarer_id, file_name, mime_type, file_size, storage_path, sha256, status, updated_at)
       VALUES (?, 'moi.pdf', 'application/pdf', 1, '/khong/co', ?, 'SPLITTING', NOW() - INTERVAL 1 MINUTE)`,
      [seafarerId, crypto.randomBytes(32).toString('hex')]
    )
    // Giấy cũ (trước khi có bảng upload) kẹt READING, tệp gốc trên chính dòng giấy.
    const legacyPdf = uniquePdf(['Giấy cũ'])
    const legacyPath = path.join(dir, `legacy_${crypto.randomBytes(4).toString('hex')}.pdf`)
    fs.writeFileSync(legacyPath, legacyPdf)
    const [legacyUpload] = await pool.query(
      `INSERT INTO document_upload (seafarer_id, file_name, mime_type, file_size, storage_path, status) VALUES (?, 'cu.pdf', 'application/pdf', ?, ?, 'DONE')`,
      [seafarerId, legacyPdf.length, legacyPath]
    )
    const [legacyDoc] = await pool.query(
      `INSERT INTO seafarer_document (seafarer_id, upload_id, status, updated_at) VALUES (?, ?, 'READING', NOW() - INTERVAL 10 MINUTE)`,
      [seafarerId, legacyUpload.insertId]
    )

    const queued = await documentService.recoverStalled()
    expect(queued).toEqual({ uploads: 1, documents: 1 })
    await waitFor(async () => (await documentService.getUpload(r.insertId)).status === 'DONE', 'upload kẹt DONE')
    expect((await documentService.getUpload(r.insertId)).page_count).toBe(2)
    await waitFor(async () => (await documentService.get(legacyDoc.insertId)).status !== 'READING', 'giấy cũ đọc xong')
    expect((await documentService.get(legacyDoc.insertId)).doc_type).toBe('certificate')
    const [[pagesOfLegacy]] = await pool.query('SELECT COUNT(*) AS n FROM document_upload_page WHERE upload_id = ?', [legacyUpload.insertId])
    expect(pagesOfLegacy.n).toBe(1)
    expect((await documentService.getUpload(fresh.insertId)).status).toBe('SPLITTING')
  })
})
