const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const pool = require('../config/db')
const { withTransaction } = require('../utils/transaction')
const config = require('../config')
const documentReader = require('./document_reader.service')
const seafarerService = require('./seafarer.service')
const { DOC_TYPES, DOC_STATUS, TODO_STATES, DONE_STATES, ALLOWED_MIME, MAX_FILE_BYTES } = require('../constants/document_types')

const FIELD_ACTIONS = ['accept', 'edit', 'reject', 'keepUnknown', 'undo']

// Magic bytes: PDF=%PDF, JPEG=FFD8FF, PNG=89504E47. Không tin MIME trình duyệt gửi lên.
function sniffMime(buffer) {
  const b = buffer.subarray(0, 4)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  return null
}

// '13/03/1990' hoặc '13.03.1990' → '1990-03-13'; sai thì null.
function toIsoDate(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})$/)
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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

function docStatusOf(fields) {
  return fields.some((field) => TODO_STATES.includes(field.state)) ? DOC_STATUS.REVIEW_REQUIRED : DOC_STATUS.COMPLETED
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

function shape(doc, fields) {
  const layout = DOC_TYPES[doc.doc_type]
  const byKey = new Map(fields.map((field) => [field.field_key, field]))
  return {
    id: doc.id,
    seafarer_id: doc.seafarer_id,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    doc_type: doc.doc_type,
    label: layout?.label || 'Chưa nhận ra loại giấy',
    title: layout?.title || null,
    page: doc.page_label,
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
      }
    }),
  }
}

