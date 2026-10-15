const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const pool = require('../config/db')
const { withTransaction } = require('../utils/transaction')
const config = require('../config')
const documentReader = require('./document_reader.service')
const documentPages = require('./document_pages.service')
const documentSplitter = require('./document_splitter.service')
const ai = require('./ai')
const seafarerService = require('./seafarer.service')
const seaServiceService = require('./sea_service.service')
const { normalizeDate, normalizeRank, sameName, normalizeNumber } = require('../utils/normalize')
const { DOC_TYPES, DOC_STATUS, OTHER_TYPE, TODO_STATES, DONE_STATES, ALLOWED_MIME, MAX_FILE_BYTES } = require('../constants/document_types')

const FIELD_ACTIONS = ['accept', 'edit', 'reject', 'keepUnknown', 'undo']
const UPLOAD_STATUS = { RECEIVED: 'RECEIVED', SPLITTING: 'SPLITTING', READING: 'READING', DONE: 'DONE', FAILED: 'FAILED' }
const BUSY_UPLOAD_STATES = [UPLOAD_STATUS.RECEIVED, UPLOAD_STATUS.SPLITTING, UPLOAD_STATUS.READING]
const STALLED_MINUTES = 5

// Một giấy kèm thông tin tệp cha. Giấy cũ chưa có upload_id thì dùng cột tệp trên chính dòng giấy.
const DOC_SELECT = `SELECT d.*, COALESCE(u.file_name, d.file_name) AS file_name, COALESCE(u.mime_type, d.mime_type) AS mime_type
  FROM seafarer_document d LEFT JOIN document_upload u ON u.id = d.upload_id`

// Upload đang được xử lý trong tiến trình này, tránh hai lần chạy chồng nhau (khôi phục sau khởi động, bấm lặp).
const running = new Set()
const reading = new Set()

// Magic bytes: PDF=%PDF, JPEG=FFD8FF, PNG=89504E47. Không tin MIME trình duyệt gửi lên.
function sniffMime(buffer) {
  const b = buffer.subarray(0, 4)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  return null
}

// Mọi kiểu ngày trên giấy tờ → '1990-03-13'. Ngày chưa chắc (năm hai chữ số) và ngày sai thì null:
// ô đã duyệt luôn lưu dạng dd/mm/yyyy đủ bốn chữ số năm.
function toIsoDate(text) {
  const parsed = normalizeDate(text)
  return parsed.status === 'OK' ? parsed.iso : null
}

// Hành động trên một ô, cùng nghĩa với reviewModel.applyAction ở frontend.
function applyAction(field, action, value) {
  switch (action) {
    case 'accept':
      return field.value ? { value: field.value, state: 'ACCEPTED' } : { value: '', state: 'UNKNOWN_KEPT' }
    case 'edit': {
      const text = String(value ?? '').trim().slice(0, 500)
      if (!text) throw { statusCode: 400, message: 'Nhập giá trị cho ô này' }
      return { value: text, state: 'EDITED' }
    }
    case 'reject':
      return { value: field.value, state: 'REJECTED' }
    case 'keepUnknown':
      return { value: '', state: 'UNKNOWN_KEPT' }
    case 'undo':
      return { value: field.ai_value || '', state: field.ai_state }
    default:
      throw { statusCode: 400, message: 'Hành động không hợp lệ' }
  }
}

// Giấy xong khi mọi ô bắt buộc đã quyết. Truyền docType thì bỏ qua ô optional (không bắt buộc duyệt).
function docStatusOf(fields, docType) {
  const optional = new Set((DOC_TYPES[docType]?.fields || []).filter((spec) => spec.optional).map((spec) => spec.key))
  const todo = fields.some((field) => TODO_STATES.includes(field.state) && !optional.has(field.key || field.field_key))
  return todo ? DOC_STATUS.REVIEW_REQUIRED : DOC_STATUS.COMPLETED
}

// Ô đã chấp nhận hoặc sửa, có chỗ trong hồ sơ → dữ liệu cập nhật seafarer.
function profileChanges(docType, fields) {
  const layout = DOC_TYPES[docType]
  if (!layout) return {}
  const data = {}
  for (const spec of layout.fields) {
    const field = fields.find((item) => item.field_key === spec.key)
    if (!spec.target || !field || !['ACCEPTED', 'EDITED'].includes(field.state)) continue
    const value = spec.date ? toIsoDate(field.value) : field.value
    if (spec.date && !value) throw { statusCode: 400, message: `Ô "${spec.label}" chưa đúng dạng ngày dd/mm/yyyy` }
    data[spec.target] = value
  }
  return data
}

function rankView(rank) {
  return rank ? { id: rank.id, code: rank.code, name_vi: rank.name_vi } : null
}

// Loại giấy theo cách người dùng nói: sổ, chứng chỉ, khác. Giấy chưa nhận ra loại thì chưa xếp.
const BOOK_TYPES = ['seaman_book_info', 'seaman_book_duty']
function categoryOf(docType) {
  if (!docType) return 'unsorted'
  if (BOOK_TYPES.includes(docType)) return 'book'
  if (DOC_TYPES[docType]?.certificate) return 'certificate'
  return 'other'
}

// Tóm tắt một tệp cho màn Tải giấy tờ lên: đang xử lý hay xong, có bao nhiêu giấy mỗi loại.
// groups: [{ doc_type, status, n }] của các giấy thuộc tệp. `now` để test.
function summarizeUpload(upload, groups = [], now = Date.now()) {
  const summary = { total: 0, book: 0, certificate: 0, other: 0, unsorted: 0, reading: 0, to_review: 0, failed: 0, published: 0 }
  for (const group of groups) {
    const n = Number(group.n) || 0
    summary.total += n
    summary[categoryOf(group.doc_type)] += n
    if (group.status === DOC_STATUS.READING) summary.reading += n
    else if (group.status === DOC_STATUS.REVIEW_REQUIRED) summary.to_review += n
    else if (group.status === DOC_STATUS.FAILED) summary.failed += n
    else if (group.status === DOC_STATUS.PUBLISHED) summary.published += n
  }
  const busy = BUSY_UPLOAD_STATES.includes(upload.status)
  const updated = upload.updated_at ? new Date(upload.updated_at).getTime() : null
  const stalled = busy && updated !== null && now - updated > STALLED_MINUTES * 60 * 1000
  // phase: running (đang xử lý), done (xong), failed (tệp lỗi, cần thử lại). Giấy lỗi lẻ không làm cả tệp thành lỗi.
  const phase = upload.status === UPLOAD_STATUS.FAILED ? 'failed' : busy ? 'running' : 'done'
  return { ...summary, phase, stalled }
}

function shapeUpload(upload) {
  return {
    id: upload.id,
    seafarer_id: upload.seafarer_id,
    file_name: upload.file_name,
    mime_type: upload.mime_type,
    file_size: upload.file_size,
    page_count: upload.page_count,
    status: upload.status,
    error: upload.error,
    document_count: upload.document_count ?? undefined,
    summary: upload.summary,
    created_by: upload.created_by,
    created_at: upload.created_at,
  }
}

