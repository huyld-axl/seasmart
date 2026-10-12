// Kiểm thử tích hợp trên DB riêng (không chạy khi thiếu INTEGRATION_DB_NAME).
// Chạy: INTEGRATION_DB_NAME=marineport_g15 npm test
// Nhà cung cấp AI chỉ được giả lập ở đây bằng vi.spyOn; ứng dụng không có đường chạy trả kết quả soạn sẵn.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
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
    { key: 'typeCode', raw: 'BASIC_TRAINING', value: 'BASIC_TRAINING', state: 'PROPOSED', note: '' },
    { key: 'valid', raw: '14/03/2028', value: '14/03/2028', state: 'PROPOSED', note: '' },
  ],
}

describe.skipIf(!enabled)('đường xử lý giấy tờ (DB tích hợp)', () => {
  let seafarerId
  let seafarer

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
    const [[row]] = await pool.query('SELECT id, full_name, full_name_en FROM seafarer WHERE deleted_at IS NULL ORDER BY id LIMIT 1')
    seafarerId = row.id
    seafarer = row
    await cleanup()
  })

  async function cleanup() {
    await pool.query('DELETE f FROM document_field f JOIN seafarer_document d ON d.id = f.document_id WHERE d.seafarer_id = ?', [seafarerId])
    await pool.query('DELETE FROM ai_call')
    await pool.query('DELETE FROM seafarer_document WHERE seafarer_id = ?', [seafarerId])
    await pool.query('DELETE p FROM document_upload_page p JOIN document_upload u ON u.id = p.upload_id WHERE u.seafarer_id = ?', [seafarerId])
    await pool.query('DELETE FROM document_upload WHERE seafarer_id = ?', [seafarerId])
  }

  beforeEach(() => vi.restoreAllMocks())

  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup()
    await pool.end()
    fs.rmSync(uploadDir, { recursive: true, force: true })
  })

  // Giả lập nhà cung cấp theo việc: split(pageNumbers) → mảng loại trang; read(task) → kết quả đọc.
  function fakeAi({ split = () => 'certificate', read = () => CERT_READING } = {}) {
    vi.spyOn(ai, 'isConfigured').mockReturnValue(true)
    return vi.spyOn(ai, 'callVision').mockImplementation(async (args) => {
      let data
      if (args.task === 'split') {
        const numbers = args.instructions.match(/trang số: ([\d, ]+)\./)[1].split(', ').map(Number)
        data = {
          pages: numbers.map((page, i) => {
            const item = split(page, i)
            const [type, group] = Array.isArray(item) ? item : [item, page]
            return { page, type, group, page_label: `Trang ${page}`, note: '' }
          }),
        }
      } else {
        data = read(args)
      }
      return { data, model: 'fake-model', usage: { input: 100, output: 10 }, requestId: 'req_test', latencyMs: 5 }
    })
  }

  const finished = (id) => async () => ['DONE', 'FAILED'].includes((await documentService.getUpload(id)).status)

  const uniquePdf = (pages) => makePdf(pages.map((text) => `${text} ${crypto.randomBytes(4).toString('hex')}`))

  it('PDF 10 trang → 10 ảnh trang, tách thành đúng các giấy, đọc từng giấy theo trang của nó', async () => {
    // 1 trang thông tin, 2 trang chức danh, chứng chỉ hai mặt (4-5), chứng chỉ một mặt (6), 4 trang khác.
    const layout = ['seaman_book_info', 'seaman_book_duty', 'seaman_book_duty', ['certificate', 1], ['certificate', 1], 'certificate']
    const callVision = fakeAi({
      split: (page) => layout[page - 1] || ['other', 50],
      read: (args) => (args.task === 'split' ? null : { ...CERT_READING, doc_type: 'certificate' }),
    })
    const pdf = uniquePdf(Array.from({ length: 10 }, (_, i) => `Trang ${i + 1}`))
    const upload = await documentService.upload(seafarerId, asFile(pdf, 'sach.pdf'), 1)
    expect(upload).toMatchObject({ file_name: 'sach.pdf', mime_type: 'application/pdf', status: 'RECEIVED' })

    await waitFor(finished(upload.id), 'upload xong')
    const done = await documentService.getUpload(upload.id)
    expect(done).toMatchObject({ status: 'DONE', page_count: 10, error: null })

    const [pages] = await pool.query('SELECT * FROM document_upload_page WHERE upload_id = ? ORDER BY page_no', [upload.id])
    expect(pages.map((p) => p.page_no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(pages.map((p) => p.split_type)).toEqual([
      'seaman_book_info', 'seaman_book_duty', 'seaman_book_duty', 'certificate', 'certificate', 'certificate', 'other', 'other', 'other', 'other',
    ])
    for (const p of pages) {
      expect(fs.existsSync(p.image_path)).toBe(true)
      expect(fs.existsSync(p.thumb_path)).toBe(true)
      expect((await sharp(p.image_path).metadata()).format).toBe('jpeg')
    }

    const docs = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(docs.map((d) => [d.doc_type, d.page_from, d.page_to, d.status === 'SKIPPED' ? 'SKIPPED' : 'read'])).toEqual([
      ['seaman_book_info', 1, 1, 'read'],
      ['seaman_book_duty', 2, 2, 'read'],
      ['seaman_book_duty', 3, 3, 'read'],
      ['certificate', 4, 5, 'read'],
      ['certificate', 6, 6, 'read'],
      ['other', 7, 10, 'SKIPPED'],
    ])
    expect(docs.every((d) => d.type_source === 'AI' && d.file_name === 'sach.pdf')).toBe(true)

    // Một lần tách (20 ảnh thu nhỏ trở xuống) + mỗi giấy chưa bỏ qua một lần đọc, đúng số trang của giấy.
    const reads = callVision.mock.calls.map((c) => c[0]).filter((a) => a.task !== 'split')
    expect(callVision.mock.calls.filter((c) => c[0].task === 'split')).toHaveLength(1)
    expect(reads.map((a) => a.images.length).sort()).toEqual([1, 1, 1, 1, 2])
    expect(reads.every((a) => a.images.every((image) => image.mimeType === 'image/jpeg'))).toBe(true)

    // Nhật ký ai_call có số liệu, không có nội dung giấy.
    const [calls] = await pool.query('SELECT * FROM ai_call WHERE upload_id = ?', [upload.id])
    expect(calls.filter((c) => c.task === 'split')).toHaveLength(1)
    expect(calls.every((c) => c.status === 'OK' && c.input_tokens === 100 && c.model === 'fake-model')).toBe(true)
    expect(calls.find((c) => c.task === 'split').prompt_version).toBe('split-1')
  })

  it('đọc theo loại: trang chức danh ra 12 ô kèm chức danh chuẩn hoá, chứng chỉ ra khuôn nhẹ, cảnh báo giấy của người khác', async () => {
    const f = (key, value, extra = {}) => ({ key, raw: value, value, state: value ? 'PROPOSED' : 'UNKNOWN', note: '', ...extra })
    const byTask = {
      book_info: { page_label: 'Trang 1', fields: [f('no', 'VN-0001'), f('name', 'NGUYEN VAN KHAC'), f('dob', '04.1.1990', { value: '04/01/1990' })] },
      book_duty: {
        page_label: 'Trang 2',
        fields: [
          f('ship', 'ATAYAL STAR'), f('rank', '2/E'), f('onPort', 'Singapore'), f('onDate', '17th-FEB-2020'), f('offPort', ''), f('offDate', ''),
        ],
      },
      certificate: {
        page_label: '1 trang',
        fields: [f('typeCode', 'BASIC_TRAINING'), f('valid', '14.03.28'), f('noExpiry', 'false'), f('no', 'BT-10234'), f('holder', seafarer.full_name)],
      },
    }
    const types = ['seaman_book_info', 'seaman_book_duty', 'certificate']
    const callVision = fakeAi({ split: (page) => types[page - 1], read: (args) => byTask[args.task] })
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['Sổ 1', 'Sổ 2', 'Chứng chỉ']), 'tron.pdf'), 1)
    await waitFor(finished(upload.id), 'upload xong')
    const docs = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    const [info, duty, cert] = docs

    // Mức model theo việc.
    const tiers = Object.fromEntries(callVision.mock.calls.map((c) => [c[0].task, c[0].tier]))
    expect(tiers).toMatchObject({ split: 'small', book_info: 'strong', book_duty: 'strong', certificate: 'small' })

    // Trang chức danh: đủ 12 ô theo thứ tự, ngày chuẩn hoá bằng code, chức danh khớp bảng rank (OLR/2E…).
    expect(duty.fields.map((x) => x.key)).toHaveLength(12)
    expect(duty.fields.find((x) => x.key === 'onDate')).toMatchObject({ value: '17/02/2020', state: 'PROPOSED' })
    expect(duty.fields.find((x) => x.key === 'offDate')).toMatchObject({ value: '', state: 'UNKNOWN' })
    expect(duty.fields.find((x) => x.key === 'rank').normalized).toMatchObject({ code: '2E' })
    expect(duty.owner_mismatch).toBe(false)

    // Sổ thuyền viên khác tên hồ sơ → cảnh báo; ô số CMND không tự đẩy vào hồ sơ.
    expect(info.owner_mismatch).toBe(true)
    // Chứng chỉ cùng tên người: không cảnh báo. Năm hai chữ số → DATE_AMBIGUOUS, chưa xong.
    expect(cert.owner_mismatch).toBe(false)
    expect(cert.fields.find((x) => x.key === 'valid')).toMatchObject({ value: '14/03/2028', state: 'DATE_AMBIGUOUS' })
    expect(cert.status).toBe('REVIEW_REQUIRED')

    // Duyệt ba ô bắt buộc thì giấy xong, các ô không bắt buộc tự được chấp nhận.
    await documentService.decide(cert.id, 'typeCode', 'accept', undefined, 1)
    await documentService.decide(cert.id, 'noExpiry', 'accept', undefined, 1)
    const done = await documentService.decide(cert.id, 'valid', 'accept', undefined, 1)
    expect(done.status).toBe('COMPLETED')
    expect(done.fields.find((x) => x.key === 'no')).toMatchObject({ state: 'ACCEPTED', value: 'BT-10234' })
  })

  it('đổi loại giấy thì đọc lại theo loại mới; đổi sang "Khác" thì không đọc; không đổi được giấy đã vào hồ sơ', async () => {
    const callVision = fakeAi({ split: () => 'other' })
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['Đổi loại']), 'doi.pdf'), 1)
    await waitFor(finished(upload.id), 'upload xong')
    const [doc] = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(doc).toMatchObject({ doc_type: 'other', status: 'SKIPPED', label: 'Giấy khác' })
    expect(callVision.mock.calls.filter((c) => c[0].task !== 'split')).toHaveLength(0)

    const reading = await documentService.retype(doc.id, 'certificate')
    expect(reading).toMatchObject({ doc_type: 'certificate', type_source: 'USER', status: 'READING' })
    await waitFor(async () => (await documentService.get(doc.id)).status === 'REVIEW_REQUIRED', 'đọc lại xong')
    const read = await documentService.get(doc.id)
    expect(read.fields.find((f) => f.key === 'typeCode').value).toBe('BASIC_TRAINING')

    const back = await documentService.retype(doc.id, 'other')
    expect(back).toMatchObject({ doc_type: 'other', status: 'SKIPPED', fields: [] })
    await expect(documentService.retype(doc.id, 'khong_co')).rejects.toMatchObject({ statusCode: 400 })

    await pool.query("UPDATE seafarer_document SET status = 'PUBLISHED' WHERE id = ?", [doc.id])
    await expect(documentService.retype(doc.id, 'certificate')).rejects.toMatchObject({ statusCode: 409 })
    await pool.query("UPDATE seafarer_document SET status = 'SKIPPED' WHERE id = ?", [doc.id])
  })

  it('gom và tách lại trang: giữ giấy không đổi, dựng lại giấy đổi, từ chối nhóm sai', async () => {
    fakeAi({ split: (page) => (page === 3 ? 'other' : ['certificate', page]) })
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['A', 'B', 'C', 'D']), 'gom.pdf'), 1)
    await waitFor(finished(upload.id), 'upload xong')
    const before = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(before.map((d) => [d.page_from, d.page_to, d.doc_type])).toEqual([[1, 1, 'certificate'], [2, 2, 'certificate'], [3, 3, 'other'], [4, 4, 'certificate']])

    // Gom trang 1-2 thành một chứng chỉ; giữ nguyên trang 3 và 4.
    const result = await documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 2 }, { pageFrom: 3, pageTo: 3 }, { pageFrom: 4, pageTo: 4 }])
    const after = result.documents
    expect(after.map((d) => [d.page_from, d.page_to, d.doc_type])).toEqual([[1, 2, 'certificate'], [3, 3, 'other'], [4, 4, 'certificate']])
    // Giấy trang 3 và 4 giữ nguyên id (không đọc lại).
    expect(after[1].id).toBe(before[2].id)
    expect(after[2].id).toBe(before[3].id)
    await waitFor(finished(upload.id), 'đọc lại xong')

    await expect(documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 3 }, { pageFrom: 3, pageTo: 4 }])).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hai nhóm') })
    await expect(documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 2 }])).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('chưa thuộc nhóm nào') })
    await expect(documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 9 }])).rejects.toMatchObject({ statusCode: 400 })

    // Giấy đã đưa vào hồ sơ thì trang của nó bị khoá.
    await pool.query("UPDATE seafarer_document SET status = 'PUBLISHED' WHERE id = ?", [after[2].id])
    await expect(documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 4 }])).rejects.toMatchObject({ statusCode: 409 })
    const kept = await documentService.regroup(upload.id, [{ pageFrom: 1, pageTo: 3 }])
    expect(kept.documents.map((d) => [d.page_from, d.page_to, d.status === 'PUBLISHED'])).toEqual([[1, 3, false], [4, 4, true]])
    await expect(documentService.removeUpload(upload.id)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('tách lỗi: giấy "chưa tách" mang lỗi, bấm Đọc lại thì tách lại và thay giấy đó', async () => {
    vi.spyOn(ai, 'isConfigured').mockReturnValue(true)
    vi.spyOn(ai, 'callVision').mockRejectedValue({ statusCode: 503, message: 'AI đang quá tải, thử lại sau ít phút' })
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['Tách lỗi', 'Hai']), 'loi.pdf'), 1)
    await waitFor(finished(upload.id), 'upload FAILED')
    expect(await documentService.getUpload(upload.id)).toMatchObject({ status: 'FAILED', page_count: 2, error: 'AI đang quá tải, thử lại sau ít phút' })
    const [placeholder] = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(placeholder).toMatchObject({ status: 'FAILED', doc_type: null, error: 'AI đang quá tải, thử lại sau ít phút' })

    vi.restoreAllMocks()
    fakeAi({ split: () => ['certificate', 1] })
    expect(await documentService.retry(placeholder.id)).toMatchObject({ status: 'READING' })
    await waitFor(finished(upload.id), 'tách lại xong')
    const docs = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(docs.map((d) => [d.page_from, d.page_to, d.doc_type])).toEqual([[1, 2, 'certificate']])
    expect(docs[0].id).not.toBe(placeholder.id)
  })

  it('thả trùng tệp thì trả tệp đã có; xoá rồi thả lại thì được', async () => {
    fakeAi()
    const pdf = uniquePdf(['Một trang'])
    const first = await documentService.upload(seafarerId, asFile(pdf, 'a.pdf'), 1)
    await waitFor(finished(first.id), 'upload xong')
    const again = await documentService.upload(seafarerId, asFile(pdf, 'doi-ten.pdf'), 1)
    expect(again).toMatchObject({ id: first.id, duplicate: true })
    const [[count]] = await pool.query('SELECT COUNT(*) AS n FROM document_upload WHERE seafarer_id = ? AND sha256 = ?', [seafarerId, crypto.createHash('sha256').update(pdf).digest('hex')])
    expect(count.n).toBe(1)

    await documentService.removeUpload(first.id)
    const third = await documentService.upload(seafarerId, asFile(pdf, 'a.pdf'), 1)
    expect(third.id).not.toBe(first.id)
    expect(third.duplicate).toBeUndefined()
    await waitFor(finished(third.id), 'upload xong')
  })

  it('ảnh JPG là một trang; PDF hỏng thì upload FAILED kèm lý do', async () => {
    fakeAi()
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
    vi.spyOn(ai, 'isConfigured').mockReturnValue(false)
    const callVision = vi.spyOn(ai, 'callVision')
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(['Chưa cấu hình']), 'x.pdf'), 1)
    await waitFor(finished(upload.id), 'upload xong')
    expect(await documentService.getUpload(upload.id)).toMatchObject({ status: 'FAILED', page_count: 1 })
    const [doc] = (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id)
    expect(doc).toMatchObject({ status: 'FAILED', doc_type: null })
    expect(doc.error).toMatch(/chưa được cấu hình/)
    expect(callVision).not.toHaveBeenCalled()
    await expect(documentService.retry(doc.id)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('khôi phục: upload kẹt quá 5 phút được xử lý lại, giấy cũ chưa có trang tự cắt trang khi đọc', async () => {
    fakeAi()
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
      `INSERT INTO seafarer_document (seafarer_id, upload_id, doc_type, type_source, status, updated_at)
       VALUES (?, ?, 'certificate', 'AI', 'READING', NOW() - INTERVAL 10 MINUTE)`,
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