const documentService = {
  async upload(seafarerId, file, userId) {
    const [[seafarer]] = await pool.query('SELECT id FROM seafarer WHERE id = ? AND deleted_at IS NULL', [seafarerId])
    if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const buffer = await file.toBuffer()
    if (file.file?.truncated || buffer.length > MAX_FILE_BYTES) throw { statusCode: 413, message: 'Tệp lớn hơn 25 MB, chọn bản nhỏ hơn' }
    const mime = sniffMime(buffer)
    if (!mime || !ALLOWED_MIME.includes(mime)) throw { statusCode: 400, message: 'Chỉ nhận PDF, JPG, PNG' }

    const dir = path.join(config.upload.dir, 'documents', String(seafarerId))
    fs.mkdirSync(dir, { recursive: true })
    const ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }[mime]
    const storagePath = path.join(dir, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`)
    fs.writeFileSync(storagePath, buffer)

    const name = path.basename(String(file.filename || 'giay-to')).slice(0, 255)
    const [result] = await pool.query(
      'INSERT INTO seafarer_document (seafarer_id, file_name, mime_type, file_size, storage_path, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [seafarerId, name, mime, buffer.length, storagePath, DOC_STATUS.READING, userId]
    )
    const id = result.insertId
    // AI đọc chạy sau khi trả lời, frontend hỏi lại trạng thái.
    setImmediate(() => { this.extract(id).catch(() => {}) })
    return this.get(id)
  },

  async extract(id) {
    const [[doc]] = await pool.query('SELECT * FROM seafarer_document WHERE id = ? AND deleted_at IS NULL', [id])
    if (!doc) return
    try {
      const [types] = await pool.query('SELECT code, name_vi FROM certificate_type ORDER BY id')
      const result = await documentReader.read(fs.readFileSync(doc.storage_path), doc.mime_type, types)
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
      await pool.query('UPDATE seafarer_document SET doc_type = ?, page_label = ?, status = ?, error = NULL WHERE id = ?', [
        result.doc_type, result.page_label, docStatusOf(result.fields), id,
      ])
    } catch (err) {
      const message = err?.statusCode ? err.message : 'AI đọc giấy bị lỗi. Thử đọc lại.'
      await pool.query('UPDATE seafarer_document SET status = ?, error = ? WHERE id = ?', [DOC_STATUS.FAILED, message.slice(0, 500), id])
    }
  },

  async retry(id) {
    const doc = await this.get(id)
    if (doc.status !== DOC_STATUS.FAILED) throw { statusCode: 409, message: 'Chỉ đọc lại được giấy đọc lỗi' }
    if (!documentReader.isConfigured()) throw { statusCode: 503, message: 'AI đọc giấy tờ chưa được cấu hình (thiếu ANTHROPIC_API_KEY)' }
    await pool.query('UPDATE seafarer_document SET status = ?, error = NULL WHERE id = ?', [DOC_STATUS.READING, id])
    setImmediate(() => { this.extract(id).catch(() => {}) })
    return this.get(id)
  },

  async list(seafarerId) {
    const [docs] = await pool.query('SELECT * FROM seafarer_document WHERE seafarer_id = ? AND deleted_at IS NULL ORDER BY id', [seafarerId])
    if (!docs.length) return []
    const [fields] = await pool.query('SELECT * FROM document_field WHERE document_id IN (?) ORDER BY id', [docs.map((doc) => doc.id)])
    return docs.map((doc) => shape(doc, fields.filter((field) => field.document_id === doc.id)))
  },

  async get(id) {
    const [[doc]] = await pool.query('SELECT * FROM seafarer_document WHERE id = ? AND deleted_at IS NULL', [id])
    if (!doc) throw { statusCode: 404, message: 'Không tìm thấy giấy tờ' }
    const [fields] = await pool.query('SELECT * FROM document_field WHERE document_id = ? ORDER BY id', [id])
    return shape(doc, fields)
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
    const [fields] = await pool.query('SELECT state FROM document_field WHERE document_id = ?', [id])
    await pool.query('UPDATE seafarer_document SET status = ? WHERE id = ?', [docStatusOf(fields), id])
    return this.get(id)
  },

  // Đưa mọi giấy đã duyệt xong của thuyền viên vào hồ sơ: cột hồ sơ (kèm lịch sử sửa) và chứng chỉ.
  async publish(seafarerId, userId) {
    const [docs] = await pool.query('SELECT * FROM seafarer_document WHERE seafarer_id = ? AND status = ? AND deleted_at IS NULL', [seafarerId, DOC_STATUS.COMPLETED])
    const [[pending]] = await pool.query('SELECT COUNT(*) AS n FROM seafarer_document WHERE seafarer_id = ? AND status IN (?) AND deleted_at IS NULL', [seafarerId, [DOC_STATUS.REVIEW_REQUIRED, DOC_STATUS.READING]])
    if (pending.n > 0) throw { statusCode: 409, message: 'Còn giấy chưa duyệt xong' }
    if (!docs.length) throw { statusCode: 409, message: 'Không có giấy nào đã duyệt xong để đưa vào hồ sơ' }

    const [allFields] = await pool.query('SELECT * FROM document_field WHERE document_id IN (?)', [docs.map((doc) => doc.id)])
    const fieldsOf = (doc) => allFields.filter((field) => field.document_id === doc.id)
    const profile = {}
    const certificates = []
    for (const doc of docs) {
      Object.assign(profile, profileChanges(doc.doc_type, fieldsOf(doc)))
      if (DOC_TYPES[doc.doc_type]?.certificate) certificates.push(await this.certificateRow(doc, fieldsOf(doc)))
    }

    // Hồ sơ, chứng chỉ và trạng thái giấy ghi cùng một transaction: lỗi giữa chừng thì không ghi gì.
    await withTransaction(pool, async (conn) => {
      if (Object.keys(profile).length) {
        await seafarerService.applyUpdate(conn, seafarerId, profile, userId, `Từ giấy tờ đã duyệt: ${docs.map((doc) => DOC_TYPES[doc.doc_type].label).join(', ')}`)
      }
      for (const row of certificates) {
        await conn.query('INSERT INTO seafarer_certificate SET ?, seafarer_id = ?, created_by = ?, updated_by = ?', [row, seafarerId, userId, userId])
      }
      const [done] = await conn.query('UPDATE seafarer_document SET status = ?, published_at = NOW(), published_by = ? WHERE id IN (?) AND status = ?', [DOC_STATUS.PUBLISHED, userId, docs.map((doc) => doc.id), DOC_STATUS.COMPLETED])
      // Bấm hai lần cùng lúc: lần sau không thấy giấy COMPLETED nào nữa thì huỷ, tránh ghi chứng chỉ hai lần.
      if (done.affectedRows !== docs.length) throw { statusCode: 409, message: 'Giấy vừa thay đổi, tải lại trang rồi thử lại' }
    })
    return { documents: docs.length, profile_fields: Object.keys(profile), certificates: certificates.length }
  },

  async certificateRow(doc, fields) {
    const pick = (key) => {
      const field = fields.find((item) => item.field_key === key)
      return field && ['ACCEPTED', 'EDITED'].includes(field.state) ? field.value : ''
    }
    const code = pick('typeCode')
    const issued = toIsoDate(pick('issuedOn'))
    if (!code || !issued) throw { statusCode: 400, message: `${doc.file_name}: chứng chỉ cần có "Loại chứng chỉ trong danh mục" và "Cấp ngày" trước khi đưa vào hồ sơ` }
    const [[type]] = await pool.query('SELECT id FROM certificate_type WHERE code = ?', [code])
    if (!type) throw { statusCode: 400, message: `${doc.file_name}: mã loại chứng chỉ "${code}" không có trong danh mục` }
    if (pick('no').length > 100) throw { statusCode: 400, message: `${doc.file_name}: số chứng chỉ dài quá 100 ký tự` }
    const [[dup]] = await pool.query(
      'SELECT id FROM seafarer_certificate WHERE seafarer_id = ? AND certificate_type_id = ? AND issued_date = ?',
      [doc.seafarer_id, type.id, issued]
    )
    if (dup) throw { statusCode: 409, message: `${doc.file_name}: hồ sơ đã có chứng chỉ này (cùng loại, cùng ngày cấp). Bỏ giấy hoặc sửa ngày cấp.` }
    const expiry = pick('valid') ? toIsoDate(pick('valid')) : null
    if (pick('valid') && !expiry) throw { statusCode: 400, message: `${doc.file_name}: ô "Có giá trị đến" chưa đúng dạng ngày dd/mm/yyyy` }
    return {
      certificate_type_id: type.id,
      certificate_number: pick('no') || null,
      issued_date: issued,
      expiry_date: expiry,
      issued_by: pick('school') || null,
      status: expiry && expiry < new Date().toISOString().slice(0, 10) ? 'EXPIRED' : 'VALID',
      notes: `Từ giấy tờ đã duyệt: ${doc.file_name}`,
    }
  },

  async remove(id) {
    const doc = await this.get(id)
    if (doc.status === DOC_STATUS.PUBLISHED) throw { statusCode: 409, message: 'Giấy đã đưa vào hồ sơ, không xoá được' }
    await pool.query('UPDATE seafarer_document SET deleted_at = NOW() WHERE id = ?', [id])
    return { success: true }
  },

  async fileOf(id) {
    const [[doc]] = await pool.query('SELECT storage_path, mime_type, file_name FROM seafarer_document WHERE id = ? AND deleted_at IS NULL', [id])
    if (!doc || !fs.existsSync(doc.storage_path)) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
    return doc
  },
}

module.exports = { documentService, sniffMime, toIsoDate, applyAction, docStatusOf, profileChanges, DONE_STATES }
