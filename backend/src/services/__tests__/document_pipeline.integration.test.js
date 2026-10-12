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

let pool, ai, documentService, seaService, makePdf, sharp, uploadDir

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
    seaService = require('../sea_service.service')
    ;({ documentService } = require('../document.service'))
    ;({ makePdf } = require('../../../test_support/make_pdf'))
    sharp = require('sharp')
    const [[row]] = await pool.query('SELECT id, full_name, full_name_en FROM seafarer WHERE deleted_at IS NULL ORDER BY id LIMIT 1')
    seafarerId = row.id
    seafarer = row
    // Người dùng thao tác (id 1): DB kiểm không có sẵn, các cột created_by/updated_by có khoá ngoại tới đây.
    await pool.query("INSERT IGNORE INTO user (id, email, password_hash, role) VALUES (1, 'integration-test@example.invalid', 'x', 'admin')")
    await cleanup()
  })

  // Dọn dữ liệu của test. Việc đọc chạy nền của test trước có thể còn dang dở: đợi nó xong rồi xoá, thử lại nếu vướng khoá ngoại.
  async function cleanup() {
    const deadline = Date.now() + 5000
    for (;;) {
      const [[busy]] = await pool.query("SELECT COUNT(*) AS n FROM seafarer_document WHERE seafarer_id = ? AND status = 'READING'", [seafarerId])
      if (!busy.n || Date.now() > deadline) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    for (let attempt = 0; ; attempt += 1) {
      try {
        await pool.query('DELETE f FROM document_field f JOIN seafarer_document d ON d.id = f.document_id WHERE d.seafarer_id = ?', [seafarerId])
        await pool.query('DELETE FROM ai_call')
        await pool.query('DELETE FROM sea_service WHERE seafarer_id = ?', [seafarerId])
        await pool.query('DELETE FROM seafarer_certificate WHERE seafarer_id = ? AND source_document_id IS NOT NULL', [seafarerId])
        await pool.query('DELETE FROM seafarer_document WHERE seafarer_id = ?', [seafarerId])
        await pool.query('DELETE p FROM document_upload_page p JOIN document_upload u ON u.id = p.upload_id WHERE u.seafarer_id = ?', [seafarerId])
        await pool.query('DELETE FROM document_upload WHERE seafarer_id = ?', [seafarerId])
        return
      } catch (err) {
        if (attempt >= 3) throw err
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  beforeEach(async () => {
    vi.restoreAllMocks()
    await cleanup()
  })

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

  const f = (key, value, extra = {}) => ({ key, raw: value, value, state: value ? 'PROPOSED' : 'UNKNOWN', note: '', ...extra })

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

  // Một PDF trộn: sổ (thông tin + 2 trang chức danh), chứng chỉ hai mặt, chứng chỉ không khớp danh mục và không thời hạn,
  // chứng chỉ thứ ba, một trang khác. Đi hết đường tải lên → cắt trang → tách → đọc → duyệt → đưa vào hồ sơ.
  async function runMixedPdf({ holderOf = () => seafarer.full_name } = {}) {
    const layout = [
      'seaman_book_info', 'seaman_book_duty', 'seaman_book_duty', ['certificate', 1], ['certificate', 1], ['certificate', 2], ['certificate', 3], ['other', 4],
    ]
    let dutyCalls = 0
    let singles = 0
    fakeAi({
      split: (page) => layout[page - 1],
      read: (args) => {
        if (args.task === 'book_info') return { page_label: 'Trang 1', fields: [f('no', 'VN-0001'), f('name', seafarer.full_name)] }
        if (args.task === 'book_duty') {
          dutyCalls += 1
          return dutyCalls === 1
            ? { page_label: 'T2', fields: [f('ship', 'ATAYAL STAR'), f('rank', 'OLR'), f('onPort', 'Singapore'), f('onDate', '04.1.2016'), f('offPort', 'Busan'), f('offDate', '02/08/2016')] }
            : { page_label: 'T3', fields: [f('ship', 'SEA LION'), f('rank', 'Bosun 1st'), f('onPort', 'Hai Phong'), f('onDate', '10-FEB-2024'), f('offPort', ''), f('offDate', '')] }
        }
        // certificate: gọi theo số ảnh của giấy: hai mặt = 2 ảnh
        const pageCount = args.images.length
        if (pageCount === 2) return { page_label: '2 mặt', fields: [f('typeCode', 'BASIC_TRAINING'), f('nameRaw', 'Basic Safety Training'), f('valid', '14/03/2028'), f('noExpiry', 'false'), f('no', 'BT-10234'), f('holder', holderOf('cert1'))] }
        singles += 1
        return singles === 1
          ? { page_label: '1 trang', fields: [f('typeCode', ''), f('nameRaw', 'Ship Security Awareness'), f('valid', ''), f('noExpiry', 'true'), f('holder', holderOf('cert2'))] }
          : { page_label: '1 trang', fields: [f('typeCode', 'PSCRB'), f('valid', '02/11/2030'), f('noExpiry', 'false'), f('no', 'G-5521'), f('holder', holderOf('cert3'))] }
      },
    })
    const upload = await documentService.upload(seafarerId, asFile(uniquePdf(Array.from({ length: 8 }, (_, i) => `Trang ${i + 1}`)), 'tron.pdf'), 1)
    await waitFor(finished(upload.id), 'upload xong')
    return { upload, docs: (await documentService.list(seafarerId)).filter((d) => d.upload_id === upload.id) }
  }
  it('luồng đầy đủ với PDF trộn: ra đúng số dòng đi tàu và chứng chỉ, bấm đưa vào hồ sơ hai lần không tạo trùng', async () => {
    const { docs } = await runMixedPdf()
    expect(docs.map((d) => d.doc_type)).toEqual(['seaman_book_info', 'seaman_book_duty', 'seaman_book_duty', 'certificate', 'certificate', 'certificate', 'other'])
    const [info, duty1, duty2, cert1, cert2, cert3, other] = docs
    expect(other.status).toBe('SKIPPED')
    expect(duty1.fields.find((x) => x.key === 'onDate').value).toBe('04/01/2016')

    // Chưa duyệt xong thì chưa đưa vào hồ sơ được.
    await expect(documentService.publish(seafarerId, 1)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('chưa duyệt xong') })

    // Sổ: chấp nhận các ô đọc rõ, ô còn lại (trống) giữ trống. Đối chiếu tàu lưu vào giấy.
    const [[vessel]] = await pool.query('SELECT id FROM vessel WHERE deleted_at IS NULL LIMIT 1')
    let vesselId = vessel?.id
    if (!vesselId) {
      const [created] = await pool.query("INSERT INTO vessel (vessel_name) VALUES ('ATAYAL STAR (test)')")
      vesselId = created.insertId
    }
    for (const doc of [info, duty1, duty2]) {
      const accepted = await documentService.acceptClear(doc.id, 1)
      for (const field of accepted.fields.filter((x) => ['UNKNOWN', 'DATE_AMBIGUOUS'].includes(x.state))) {
        await documentService.decide(doc.id, field.key, 'keepUnknown', undefined, 1)
      }
    }
    expect((await documentService.get(duty1.id)).status).toBe('COMPLETED')
    expect(await documentService.setVessel(duty1.id, { vesselId })).toMatchObject({ vessel_match_status: 'MATCHED' })
    await expect(documentService.setVessel(info.id, { vesselId })).rejects.toMatchObject({ statusCode: 409 })

    // Chứng chỉ: xác nhận hàng loạt. Dòng không khớp danh mục bị chặn kèm lý do, hai dòng còn lại được xác nhận.
    const result = await documentService.confirmCertificates([cert1.id, cert2.id, cert3.id], 1)
    expect(result.confirmed).toEqual([cert1.id, cert3.id])
    expect(result.blocked).toEqual([{ id: cert2.id, reason: expect.stringContaining('loại chứng chỉ') }])
    // Người duyệt giữ "không khớp danh mục" và xác nhận không thời hạn bằng tay: loại để trống, lưu tên trên giấy.
    await documentService.decide(cert2.id, 'typeCode', 'keepUnknown', undefined, 1)
    await documentService.decide(cert2.id, 'noExpiry', 'accept', undefined, 1)
    await documentService.decide(cert2.id, 'valid', 'keepUnknown', undefined, 1)
    expect((await documentService.get(cert2.id)).status).toBe('COMPLETED')

    const first = await documentService.publish(seafarerId, 1)
    expect(first).toMatchObject({ documents: 6, certificates: 3, sea_services: 2 })
    // Hai lần liền nhau: lần hai không còn giấy nào, không ghi thêm gì.
    await expect(documentService.publish(seafarerId, 1)).rejects.toMatchObject({ statusCode: 409 })

    const services = await seaService.list(seafarerId)
    expect(services.map((s) => [s.vessel_name_raw, s.rank_raw, s.rank_code, s.sign_on_date, s.sign_off_date, s.vessel_match_status, s.source_type])).toEqual([
      ['ATAYAL STAR', 'OLR', 'OLR', '2016-01-04', '2016-08-02', 'MATCHED', 'DOCUMENT'],
      ['SEA LION', 'Bosun 1st', null, '2024-02-10', null, 'NOT_CHECKED', 'DOCUMENT'],
    ])
    expect(services[0].vessel_id).toBe(vesselId)
    const [certs] = await pool.query(
      `SELECT sc.certificate_type_id, sc.certificate_name_raw, sc.certificate_number, DATE_FORMAT(sc.expiry_date, '%Y-%m-%d') AS expiry,
              sc.no_expiry, sc.issued_date, sc.holder_name_raw, sc.status, ct.code
       FROM seafarer_certificate sc LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       WHERE sc.seafarer_id = ? AND sc.source_document_id IS NOT NULL ORDER BY sc.source_document_id`,
      [seafarerId]
    )
    expect(certs).toHaveLength(3)
    expect(certs[0]).toMatchObject({ code: 'BASIC_TRAINING', certificate_number: 'BT-10234', expiry: '2028-03-14', no_expiry: 0, issued_date: null, status: 'VALID' })
    expect(certs[1]).toMatchObject({ certificate_type_id: null, certificate_name_raw: 'Ship Security Awareness', expiry: null, no_expiry: 1 })
    expect(certs[2]).toMatchObject({ code: 'PSCRB', expiry: '2030-11-02' })
    const [[counts]] = await pool.query('SELECT (SELECT COUNT(*) FROM sea_service WHERE seafarer_id = ?) AS ss', [seafarerId])
    expect(counts.ss).toBe(2)

    // Giấy đã vào hồ sơ không đổi loại, không gom lại, không xoá được.
    const after = await documentService.list(seafarerId)
    expect(after.filter((d) => d.status === 'PUBLISHED')).toHaveLength(6)
    await expect(documentService.retype(duty1.id, 'other')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('giấy mang tên khác hồ sơ chặn đưa vào hồ sơ đến khi xác nhận "Vẫn đúng người"', async () => {
    const { docs } = await runMixedPdf({ holderOf: (which) => (which === 'cert1' ? 'NGUYEN VAN NGUOI KHAC' : seafarer.full_name) })
    const [info, duty1, duty2, cert1, cert2, cert3] = docs
    expect(cert1.owner_mismatch).toBe(true)
    for (const doc of [info, duty1, duty2]) {
      const accepted = await documentService.acceptClear(doc.id, 1)
      for (const field of accepted.fields.filter((x) => ['UNKNOWN', 'DATE_AMBIGUOUS'].includes(x.state))) await documentService.decide(doc.id, field.key, 'keepUnknown', undefined, 1)
    }
    // Dòng khác người bị chặn khi xác nhận hàng loạt (cert3 vẫn xác nhận được).
    const blocked = await documentService.confirmCertificates([cert1.id, cert3.id], 1)
    expect(blocked.confirmed).toEqual([cert3.id])
    expect(blocked.blocked[0]).toMatchObject({ id: cert1.id, reason: expect.stringContaining('Vẫn đúng người') })
    await documentService.decide(cert2.id, 'typeCode', 'keepUnknown', undefined, 1)
    await documentService.decide(cert2.id, 'noExpiry', 'accept', undefined, 1)
    await documentService.decide(cert2.id, 'valid', 'keepUnknown', undefined, 1)
    // Duyệt từng ô thì giấy khác người vẫn xong được, nhưng đưa vào hồ sơ thì bị chặn cho đến khi xác nhận.
    for (const key of ['typeCode', 'valid', 'noExpiry']) await documentService.decide(cert1.id, key, 'accept', undefined, 1)
    expect((await documentService.get(cert1.id)).status).toBe('COMPLETED')

    await expect(documentService.publish(seafarerId, 1)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('tên khác hồ sơ') })
    await expect(documentService.confirmOwner(cert2.id, 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(await documentService.confirmOwner(cert1.id, 1)).toMatchObject({ owner_mismatch: true, owner_mismatch_confirmed: true })
    expect(await documentService.publish(seafarerId, 1)).toMatchObject({ certificates: 3, sea_services: 2 })
  })

  it('chứng chỉ trùng loại và số (hoặc loại và hạn) với hồ sơ đang có thì chặn, không ghi gì', async () => {
    const [[type]] = await pool.query("SELECT id FROM certificate_type WHERE code = 'BASIC_TRAINING'")
    await pool.query(
      "INSERT INTO seafarer_certificate (seafarer_id, certificate_type_id, certificate_number, issued_date, expiry_date) VALUES (?, ?, 'BT-10234', '2010-01-01', '2020-01-01')",
      [seafarerId, type.id]
    )
    try {
      const { docs } = await runMixedPdf()
      for (const doc of docs.filter((d) => d.doc_type !== 'other')) {
        if (doc.doc_type === 'certificate') continue
        const accepted = await documentService.acceptClear(doc.id, 1)
        for (const field of accepted.fields.filter((x) => ['UNKNOWN', 'DATE_AMBIGUOUS'].includes(x.state))) await documentService.decide(doc.id, field.key, 'keepUnknown', undefined, 1)
      }
      const certs = docs.filter((d) => d.doc_type === 'certificate')
      await documentService.confirmCertificates(certs.map((d) => d.id), 1)
      await documentService.decide(certs[1].id, 'typeCode', 'keepUnknown', undefined, 1)
      await documentService.decide(certs[1].id, 'noExpiry', 'accept', undefined, 1)
      await documentService.decide(certs[1].id, 'valid', 'keepUnknown', undefined, 1)
      await expect(documentService.publish(seafarerId, 1)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('đã có chứng chỉ này') })
      const [[after]] = await pool.query('SELECT (SELECT COUNT(*) FROM sea_service WHERE seafarer_id = ?) AS ss, (SELECT COUNT(*) FROM seafarer_certificate WHERE seafarer_id = ? AND source_document_id IS NOT NULL) AS sc, (SELECT COUNT(*) FROM seafarer_document WHERE seafarer_id = ? AND status = ?) AS pub', [seafarerId, seafarerId, seafarerId, 'PUBLISHED'])
      expect(after).toMatchObject({ ss: 0, sc: 0, pub: 0 })
    } finally {
      await pool.query("DELETE FROM seafarer_certificate WHERE seafarer_id = ? AND certificate_number = 'BT-10234' AND source_document_id IS NULL", [seafarerId])
    }
  })

  it('lịch sử đi tàu: nhập tay, sửa và xoá bắt buộc lý do và ghi vào lịch sử hồ sơ', async () => {
    const created = await seaService.create(seafarerId, { vessel_name_raw: 'MV TEST', rank_raw: '3/E', sign_on_date: '2023-05-01', sign_on_port: 'Hai Phong' }, 1)
    expect(created).toMatchObject({ source_type: 'MANUAL', rank_code: '3E', sign_on_date: '2023-05-01', sign_off_date: null, vessel_match_status: 'NOT_CHECKED' })
    await expect(seaService.create(seafarerId, { sign_on_port: 'x' }, 1)).rejects.toMatchObject({ statusCode: 400 })
    await expect(seaService.create(seafarerId, { vessel_name_raw: 'A', sign_on_date: '2023-02-30' }, 1)).rejects.toMatchObject({ statusCode: 400 })

    await expect(seaService.update(created.id, { sign_off_date: '2023-11-01' }, '  ', 1)).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('lý do') })
    const updated = await seaService.update(created.id, { sign_off_date: '2023-11-01', sign_off_port: 'Busan' }, 'Bổ sung ngày rời tàu', 1)
    expect(updated).toMatchObject({ sign_off_date: '2023-11-01', sign_off_port: 'Busan' })
    const [revisions] = await pool.query('SELECT reason, changes FROM seafarer_revision WHERE seafarer_id = ? ORDER BY id DESC LIMIT 1', [seafarerId])
    expect(revisions[0].reason).toBe('Bổ sung ngày rời tàu')
    const changes = typeof revisions[0].changes === 'string' ? JSON.parse(revisions[0].changes) : revisions[0].changes
    expect(changes[`sea_service#${created.id}.sign_off_date`]).toEqual([null, '2023-11-01'])

    await expect(seaService.remove(created.id, '', 1)).rejects.toMatchObject({ statusCode: 400 })
    await seaService.remove(created.id, 'Nhập nhầm', 1)
    expect(await seaService.list(seafarerId)).toHaveLength(0)
    await expect(seaService.get(created.id)).rejects.toMatchObject({ statusCode: 404 })
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