function shape(doc, fields, lookups = {}) {
  const layout = DOC_TYPES[doc.doc_type]
  const byKey = new Map(fields.map((field) => [field.field_key, field]))
  return {
    id: doc.id,
    seafarer_id: doc.seafarer_id,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    doc_type: doc.doc_type,
    label: layout?.label || (doc.doc_type === OTHER_TYPE ? 'Giấy khác' : 'Chưa nhận ra loại giấy'),
    title: layout?.title || null,
    page: doc.page_label,
    upload_id: doc.upload_id || null,
    page_from: doc.page_from || null,
    page_to: doc.page_to || null,
    type_source: doc.type_source || null,
    owner_mismatch: Boolean(doc.owner_mismatch),
    owner_mismatch_confirmed: Boolean(doc.owner_mismatch_confirmed_by),
    vessel_id: doc.vessel_id || null,
    vessel_match_status: doc.vessel_match_status || null,
    status: doc.status,
    error: doc.error,
    published_at: doc.published_at,
    created_at: doc.created_at,
    fields: (layout?.fields || []).filter((spec) => byKey.has(spec.key)).map((spec) => {
      const field = byKey.get(spec.key)
      return {
        key: spec.key,
        label: spec.label,
        english: spec.english,
        half: Boolean(spec.half),
        to_profile: Boolean(spec.target),
        raw: field.raw_text || '',
        ai_value: field.ai_value || '',
        value: field.value || '',
        state: field.state,
        note: field.note,
        optional: Boolean(spec.optional),
        // Ô cần người duyệt chạm một lần (số GCNKNCM): duyệt nhanh không chấp nhận âm thầm.
        confirm: Boolean(spec.confirm),
        // Chức danh khớp bảng rank (null nếu không có trong bảng); chỉ trang bố trí chức danh.
        normalized: spec.key === 'rank' && lookups.ranks ? rankView(normalizeRank(field.value || field.raw_text, lookups.ranks)) : undefined,
      }
    }),
  }
}

const documentService = {
  // Lưu tệp gốc rồi trả upload ngay; cắt trang và đọc chạy nền, frontend hỏi lại trạng thái.
  // Tệp trùng (cùng sha256, chưa xoá) trả về upload đã có kèm duplicate: true.
  async upload(seafarerId, file, userId) {
    const [[seafarer]] = await pool.query('SELECT id FROM seafarer WHERE id = ? AND deleted_at IS NULL', [seafarerId])
    if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const buffer = await file.toBuffer()
    if (file.file?.truncated || buffer.length > MAX_FILE_BYTES) throw { statusCode: 413, message: 'Tệp lớn hơn 25 MB, chọn bản nhỏ hơn' }
    const mime = sniffMime(buffer)
    if (!mime || !ALLOWED_MIME.includes(mime)) throw { statusCode: 400, message: 'Chỉ nhận PDF, JPG, PNG' }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    const findDuplicate = async () => {
      const [[dup]] = await pool.query('SELECT * FROM document_upload WHERE seafarer_id = ? AND sha256 = ? AND deleted_at IS NULL', [seafarerId, sha256])
      return dup ? { ...shapeUpload(dup), duplicate: true } : null
    }
    const existing = await findDuplicate()
    if (existing) return existing

    const dir = path.join(config.upload.dir, 'documents', String(seafarerId))
    fs.mkdirSync(dir, { recursive: true })
    const ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }[mime]
    const storagePath = path.join(dir, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`)
    fs.writeFileSync(storagePath, buffer)

    const name = path.basename(String(file.filename || 'giay-to')).slice(0, 255)
    let id
    try {
      const [result] = await pool.query(
        'INSERT INTO document_upload (seafarer_id, file_name, mime_type, file_size, storage_path, sha256, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [seafarerId, name, mime, buffer.length, storagePath, sha256, UPLOAD_STATUS.RECEIVED, userId]
      )
      id = result.insertId
    } catch (err) {
      fs.rmSync(storagePath, { force: true })
      // Hai lần thả cùng lúc: lần sau thua khoá UNIQUE, trả tệp của lần trước.
      if (err?.code === '23505') {
        const dup = await findDuplicate()
        if (dup) return dup
      }
      throw err
    }
    setImmediate(() => { this.process(id).catch(() => {}) })
    return this.getUpload(id)
  },

  // Cắt trang → tách → tạo giấy → đọc. Chạy lại được: bỏ qua bước đã xong (dùng cho khôi phục sau khi máy chủ khởi động lại).
  async process(uploadId) {
    if (running.has(uploadId)) return
    running.add(uploadId)
    try {
      const [[upload]] = await pool.query('SELECT * FROM document_upload WHERE id = ? AND deleted_at IS NULL', [uploadId])
      if (!upload) return
      const [typed] = await pool.query('SELECT id FROM seafarer_document WHERE upload_id = ? AND doc_type IS NOT NULL AND deleted_at IS NULL', [uploadId])
      if (!typed.length) {
        const ok = await this.splitUpload(upload)
        if (!ok) return
      }
      await pool.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.READING, uploadId])
      const [docs] = await pool.query('SELECT id FROM seafarer_document WHERE upload_id = ? AND status = ? AND deleted_at IS NULL ORDER BY id', [uploadId, DOC_STATUS.READING])
      for (const doc of docs) await this.extract(doc.id)
      await this.finishUpload(uploadId)
    } finally {
      running.delete(uploadId)
    }
  },

  // Cắt trang rồi nhờ AI tách thành các giấy. Trả false nếu không làm được (upload FAILED, có giấy "chưa tách" mang lỗi).
  async splitUpload(upload) {
    let pageCount = null
    try {
      pageCount = await this.ensurePages(upload)
      if (!ai.isConfigured()) throw { statusCode: 503, message: ai.notConfiguredMessage() }
      const [rows] = await pool.query('SELECT page_no, thumb_path FROM document_upload_page WHERE upload_id = ? ORDER BY page_no', [upload.id])
      const pages = rows.map((row) => ({ page_no: row.page_no, thumbBuffer: fs.readFileSync(row.thumb_path) }))
      const { entries, papers } = await documentSplitter.split({ uploadId: upload.id, pages })
      await withTransaction(pool, async (conn) => {
        for (const entry of entries) {
          await conn.query('UPDATE document_upload_page SET split_type = ?, split_note = ? WHERE upload_id = ? AND page_no = ?', [entry.type, entry.note, upload.id, entry.page])
        }
        await this.replaceDocuments(conn, upload, papers.map((paper) => ({ ...paper, source: 'AI' })))
      })
      return true
    } catch (err) {
      const message = err?.statusCode ? err.message : 'Không tách được giấy trong tệp này. Thử lại.'
      await this.markUnsplit(upload, message, pageCount)
      return false
    }
  },

  // Tệp chưa tách được: upload FAILED và một giấy "chưa tách" mang lỗi để người dùng thấy và bấm Đọc lại.
  async markUnsplit(upload, message, pageCount) {
    const text = message.slice(0, 500)
    const [placeholders] = await pool.query('SELECT id FROM seafarer_document WHERE upload_id = ? AND doc_type IS NULL AND deleted_at IS NULL', [upload.id])
    if (placeholders.length) {
      await pool.query('UPDATE seafarer_document SET status = ?, error = ? WHERE id IN (?)', [DOC_STATUS.FAILED, text, placeholders.map((row) => row.id)])
    } else {
      await pool.query(
        'INSERT INTO seafarer_document (seafarer_id, upload_id, page_from, page_to, status, error, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [upload.seafarer_id, upload.id, pageCount ? 1 : null, pageCount || null, DOC_STATUS.FAILED, text, upload.created_by]
      )
    }
    // Upload chỉ báo FAILED sau khi giấy mang lỗi đã có, để người xem thấy cả hai cùng lúc.
    await pool.query('UPDATE document_upload SET status = ?, error = ? WHERE id = ?', [UPLOAD_STATUS.FAILED, text, upload.id])
  },

  // Thay các giấy chưa đưa vào hồ sơ của upload bằng danh sách `papers` [{ type, pageFrom, pageTo, label, source }].
  // Giấy có cùng khoảng trang và cùng loại với giấy cũ thì giữ nguyên (không đọc lại, không mất quyết định đã có).
  async replaceDocuments(conn, upload, papers) {
    const [old] = await conn.query('SELECT * FROM seafarer_document WHERE upload_id = ? AND status <> ? AND deleted_at IS NULL', [upload.id, DOC_STATUS.PUBLISHED])
    const kept = new Set()
    const created = []
    for (const paper of papers) {
      const same = old.find((doc) => !kept.has(doc.id) && doc.doc_type === paper.type && doc.page_from === paper.pageFrom && doc.page_to === paper.pageTo)
      if (same) {
        kept.add(same.id)
        continue
      }
      const skipped = paper.type === OTHER_TYPE
      const [result] = await conn.query(
        'INSERT INTO seafarer_document (seafarer_id, upload_id, page_from, page_to, doc_type, type_source, page_label, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [upload.seafarer_id, upload.id, paper.pageFrom, paper.pageTo, paper.type, paper.source, paper.label || null, skipped ? DOC_STATUS.SKIPPED : DOC_STATUS.READING, upload.created_by]
      )
      created.push(result.insertId)
    }
    const dropIds = old.filter((doc) => !kept.has(doc.id)).map((doc) => doc.id)
    if (dropIds.length) {
      await conn.query('DELETE FROM document_field WHERE document_id IN (?)', [dropIds])
      await conn.query('UPDATE seafarer_document SET deleted_at = NOW() WHERE id IN (?)', [dropIds])
    }
    return created
  },

  // Cắt tệp gốc thành ảnh từng trang nếu chưa có (cả tệp cũ trước khi có bảng upload). Trả số trang.
  async ensurePages(upload) {
    const [[have]] = await pool.query('SELECT COUNT(*) AS n FROM document_upload_page WHERE upload_id = ?', [upload.id])
    if (have.n > 0) return have.n
    await pool.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.SPLITTING, upload.id])
    if (!fs.existsSync(upload.storage_path)) throw { statusCode: 404, message: 'Không tìm thấy tệp gốc trên máy chủ' }
    const pages = await documentPages.cut(fs.readFileSync(upload.storage_path), upload.mime_type)
    const dir = path.join(config.upload.dir, 'documents', String(upload.seafarer_id), String(upload.id))
    fs.mkdirSync(dir, { recursive: true })
    const rows = pages.map((page) => {
      const base = `p${String(page.pageNo).padStart(3, '0')}`
      const imagePath = path.join(dir, `${base}.jpg`)
      const thumbPath = path.join(dir, `${base}_t.jpg`)
      fs.writeFileSync(imagePath, page.image)
      fs.writeFileSync(thumbPath, page.thumb)
      return [upload.id, page.pageNo, imagePath, thumbPath, page.width, page.height]
    })
    await withTransaction(pool, async (conn) => {
      await conn.query('INSERT INTO document_upload_page (upload_id, page_no, image_path, thumb_path, width, height) VALUES ?', [rows])
      await conn.query('UPDATE document_upload SET page_count = ? WHERE id = ?', [pages.length, upload.id])
    })
    return pages.length
  },

  // Upload xong khi không còn giấy nào đang đọc.
  async finishUpload(uploadId) {
    if (!uploadId) return
    const [[reading]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE upload_id = ? AND status = ? AND deleted_at IS NULL', [uploadId, DOC_STATUS.READING])
    if (reading.n === 0) {
      await pool.query('UPDATE document_upload SET status = ? WHERE id = ? AND status IN (?)', [UPLOAD_STATUS.DONE, uploadId, [UPLOAD_STATUS.READING, UPLOAD_STATUS.SPLITTING]])
    }
  },

  // Ảnh các trang thuộc giấy, theo thứ tự trang.
  async pageImagesOf(doc) {
    const [[upload]] = await pool.query('SELECT * FROM document_upload WHERE id = ?', [doc.upload_id])
    if (!upload) throw { statusCode: 404, message: 'Không tìm thấy tệp của giấy này' }
    const count = await this.ensurePages(upload)
    const from = doc.page_from || 1
    const to = doc.page_to || count
    const [pages] = await pool.query('SELECT image_path FROM document_upload_page WHERE upload_id = ? AND page_no BETWEEN ? AND ? ORDER BY page_no', [upload.id, from, to])
    if (!pages.length) throw { statusCode: 404, message: 'Không có ảnh trang cho giấy này' }
    return pages.map((page) => ({ buffer: fs.readFileSync(page.image_path), mimeType: 'image/jpeg' }))
  },

  // Một giấy chỉ đọc một lần cùng lúc: quét giấy kẹt định kỳ không được chạy chồng lên lần đọc đang chạy.
  async extract(id) {
    if (reading.has(id)) return
    reading.add(id)
    try {
      await this.extractOnce(id)
    } finally {
      reading.delete(id)
    }
  },

  async extractOnce(id) {
    const [[doc]] = await pool.query('SELECT * FROM seafarer_document WHERE id = ? AND deleted_at IS NULL', [id])
    if (!doc || doc.status === DOC_STATUS.SKIPPED) return
    // Giấy "chưa tách": đọc lại nghĩa là tách lại cả tệp.
    if (!doc.doc_type) {
      if (doc.upload_id) await this.process(doc.upload_id)
      return
    }
    try {
      const [types] = await pool.query('SELECT code, name_vi FROM certificate_type ORDER BY id')
      const images = await this.pageImagesOf(doc)
      const result = await documentReader.read(images, types, { uploadId: doc.upload_id, documentId: id }, doc.doc_type)
      if (!result.doc_type) {
        await pool.query('UPDATE seafarer_document SET status = ?, error = ? WHERE id = ?', [DOC_STATUS.FAILED, 'AI chưa nhận ra loại giấy này. Giấy chưa có khuôn đọc, lưu kèm hồ sơ để xem tay.', id])
        return
      }
      await pool.query('DELETE FROM document_field WHERE document_id = ?', [id])
      if (result.fields.length) {
        await pool.query(
          'INSERT INTO document_field (document_id, field_key, raw_text, ai_value, ai_state, value, state, note) VALUES ?',
          [result.fields.map((field) => [id, field.key, field.raw, field.value, field.state, field.value, field.state, field.note])]
        )
      }
      const mismatch = await this.ownerMismatch(doc, result.fields)
      await pool.query(
        'UPDATE seafarer_document SET page_label = COALESCE(?, page_label), status = ?, error = NULL, owner_mismatch = ?, owner_mismatch_confirmed_by = NULL WHERE id = ?',
        [result.page_label, docStatusOf(result.fields, doc.doc_type), mismatch ? 1 : 0, id]
      )
    } catch (err) {
      const message = err?.statusCode ? err.message : 'AI đọc giấy bị lỗi. Thử đọc lại.'
      await pool.query('UPDATE seafarer_document SET status = ?, error = ? WHERE id = ?', [DOC_STATUS.FAILED, message.slice(0, 500), id])
    } finally {
      await this.finishUpload(doc.upload_id)
    }
  },

  async retry(id) {
    const doc = await this.get(id)
    if (doc.status !== DOC_STATUS.FAILED) throw { statusCode: 409, message: 'Chỉ đọc lại được giấy đọc lỗi' }
    if (!documentReader.isConfigured()) throw { statusCode: 503, message: ai.notConfiguredMessage() }
    await pool.query('UPDATE seafarer_document SET status = ?, error = NULL WHERE id = ?', [DOC_STATUS.READING, id])
    if (doc.upload_id) await pool.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.READING, doc.upload_id])
    setImmediate(() => { this.extract(id).catch(() => {}) })
    return this.get(id)
  },

  // Khi máy chủ khởi động: đưa vào chạy lại các upload và giấy kẹt quá STALLED_MINUTES phút.
  // Chạy lần lượt trong nền; trả số lượng đã xếp hàng.
  async recoverStalled() {
    const [uploads] = await pool.query(
      'SELECT id FROM document_upload WHERE deleted_at IS NULL AND status IN (?) AND updated_at < (NOW() - (? * INTERVAL \'1 minute\')) ORDER BY id',
      [BUSY_UPLOAD_STATES, STALLED_MINUTES]
    )
    // Giấy đang đọc dở mà upload của nó không còn bận (giấy cũ chưa có upload, hoặc đọc lại một giấy).
    const [docs] = await pool.query(
      `SELECT d.id FROM seafarer_document d LEFT JOIN document_upload u ON u.id = d.upload_id
       WHERE d.deleted_at IS NULL AND d.status = ? AND d.updated_at < (NOW() - (? * INTERVAL '1 minute'))
         AND (u.id IS NULL OR u.status NOT IN (?))
       ORDER BY d.id`,
      [DOC_STATUS.READING, STALLED_MINUTES, BUSY_UPLOAD_STATES]
    )
    const docIds = docs.map((doc) => doc.id)
    setImmediate(async () => {
      for (const upload of uploads) await this.process(upload.id).catch(() => {})
      for (const id of docIds) await this.extract(id).catch(() => {})
    })
    return { uploads: uploads.length, documents: docIds.length }
  },

  async list(seafarerId) {
    const [docs] = await pool.query(`${DOC_SELECT} WHERE d.seafarer_id = ? AND d.deleted_at IS NULL ORDER BY d.upload_id, d.page_from, d.id`, [seafarerId])
    if (!docs.length) return []
    const [fields] = await pool.query('SELECT * FROM document_field WHERE document_id IN (?) ORDER BY id', [docs.map((doc) => doc.id)])
    const lookups = await this.lookupsFor(docs)
    return docs.map((doc) => shape(doc, fields.filter((field) => field.document_id === doc.id), lookups))
  },

  async get(id) {
    const [[doc]] = await pool.query(`${DOC_SELECT} WHERE d.id = ? AND d.deleted_at IS NULL`, [id])
    if (!doc) throw { statusCode: 404, message: 'Không tìm thấy giấy tờ' }
    const [fields] = await pool.query('SELECT * FROM document_field WHERE document_id = ? ORDER BY id', [id])
    return shape(doc, fields, await this.lookupsFor([doc]))
  },

  // Bảng tra cho phần chuẩn hoá khi trả về: chỉ nạp bảng chức danh khi có trang bố trí chức danh.
  async lookupsFor(docs) {
    if (!docs.some((doc) => doc.doc_type === 'seaman_book_duty')) return {}
    const [ranks] = await pool.query('SELECT id, code, name_vi, name_en FROM "rank"')
    return { ranks }
  },

  // Tên hoặc số sổ trên giấy khác hồ sơ đang mở → cảnh báo "giấy của người khác".
  async ownerMismatch(doc, fields) {
    const valueOf = (key) => fields.find((field) => field.key === key)?.value || ''
    const [[seafarer]] = await pool.query('SELECT full_name, full_name_en, seaman_book_number FROM seafarer WHERE id = ?', [doc.seafarer_id])
    if (!seafarer) return false
    const names = [seafarer.full_name, seafarer.full_name_en].filter(Boolean)
    const nameDiffers = (paperName) => Boolean(paperName) && names.length > 0 && !names.some((name) => sameName(name, paperName))
    if (doc.doc_type === 'seaman_book_info') {
      const paperNo = normalizeNumber(valueOf('no'))
      const profileNo = normalizeNumber(seafarer.seaman_book_number)
      return nameDiffers(valueOf('name')) || Boolean(paperNo && profileNo && paperNo !== profileNo)
    }
    if (doc.doc_type === 'certificate') return nameDiffers(valueOf('holder'))
    return false
  },

  async decide(id, fieldKey, action, value, userId) {
    if (!FIELD_ACTIONS.includes(action)) throw { statusCode: 400, message: 'Hành động không hợp lệ' }
    const doc = await this.get(id)
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không sửa được nữa' }
    const [[field]] = await pool.query('SELECT * FROM document_field WHERE document_id = ? AND field_key = ?', [id, fieldKey])
    if (!field) throw { statusCode: 404, message: 'Không có ô này trên giấy' }
    const next = applyAction(field, action, value)
    const undo = action === 'undo'
    await pool.query('UPDATE document_field SET value = ?, state = ?, decided_by = ?, decided_at = ? WHERE id = ?', [
      next.value, next.state, undo ? null : userId, undo ? null : new Date(), field.id,
    ])
    await this.settle(id, doc.doc_type, userId)
    return this.get(id)
  },

  // Tính lại trạng thái giấy từ các ô. Giấy xong thì các ô không bắt buộc duyệt được chấp nhận cùng lúc.
  async settle(id, docType, userId) {
    const [fields] = await pool.query('SELECT field_key, state FROM document_field WHERE document_id = ?', [id])
    const status = docStatusOf(fields, docType)
    if (status === DOC_STATUS.COMPLETED) {
      const optional = (DOC_TYPES[docType]?.fields || []).filter((spec) => spec.optional).map((spec) => spec.key)
      if (optional.length) {
        await pool.query(
          'UPDATE document_field SET state = ?, decided_by = ?, decided_at = NOW() WHERE document_id = ? AND field_key IN (?) AND state = ?',
          ['ACCEPTED', userId, id, optional, 'PROPOSED']
        )
      }
    }
    await pool.query('UPDATE seafarer_document SET status = ? WHERE id = ?', [status, id])
    return status
  },

  // Chấp nhận mọi ô PROPOSED (đọc rõ) của một giấy trong một lần; ô trống và ô ngày chưa chắc để lại cho người duyệt.
  async acceptClear(id, userId) {
    const doc = await this.get(id)
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không sửa được nữa' }
    if (doc.status === DOC_STATUS.READING || doc.status === DOC_STATUS.SKIPPED || !doc.fields.length) {
      throw { statusCode: 409, message: 'Giấy này chưa có ô nào để chấp nhận' }
    }
    // Ô "confirm" (số GCNKNCM) không chấp nhận âm thầm: người duyệt chạm vào từng ô.
    const touch = (DOC_TYPES[doc.doc_type]?.fields || []).filter((spec) => spec.confirm).map((spec) => spec.key)
    await pool.query(
      `UPDATE document_field SET state = ?, decided_by = ?, decided_at = NOW() WHERE document_id = ? AND state = ? AND value <> ''${touch.length ? ' AND field_key NOT IN (?)' : ''}`,
      touch.length ? ['ACCEPTED', userId, id, 'PROPOSED', touch] : ['ACCEPTED', userId, id, 'PROPOSED']
    )
    await this.settle(id, doc.doc_type, userId)
    return this.get(id)
  },

  // Lưu kết quả đối chiếu tàu của trang bố trí chức danh. vesselId null: chưa đối chiếu hoặc không tìm thấy tàu.
  async setVessel(id, { vesselId = null, status }) {
    const doc = await this.get(id)
    if (doc.doc_type !== 'seaman_book_duty') throw { statusCode: 409, message: 'Chỉ trang bố trí chức danh mới đối chiếu tàu' }
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không sửa được nữa' }
    let next = status
    if (vesselId) {
      const [[vessel]] = await pool.query('SELECT id FROM vessel WHERE id = ? AND deleted_at IS NULL', [vesselId])
      if (!vessel) throw { statusCode: 400, message: 'Không tìm thấy tàu đã chọn' }
      next = 'MATCHED'
    } else if (!['NOT_CHECKED', 'NOT_FOUND'].includes(next)) {
      next = 'NOT_CHECKED'
    }
    await pool.query('UPDATE seafarer_document SET vessel_id = ?, vessel_match_status = ? WHERE id = ?', [vesselId || null, next, id])
    return this.get(id)
  },

  // Người duyệt xác nhận giấy có tên khác hồ sơ vẫn đúng người.
  async confirmOwner(id, userId) {
    const doc = await this.get(id)
    if (!doc.owner_mismatch) throw { statusCode: 409, message: 'Giấy này không có cảnh báo khác người' }
    await pool.query('UPDATE seafarer_document SET owner_mismatch_confirmed_by = ? WHERE id = ?', [userId, id])
    return this.get(id)
  },

  // Xác nhận nhiều dòng chứng chỉ một lần. Dòng đủ loại và hạn (hoặc không thời hạn) thì mọi ô đọc rõ được chấp nhận;
  // dòng thiếu thì bị chặn, kèm lý do, các dòng khác vẫn xác nhận.
  async confirmCertificates(ids, userId) {
    const confirmed = []
    const blocked = []
    const [types] = await pool.query('SELECT code FROM certificate_type')
    const codes = new Set(types.map((type) => type.code))
    for (const id of ids) {
      const reason = await this.confirmOneCertificate(id, userId, codes)
      if (reason) blocked.push({ id, reason })
      else confirmed.push(id)
    }
    return { confirmed, blocked }
  },

  async confirmOneCertificate(id, userId, codes) {
    const [[doc]] = await pool.query('SELECT * FROM seafarer_document WHERE id = ? AND deleted_at IS NULL', [id])
    if (!doc) return 'Không tìm thấy giấy'
    if (doc.doc_type !== 'certificate') return 'Không phải chứng chỉ'
    if (![DOC_STATUS.REVIEW_REQUIRED, DOC_STATUS.COMPLETED].includes(doc.status)) return 'Giấy chưa đọc xong hoặc đã đưa vào hồ sơ'
    if (doc.owner_mismatch && !doc.owner_mismatch_confirmed_by) return 'Tên trên giấy khác hồ sơ, xác nhận "Vẫn đúng người" trước'
    const [fields] = await pool.query('SELECT * FROM document_field WHERE document_id = ?', [id])
    const get = (key) => fields.find((field) => field.field_key === key)
    const usable = (field) => field && ['PROPOSED', 'ACCEPTED', 'EDITED'].includes(field.state) && field.value
    const typeCode = get('typeCode')
    if (!usable(typeCode) || !codes.has(typeCode.value)) return 'Chưa chọn loại chứng chỉ trong danh mục'
    const valid = get('valid')
    const noExpiry = get('noExpiry')
    const hasNoExpiry = usable(noExpiry) && noExpiry.value === 'true'
    if (valid?.state === 'DATE_AMBIGUOUS') return 'Ngày hết hạn chưa chắc, sửa hoặc chấp nhận ô ngày trước'
    if (usable(valid)) {
      if (!toIsoDate(valid.value)) return 'Ngày hết hạn chưa đúng dạng dd/mm/yyyy'
    } else if (!hasNoExpiry) {
      return 'Thiếu hạn: nhập ngày hết hạn hoặc đánh dấu không thời hạn'
    }
    await withTransaction(pool, async (conn) => {
      await conn.query('UPDATE document_field SET state = ?, decided_by = ?, decided_at = NOW() WHERE document_id = ? AND state = ? AND value <> \'\'', [
        'ACCEPTED', userId, id, 'PROPOSED',
      ])
      // Có "không thời hạn" thì ô hạn để trống là chủ ý.
      await conn.query('UPDATE document_field SET state = ?, decided_by = ?, decided_at = NOW() WHERE document_id = ? AND field_key = ? AND state = ?', [
        'UNKNOWN_KEPT', userId, id, 'valid', 'UNKNOWN',
      ])
    })
    await this.settle(id, doc.doc_type, userId)
    return null
  },

  // Đưa mọi giấy đã duyệt xong của thuyền viên vào hồ sơ: cột hồ sơ (kèm lịch sử sửa), chứng chỉ và dòng đi tàu.
  async publish(seafarerId, userId) {
    const [docs] = await pool.query(`${DOC_SELECT} WHERE d.seafarer_id = ? AND d.status = ? AND d.deleted_at IS NULL ORDER BY d.upload_id, d.page_from, d.id`, [seafarerId, DOC_STATUS.COMPLETED])
    const [[pending]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE seafarer_id = ? AND status IN (?) AND deleted_at IS NULL', [seafarerId, [DOC_STATUS.REVIEW_REQUIRED, DOC_STATUS.READING]])
    if (pending.n > 0) throw { statusCode: 409, message: 'Còn giấy chưa duyệt xong' }
    const [[mismatch]] = await pool.query(
      'SELECT COUNT(*) AS n FROM seafarer_document WHERE seafarer_id = ? AND owner_mismatch = 1 AND owner_mismatch_confirmed_by IS NULL AND status NOT IN (?) AND deleted_at IS NULL',
      [seafarerId, [DOC_STATUS.PUBLISHED, DOC_STATUS.SKIPPED]]
    )
    if (mismatch.n > 0) throw { statusCode: 409, message: 'Có giấy mang tên khác hồ sơ chưa xác nhận. Xác nhận "Vẫn đúng người" hoặc bỏ giấy đó.' }
    if (!docs.length) throw { statusCode: 409, message: 'Không có giấy nào đã duyệt xong để đưa vào hồ sơ' }

    const [allFields] = await pool.query('SELECT * FROM document_field WHERE document_id IN (?)', [docs.map((doc) => doc.id)])
    const fieldsOf = (doc) => allFields.filter((field) => field.document_id === doc.id)
    const [ranks] = await pool.query('SELECT id, code, name_vi, name_en FROM "rank"')
    const profile = {}
    const certificates = []
    const seaServices = []
    for (const doc of docs) {
      Object.assign(profile, profileChanges(doc.doc_type, fieldsOf(doc)))
      if (DOC_TYPES[doc.doc_type]?.certificate) certificates.push(await this.certificateRow(doc, fieldsOf(doc), certificates))
      if (doc.doc_type === 'seaman_book_duty') seaServices.push(this.seaServiceRow(doc, fieldsOf(doc), ranks, userId))
    }

    // Hồ sơ, chứng chỉ, dòng đi tàu và trạng thái giấy ghi cùng một transaction: lỗi giữa chừng thì không ghi gì.
    try {
      await withTransaction(pool, async (conn) => {
        if (Object.keys(profile).length) {
          await seafarerService.applyUpdate(conn, seafarerId, profile, userId, `Từ giấy tờ đã duyệt: ${docs.map((doc) => DOC_TYPES[doc.doc_type].label).join(', ')}`)
        }
        for (const row of certificates) {
          await conn.query('INSERT INTO seafarer_certificate SET ?', [{ ...row, seafarer_id: seafarerId, created_by: userId, updated_by: userId }])
        }
        for (const row of seaServices) await seaServiceService.insertFromDocument(conn, { ...row, seafarer_id: seafarerId })
        const [done] = await conn.query('UPDATE seafarer_document SET status = ?, published_at = NOW(), published_by = ? WHERE id IN (?) AND status = ?', [DOC_STATUS.PUBLISHED, userId, docs.map((doc) => doc.id), DOC_STATUS.COMPLETED])
        // Bấm hai lần cùng lúc: lần sau không thấy giấy COMPLETED nào nữa thì huỷ, tránh ghi chứng chỉ và chuyến đi tàu hai lần.
        if (done.affectedRows !== docs.length) throw { statusCode: 409, message: 'Giấy vừa thay đổi, tải lại trang rồi thử lại' }
      })
    } catch (err) {
      if (err?.code === '23505') throw { statusCode: 409, message: 'Hồ sơ đã có dữ liệu trùng với giấy này (cùng loại và cùng ngày cấp, hoặc giấy đã đưa vào hồ sơ). Tải lại trang rồi thử lại.' }
      throw err
    }
    return { documents: docs.length, profile_fields: Object.keys(profile), certificates: certificates.length, sea_services: seaServices.length }
  },

  // Một giấy chứng chỉ đã duyệt → một dòng seafarer_certificate. Chỉ bắt buộc loại (hoặc tên trên giấy) và hạn (hoặc không thời hạn).
  // batch: các dòng chứng chỉ cùng đợt đưa vào hồ sơ, để bắt trùng giữa các giấy với nhau.
  async certificateRow(doc, fields, batch = []) {
    const pick = (key) => {
      const field = fields.find((item) => item.field_key === key)
      return field && ['ACCEPTED', 'EDITED'].includes(field.state) ? field.value : ''
    }
    const name = doc.file_name
    const code = pick('typeCode')
    const nameRaw = pick('nameRaw').slice(0, 200)
    let typeId = null
    if (code) {
      const [[type]] = await pool.query('SELECT id FROM certificate_type WHERE code = ?', [code])
      if (!type) throw { statusCode: 400, message: `${name}: mã loại chứng chỉ "${code}" không có trong danh mục` }
      typeId = type.id
    } else if (!nameRaw) {
      throw { statusCode: 400, message: `${name}: chứng chỉ cần có "Loại chứng chỉ trong danh mục" hoặc tên chứng chỉ trên giấy trước khi đưa vào hồ sơ` }
    }

    const expiry = pick('valid') ? toIsoDate(pick('valid')) : null
    if (pick('valid') && !expiry) throw { statusCode: 400, message: `${name}: ô "Có giá trị đến" chưa đúng dạng ngày dd/mm/yyyy` }
    const noExpiry = !expiry && pick('noExpiry') === 'true'
    if (!expiry && !noExpiry) throw { statusCode: 400, message: `${name}: chứng chỉ cần có hạn hoặc đánh dấu không thời hạn trước khi đưa vào hồ sơ` }
    const issued = pick('issuedOn') ? toIsoDate(pick('issuedOn')) : null
    if (pick('issuedOn') && !issued) throw { statusCode: 400, message: `${name}: ô "Cấp ngày" chưa đúng dạng ngày dd/mm/yyyy` }
    const number = pick('no')
    if (number.length > 100) throw { statusCode: 400, message: `${name}: số chứng chỉ dài quá 100 ký tự` }

    // Trùng: cùng loại và cùng số, hoặc cùng loại và cùng hạn (với hồ sơ đang có và với các giấy cùng đợt).
    if (typeId) {
      const same = (row) => row.certificate_type_id === typeId &&
        ((number && row.certificate_number === number) || (expiry && row.expiry_date === expiry))
      const [existing] = await pool.query(
        `SELECT certificate_type_id, certificate_number, TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date
         FROM seafarer_certificate WHERE seafarer_id = ? AND certificate_type_id = ? AND deleted_at IS NULL`,
        [doc.seafarer_id, typeId]
      )
      if (existing.some(same) || batch.some(same)) {
        throw { statusCode: 409, message: `${name}: hồ sơ đã có chứng chỉ này (cùng loại và cùng số hoặc cùng hạn). Bỏ giấy hoặc sửa số, hạn.` }
      }
    }
    return {
      certificate_type_id: typeId,
      certificate_name_raw: nameRaw || null,
      certificate_number: number || null,
      issued_date: issued,
      expiry_date: expiry,
      no_expiry: noExpiry ? 1 : 0,
      issued_by: pick('issuer').slice(0, 200) || null,
      holder_name_raw: pick('holder').slice(0, 150) || null,
      source_document_id: doc.id,
      status: expiry && expiry < new Date().toISOString().slice(0, 10) ? 'EXPIRED' : 'VALID',
      notes: `Từ giấy tờ đã duyệt: ${name}`,
    }
  },

  // Một trang bố trí chức danh đã duyệt → một dòng sea_service (chữ gốc, chức danh chuẩn hoá bằng code, đối chiếu tàu lấy từ giấy).
  seaServiceRow(doc, fields, ranks, userId) {
    const pick = (key) => {
      const field = fields.find((item) => item.field_key === key)
      return field && ['ACCEPTED', 'EDITED'].includes(field.state) ? field.value : ''
    }
    const name = doc.file_name
    const date = (key, label) => {
      const value = pick(key)
      if (!value) return null
      const iso = toIsoDate(value)
      if (!iso) throw { statusCode: 400, message: `${name}: ô "${label}" chưa đúng dạng ngày dd/mm/yyyy` }
      return iso
    }
    const ship = pick('ship')
    const rank = pick('rank')
    if (!ship && !rank) throw { statusCode: 400, message: `${name}: trang bố trí chức danh cần có tên tàu hoặc chức danh trước khi đưa vào hồ sơ` }
    return {
      document_id: doc.id,
      vessel_name_raw: ship || null,
      vessel_type_raw: pick('type') || null,
      flag_raw: pick('flag') || null,
      gross_tonnage_raw: pick('gt') || null,
      engine_power_raw: pick('kw') || null,
      owner_raw: pick('owner') || null,
      vessel_id: doc.vessel_id || null,
      vessel_match_status: doc.vessel_id ? 'MATCHED' : doc.vessel_match_status || 'NOT_CHECKED',
      rank_raw: rank || null,
      rank_id: rank ? normalizeRank(rank, ranks)?.id ?? null : null,
      coc_number: pick('coc') || null,
      sign_on_date: date('onDate', 'Ngày xuống tàu'),
      sign_on_port: pick('onPort') || null,
      sign_off_date: date('offDate', 'Ngày rời tàu'),
      sign_off_port: pick('offPort') || null,
      created_by: userId,
      updated_by: userId,
    }
  },

  async remove(id) {
    const doc = await this.get(id)
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không xoá được' }
    await pool.query('UPDATE seafarer_document SET deleted_at = NOW() WHERE id = ?', [id])
    // Hết giấy thì bỏ luôn tệp cha, để thả lại cùng tệp không bị báo trùng.
    if (doc.upload_id) {
      const [[left]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE upload_id = ? AND deleted_at IS NULL', [doc.upload_id])
      if (left.n === 0) await pool.query('UPDATE document_upload SET deleted_at = NOW() WHERE id = ?', [doc.upload_id])
    }
    return { success: true }
  },

  // Người dùng đổi loại giấy: xoá ô cũ, đọc lại theo loại mới ("other" thì không đọc).
  async retype(id, docType) {
    const doc = await this.get(id)
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không đổi loại được' }
    if (!DOC_TYPES[docType] && docType !== OTHER_TYPE) throw { statusCode: 400, message: 'Loại giấy không hợp lệ' }
    if (!doc.upload_id) throw { statusCode: 409, message: 'Giấy cũ chưa có tệp tải lên, không đổi loại được' }
    if (docType !== OTHER_TYPE && !documentReader.isConfigured()) throw { statusCode: 503, message: ai.notConfiguredMessage() }
    const skipped = docType === OTHER_TYPE
    await withTransaction(pool, async (conn) => {
      await conn.query('DELETE FROM document_field WHERE document_id = ?', [id])
      await conn.query(
        'UPDATE seafarer_document SET doc_type = ?, type_source = ?, page_label = NULL, status = ?, error = NULL, owner_mismatch = 0, owner_mismatch_confirmed_by = NULL WHERE id = ?',
        [docType, 'USER', skipped ? DOC_STATUS.SKIPPED : DOC_STATUS.READING, id]
      )
      if (!skipped) await conn.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.READING, doc.upload_id])
    })
    if (!skipped) setImmediate(() => { this.extract(id).catch(() => {}) })
    else await this.finishUpload(doc.upload_id)
    return this.get(id)
  },

  // Người dùng gom hoặc tách lại trang: parts = [{ pageFrom, pageTo, docType? }] phải phủ đúng các trang
  // chưa đưa vào hồ sơ, mỗi trang một lần. Giấy chưa đưa vào hồ sơ được dựng lại theo parts.
  async regroup(uploadId, parts) {
    const upload = await this.getUpload(uploadId)
    const [[row]] = await pool.query('SELECT * FROM document_upload WHERE id = ?', [uploadId])
    if (!upload.page_count) throw { statusCode: 409, message: 'Tệp chưa được cắt trang' }
    if (!Array.isArray(parts) || !parts.length) throw { statusCode: 400, message: 'Chưa có nhóm trang nào' }
    const [published] = await pool.query('SELECT page_from, page_to FROM seafarer_document WHERE upload_id = ? AND status = ? AND deleted_at IS NULL', [uploadId, DOC_STATUS.PUBLISHED])
    const locked = new Set(published.flatMap((doc) => Array.from({ length: doc.page_to - doc.page_from + 1 }, (_, i) => doc.page_from + i)))
    const free = []
    for (let page = 1; page <= upload.page_count; page += 1) if (!locked.has(page)) free.push(page)

    const seen = new Set()
    for (const part of parts) {
      const { pageFrom, pageTo } = part
      if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom < 1 || pageTo < pageFrom || pageTo > upload.page_count) {
        throw { statusCode: 400, message: 'Khoảng trang không hợp lệ' }
      }
      if (part.docType && !DOC_TYPES[part.docType] && part.docType !== OTHER_TYPE) throw { statusCode: 400, message: 'Loại giấy không hợp lệ' }
      for (let page = pageFrom; page <= pageTo; page += 1) {
        if (locked.has(page)) throw { statusCode: 409, message: `Trang ${page} thuộc giấy đã đưa vào hồ sơ, không gom lại được` }
        if (seen.has(page)) throw { statusCode: 400, message: `Trang ${page} nằm trong hai nhóm` }
        seen.add(page)
      }
    }
    const missing = free.filter((page) => !seen.has(page))
    if (missing.length) throw { statusCode: 400, message: `Còn trang chưa thuộc nhóm nào: ${missing.join(', ')}` }

    const [pageRows] = await pool.query('SELECT page_no, split_type FROM document_upload_page WHERE upload_id = ?', [uploadId])
    const splitTypeOf = new Map(pageRows.map((page) => [page.page_no, page.split_type]))
    const [oldDocs] = await pool.query('SELECT page_from, page_to, doc_type FROM seafarer_document WHERE upload_id = ? AND status <> ? AND deleted_at IS NULL', [uploadId, DOC_STATUS.PUBLISHED])
    const sorted = [...parts].sort((a, b) => a.pageFrom - b.pageFrom)
    const papers = sorted.map((part) => {
      let type = part.docType
      let source = 'USER'
      if (!type) {
        // Không chỉ định: giữ loại của giấy cũ cùng khoảng trang, không thì lấy loại AI gán cho trang đầu có loại.
        const same = oldDocs.find((doc) => doc.page_from === part.pageFrom && doc.page_to === part.pageTo && doc.doc_type)
        const fromSplit = Array.from({ length: part.pageTo - part.pageFrom + 1 }, (_, i) => splitTypeOf.get(part.pageFrom + i)).find((t) => t && t !== OTHER_TYPE)
        type = same?.doc_type || fromSplit || OTHER_TYPE
        source = 'AI'
      }
      return { type, pageFrom: part.pageFrom, pageTo: part.pageTo, label: null, source }
    })
    if (papers.some((paper) => paper.type !== OTHER_TYPE) && !documentReader.isConfigured()) {
      throw { statusCode: 503, message: ai.notConfiguredMessage() }
    }

    const created = await withTransaction(pool, async (conn) => {
      const ids = await this.replaceDocuments(conn, row, papers)
      if (ids.length) await conn.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.READING, uploadId])
      return ids
    })
    const reading = created.length
    if (reading) {
      const [toRead] = await pool.query('SELECT id FROM seafarer_document WHERE upload_id = ? AND status = ? AND deleted_at IS NULL', [uploadId, DOC_STATUS.READING])
      setImmediate(async () => {
        for (const doc of toRead) await this.extract(doc.id).catch(() => {})
      })
    }
    await this.finishUpload(uploadId)
    const uploadNow = await this.getUpload(uploadId)
    const documents = (await this.list(upload.seafarer_id)).filter((doc) => doc.upload_id === uploadId)
    return { upload: uploadNow, documents }
  },

  // Tệp gốc của giấy: tệp cha nếu có, giấy cũ thì tệp trên chính dòng giấy.
  async fileOf(id) {
    const [[doc]] = await pool.query(
      `SELECT COALESCE(u.storage_path, d.storage_path) AS storage_path, COALESCE(u.mime_type, d.mime_type) AS mime_type, COALESCE(u.file_name, d.file_name) AS file_name
       FROM seafarer_document d LEFT JOIN document_upload u ON u.id = d.upload_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    )
    if (!doc || !doc.storage_path || !fs.existsSync(doc.storage_path)) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
    return doc
  },

  async getUpload(id) {
    const [[upload]] = await pool.query(
      `SELECT u.*, (SELECT COUNT(*) FROM seafarer_document d WHERE d.upload_id = u.id AND d.deleted_at IS NULL) AS document_count
       FROM document_upload u WHERE u.id = ? AND u.deleted_at IS NULL`,
      [id]
    )
    if (!upload) throw { statusCode: 404, message: 'Không tìm thấy tệp tải lên' }
    return shapeUpload(upload)
  },

  async listUploads(seafarerId) {
    const [uploads] = await pool.query(
      `SELECT u.*, (SELECT COUNT(*) FROM seafarer_document d WHERE d.upload_id = u.id AND d.deleted_at IS NULL) AS document_count
       FROM document_upload u WHERE u.seafarer_id = ? AND u.deleted_at IS NULL ORDER BY u.id`,
      [seafarerId]
    )
    if (!uploads.length) return []
    const [groups] = await pool.query(
      `SELECT upload_id, doc_type, status, COUNT(*) AS n FROM seafarer_document
       WHERE upload_id IN (?) AND deleted_at IS NULL GROUP BY upload_id, doc_type, status`,
      [uploads.map((upload) => upload.id)]
    )
    return uploads.map((upload) => shapeUpload({ ...upload, summary: summarizeUpload(upload, groups.filter((group) => group.upload_id === upload.id)) }))
  },

  async uploadFile(id) {
    const [[upload]] = await pool.query('SELECT storage_path, mime_type, file_name FROM document_upload WHERE id = ? AND deleted_at IS NULL', [id])
    if (!upload || !fs.existsSync(upload.storage_path)) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
    return upload
  },

  // size: 'thumb' (ảnh thu nhỏ) hoặc 'full' (ảnh trang đầy đủ).
  async pageImage(uploadId, pageNo, size) {
    const [[page]] = await pool.query(
      `SELECT p.image_path, p.thumb_path FROM document_upload_page p JOIN document_upload u ON u.id = p.upload_id
       WHERE p.upload_id = ? AND p.page_no = ? AND u.deleted_at IS NULL`,
      [uploadId, pageNo]
    )
    const file = page && (size === 'thumb' ? page.thumb_path : page.image_path)
    if (!file || !fs.existsSync(file)) throw { statusCode: 404, message: 'Không tìm thấy ảnh trang' }
    return file
  },

  // Bỏ cả tệp (và các giấy của nó) khi chưa giấy nào vào hồ sơ.
  // Thử lại cả tệp: tệp lỗi hoặc đã kẹt quá STALLED_MINUTES phút. Chạy lại từ bước còn dở (process bỏ qua bước đã xong).
  async retryUpload(id) {
    const [[upload]] = await pool.query('SELECT * FROM document_upload WHERE id = ? AND deleted_at IS NULL', [id])
    if (!upload) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
    const stalled = BUSY_UPLOAD_STATES.includes(upload.status) && Date.now() - new Date(upload.updated_at).getTime() > STALLED_MINUTES * 60 * 1000
    if (upload.status !== UPLOAD_STATUS.FAILED && !stalled) throw { statusCode: 409, message: 'Chỉ thử lại được tệp lỗi hoặc đang kẹt' }
    if (!documentReader.isConfigured()) throw { statusCode: 503, message: ai.notConfiguredMessage() }
    await pool.query('UPDATE document_upload SET status = ?, error = NULL WHERE id = ?', [UPLOAD_STATUS.RECEIVED, id])
    setImmediate(() => { this.process(id).catch(() => {}) })
    return this.getUpload(id)
  },

  async removeUpload(id) {
    await this.getUpload(id)
    const [[published]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE upload_id = ? AND status = ? AND deleted_at IS NULL', [id, DOC_STATUS.PUBLISHED])
    if (published.n > 0) throw { statusCode: 409, message: 'Tệp có giấy đã đưa vào hồ sơ, không xoá được' }
    await withTransaction(pool, async (conn) => {
      await conn.query('UPDATE seafarer_document SET deleted_at = NOW() WHERE upload_id = ? AND deleted_at IS NULL', [id])
      await conn.query('UPDATE document_upload SET deleted_at = NOW() WHERE id = ?', [id])
    })
    return { success: true }
  },
}

module.exports = { documentService, summarizeUpload, categoryOf, sniffMime, toIsoDate, applyAction, docStatusOf, profileChanges, DONE_STATES }
