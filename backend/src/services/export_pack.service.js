const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')
const config = require('../config')
const { withTransaction } = require('../utils/transaction')
const { xlsxToPdf } = require('../utils/xlsx_pdf')
const { PACK_TEMPLATES, TEMPLATE_KEYS, STAGE_TITLE, templateOf } = require('../constants/pack_templates')
const formExportService = require('./form_export.service')

// Bộ giấy tờ xuất (B3 tạo, B4 xem và tải, C1 danh sách). Tạo xong là tải về được ngay: từng giấy hoặc cả bộ, PDF hoặc Excel.
// Giấy in ra rồi ký tay; không có bước duyệt hay ký online.

const MAX_EDITS_PER_DOC = 200
const INPUT_KEYS = [...new Set(['Ngày có mặt', 'Số tiền', 'Lý do thu', 'Tên tàu', 'Ngày xuống tàu', 'Mức đóng', 'Người được ủy quyền', 'Người nhận lương', 'Ngày rời tàu', 'Cảng rời tàu', 'Ngày thanh lý'])]
const CONTENT_TYPE = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// ---------- Luật thuần (có test) ----------

// Giữ đúng thứ tự mẫu, bỏ trùng; hai đơn BHXH không đi cùng nhau.
function normalizeDocs(docs) {
  const keys = [...new Set(docs || [])]
  const unknown = keys.filter((key) => !TEMPLATE_KEYS.includes(key))
  if (unknown.length) throw { statusCode: 400, message: `Mẫu giấy không hợp lệ: ${unknown.join(', ')}` }
  if (!keys.length) throw { statusCode: 400, message: 'Chọn ít nhất một giấy' }
  if (keys.includes('bhxh') && keys.includes('kbhxh')) throw { statusCode: 400, message: 'Chỉ chọn một trong hai đơn BHXH' }
  return TEMPLATE_KEYS.filter((key) => keys.includes(key))
}

function packTitle(docs) {
  const stages = [...new Set(docs.map((key) => templateOf(key).stage))]
  return stages.length === 1 ? STAGE_TITLE[stages[0]] : 'Bộ giấy'
}

// Chỉ nhận ô điền đã biết, cắt chuỗi rỗng.
function cleanInputs(inputs) {
  const out = {}
  for (const key of INPUT_KEYS) {
    const value = inputs?.[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 200)
  }
  return out
}

const MAX_RUNS_PER_CELL = 50
const ALIGNS = ['left', 'center', 'right', 'justify']
const HEX_COLOR = /^#[0-9a-f]{6}$/i

// Một đoạn chữ: luôn có ba cờ đậm, nghiêng, gạch chân; gạch ngang, màu (#rrggbb), cỡ chữ (pt) chỉ có khi khác ô gốc.
function cleanRun(run) {
  const out = { text: run.text.slice(0, 2000), bold: run.bold === true, italic: run.italic === true, underline: run.underline === true }
  if (run.strike === true) out.strike = true
  if (typeof run.color === 'string' && HEX_COLOR.test(run.color)) out.color = run.color.toLowerCase()
  const size = Number(run.size)
  if (run.size != null && Number.isFinite(size) && size >= 6 && size <= 72) out.size = Math.round(size * 2) / 2
  return out
}

function cleanRuns(value) {
  if (typeof value === 'string') return value.slice(0, 2000)
  if (!Array.isArray(value)) return undefined
  const runs = value
    .filter((run) => run && typeof run.text === 'string' && run.text)
    .slice(0, MAX_RUNS_PER_CELL)
    .map(cleanRun)
  return runs.length ? runs : ''
}

// Giá trị một ô sửa tay: chuỗi, mảng đoạn có định dạng, hoặc { runs: chuỗi | mảng đoạn, align } khi đổi căn lề.
// Không hợp lệ thì trả undefined.
function cleanCell(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const runs = cleanRuns(value.runs)
    if (runs === undefined) return undefined
    return ALIGNS.includes(value.align) ? { runs, align: value.align } : runs
  }
  return cleanRuns(value)
}

// Ô sửa tay trên giấy: { mẫu: { 'B7': 'nội dung' } }. Chỉ giữ mẫu có trong bộ và địa chỉ ô hợp lệ; chuỗi rỗng là xoá trắng ô.
function cleanEdits(edits, docs) {
  const out = {}
  for (const key of docs) {
    const cells = Object.entries(edits?.[key] || {})
      .map(([address, value]) => [address, cleanCell(value)])
      .filter(([address, value]) => /^[A-Z]{1,2}[1-9]\d{0,3}$/.test(address) && value !== undefined)
      .slice(0, MAX_EDITS_PER_DOC)
    if (cells.length) out[key] = Object.fromEntries(cells)
  }
  return out
}

const packCode = (id) => `B${String(id).padStart(4, '0')}`
const packIdFromCode = (code) => {
  const match = /^B?(\d{1,9})$/i.exec(String(code || ''))
  return match ? Number(match[1]) : null
}

// Tên file trong bộ: số thứ tự theo vị trí giấy trong bộ, bỏ ký tự không đặt tên file được.
const safeName = (text) => String(text).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
const docFileName = (docs, key, format) => `${String(docs.indexOf(key) + 1).padStart(2, '0')} ${safeName(templateOf(key).name)}.${format}`

// Đường dẫn các file trong .zip: một thư mục mang mã bộ và tên người; tải cả hai định dạng thì chia thư mục con PDF và Excel.
function zipPaths(folder, docs, key, format) {
  const sub = { pdf: 'PDF', xlsx: 'Excel' }
  const formats = format === 'all' ? ['pdf', 'xlsx'] : [format]
  return Object.fromEntries(formats.map((f) => [f, `${folder}/${format === 'all' ? `${sub[f]}/` : ''}${docFileName(docs, key, f)}`]))
}

// ---------- DB ----------

const parseJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value || {})

async function loadPack(pool, id, { forUpdate = false } = {}) {
  const [[row]] = await pool.query(
    `SELECT p.*, s.full_name AS seafarer_name, o.company_name AS ship_owner_name, u.email AS created_by_email,
            op.code AS opportunity_code
     FROM export_pack p
     LEFT JOIN opportunity op ON op.id = p.opportunity_id
     JOIN seafarer s ON s.id = p.seafarer_id
     LEFT JOIN ship_owner o ON o.id = p.ship_owner_id
     JOIN "user" u ON u.id = p.created_by
     WHERE p.id = ? AND p.deleted_at IS NULL${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  )
  if (!row) throw { statusCode: 404, message: 'Không tìm thấy bộ giấy' }
  const [docs] = await pool.query('SELECT template_key FROM export_pack_doc WHERE pack_id = ? ORDER BY sort_order', [id])
  return { row, docs: docs.map((d) => d.template_key) }
}

function shape({ row, docs }) {
  return {
    id: row.id,
    code: packCode(row.id),
    seafarer_id: row.seafarer_id,
    seafarer_name: row.seafarer_name,
    ship_owner_id: row.ship_owner_id,
    ship_owner_name: row.ship_owner_name || null,
    opportunity_id: row.opportunity_id || null,
    opportunity_code: row.opportunity_code || null,
    title: row.title,
    docs,
    inputs: parseJson(row.inputs),
    edits: parseJson(row.edits),
    created_by: row.created_by,
    created_by_email: row.created_by_email,
    created_at: row.created_at,
  }
}

// Loại giấy trên hồ sơ (seafarer_document.doc_type) ứng với ba giấy lưu ở cột seafarer.
const DOC_TYPE_OF_CODE = { PASSPORT: 'passport', SEAMAN_BOOK: 'seaman_book_info' }

// File giấy tờ, chứng chỉ của thuyền viên khớp các yêu cầu CERTIFICATE của cơ hội.
// Chứng chỉ: file tải tay (document_url) hoặc tệp gốc của giấy AI đọc (source_document_id); hộ chiếu, sổ: tệp gốc của giấy cùng loại mới nhất.
async function requirementFiles(pool, opportunityId, seafarerId) {
  const [reqs] = await pool.query(
    `SELECT q.certificate_type_id, ct.code, ct.name_vi FROM opportunity_requirement q JOIN certificate_type ct ON ct.id = q.certificate_type_id
     WHERE q.opportunity_id = ? AND q.kind = 'CERTIFICATE' ORDER BY q.sort_order, q.id`, [opportunityId])
  const found = []
  const lacking = []
  const uploadPath = async (documentId) => {
    const [[up]] = await pool.query(
      `SELECT u.storage_path FROM seafarer_document d JOIN document_upload u ON u.id = d.upload_id
       WHERE d.id = ? AND d.deleted_at IS NULL`, [documentId])
    return up?.storage_path
  }
  for (const req of reqs) {
    let file = null
    if (DOC_TYPE_OF_CODE[req.code]) {
      const [[doc]] = await pool.query(
        'SELECT id FROM seafarer_document WHERE seafarer_id = ? AND doc_type = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [seafarerId, DOC_TYPE_OF_CODE[req.code]])
      file = doc ? await uploadPath(doc.id) : null
    } else {
      const [[cert]] = await pool.query(
        `SELECT document_url, source_document_id FROM seafarer_certificate
         WHERE seafarer_id = ? AND certificate_type_id = ? AND deleted_at IS NULL AND status <> 'REVOKED'
         ORDER BY (document_url IS NOT NULL OR source_document_id IS NOT NULL) DESC, expiry_date DESC NULLS LAST LIMIT 1`,
        [seafarerId, req.certificate_type_id])
      if (cert?.document_url) file = path.join(config.upload.dir, 'certificates', String(seafarerId), path.basename(cert.document_url))
      else if (cert?.source_document_id) file = await uploadPath(cert.source_document_id)
    }
    if (file && fs.existsSync(file)) found.push({ name: req.name_vi, path: file })
    else lacking.push(req.name_vi)
  }
  return { found, lacking }
}

// Điền các giấy `keys` của bộ ra file Excel, rồi chuyển PDF nếu cần.
// Trả về { files: [{ key, xlsx, pdf }], missing: ['Tên giấy: lý do'] }.
async function renderDocs({ row, keys, wantPdf, gridlines }) {
  const edits = parseJson(row.edits)
  const files = []
  const missing = []
  for (const key of keys) {
    const tpl = templateOf(key)
    if (!tpl.formKey) { missing.push(`${tpl.name}: chưa có file mẫu`); continue }
    try {
      const { buffer, pdfSource } = await formExportService.exportForm(row.seafarer_id, tpl.formKey, {
        shipOwnerId: row.ship_owner_id, inputs: parseJson(row.inputs), edits: edits[key], pdfSource: wantPdf, gridlines,
      })
      files.push({ key, xlsx: Buffer.from(buffer), pdfSource: wantPdf ? Buffer.from(pdfSource) : null, pdf: null })
    } catch (error) {
      missing.push(`${tpl.name}: ${error.statusCode === 404 ? 'chưa có file mẫu trên máy chủ' : 'không điền được từ hồ sơ'}`)
    }
  }
  if (wantPdf && files.length) {
    const pdfs = await xlsxToPdf(files.map((file) => file.pdfSource))
    files.forEach((file, i) => {
      file.pdf = pdfs[i]
      if (!file.pdf) missing.push(`${templateOf(file.key).name}: không chuyển được sang PDF`)
    })
  }
  return { files, missing }
}

const exportPackService = {
  templates: () => PACK_TEMPLATES.map(({ formKey, ...rest }) => ({ ...rest, has_file: !!formKey })),

  async list(pool, { search, seafarer_id: seafarerId, ship_owner_id: shipOwnerId, page = 1, limit = 50, ownerId = null }) {
    const where = ['p.deleted_at IS NULL']
    const params = []
    if (ownerId) { where.push('p.created_by = ?'); params.push(ownerId) }
    if (seafarerId) { where.push('p.seafarer_id = ?'); params.push(seafarerId) }
    if (shipOwnerId) { where.push('p.ship_owner_id = ?'); params.push(shipOwnerId) }
    if (search) {
      const code = packIdFromCode(search.trim())
      where.push(code ? '(unaccent(s.full_name::text) ILIKE unaccent(?) OR p.id = ?)' : 'unaccent(s.full_name::text) ILIKE unaccent(?)')
      params.push(`%${search.trim()}%`)
      if (code) params.push(code)
    }
    const whereSql = where.join(' AND ')
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id WHERE ${whereSql}`, params)
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT p.id, p.seafarer_id, s.full_name AS seafarer_name, p.ship_owner_id, o.company_name AS ship_owner_name, p.title, p.created_at, u.email AS created_by_email, p.created_by,
         (SELECT STRING_AGG(d.template_key, ',' ORDER BY d.sort_order) FROM export_pack_doc d WHERE d.pack_id = p.id) AS doc_keys
       FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id JOIN "user" u ON u.id = p.created_by
       LEFT JOIN ship_owner o ON o.id = p.ship_owner_id
       WHERE ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    return {
      data: rows.map((r) => ({
        id: r.id, code: packCode(r.id), seafarer_id: r.seafarer_id, seafarer_name: r.seafarer_name,
        ship_owner_id: r.ship_owner_id, ship_owner_name: r.ship_owner_name || null, title: r.title,
        docs: r.doc_keys ? r.doc_keys.split(',') : [], created_at: r.created_at, created_by: r.created_by, created_by_email: r.created_by_email,
      })),
      total,
    }
  },

  async get(pool, id) {
    return shape(await loadPack(pool, id))
  },

  async create(pool, { seafarer_id: seafarerId, ship_owner_id: shipOwnerId = null, opportunity_id: opportunityId = null, docs, inputs, edits }, user) {
    const keys = normalizeDocs(docs)
    if (opportunityId) {
      const [[candidate]] = await pool.query(
        `SELECT c.id FROM opportunity_candidate c JOIN opportunity o ON o.id = c.opportunity_id
         WHERE c.opportunity_id = ? AND c.seafarer_id = ? AND c.status = 'PICKED' AND o.status = 'OPEN' AND o.deleted_at IS NULL`,
        [opportunityId, seafarerId])
      if (!candidate) throw { statusCode: 409, message: 'Thuyền viên này không còn là ứng viên của cơ hội đang mở' }
    }
    if (shipOwnerId) {
      const [[owner]] = await pool.query('SELECT id FROM ship_owner WHERE id = ? AND deleted_at IS NULL', [shipOwnerId])
      if (!owner) throw { statusCode: 404, message: 'Không tìm thấy chủ tàu' }
    }
    const [[seafarer]] = await pool.query(
      `SELECT s.id, s.full_name, s.date_of_birth, r.name_vi AS rank_name FROM seafarer s LEFT JOIN "rank" r ON r.id = s.current_rank_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [seafarerId]
    )
    if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const snapshot = { full_name: seafarer.full_name, date_of_birth: seafarer.date_of_birth, rank_name: seafarer.rank_name }
    const id = await withTransaction(pool, async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO export_pack (seafarer_id, ship_owner_id, opportunity_id, title, status, inputs, edits, snapshot, created_by) VALUES (?, ?, ?, ?, \'DONE\', ?, ?, ?, ?)',
        [seafarerId, shipOwnerId || null, opportunityId || null, packTitle(keys), JSON.stringify(cleanInputs(inputs)), JSON.stringify(cleanEdits(edits, keys)), JSON.stringify(snapshot), user.id]
      )
      // Bộ mới thay bộ cũ của ứng viên trong cơ hội.
      if (opportunityId) {
        await conn.query('UPDATE opportunity_candidate SET export_pack_id = ? WHERE opportunity_id = ? AND seafarer_id = ?', [result.insertId, opportunityId, seafarerId])
      }
      await conn.query('INSERT INTO export_pack_doc (pack_id, template_key, sort_order) VALUES ?', [keys.map((key, i) => [result.insertId, key, i])])
      return result.insertId
    })
    return this.get(pool, id)
  },

  // Xem trước một giấy đúng như file sẽ xuất: cùng file mẫu, cùng cách điền. Chưa chọn thuyền viên thì ra mẫu trống.
  async preview({ seafarer_id: seafarerId, template_key: templateKey, ship_owner_id: shipOwnerId, inputs, edits }) {
    const tpl = templateOf(templateKey)
    if (!tpl.formKey) throw { statusCode: 404, message: 'Giấy này chưa có file mẫu' }
    return formExportService.previewForm(seafarerId || null, tpl.formKey, {
      shipOwnerId, inputs: cleanInputs(inputs), edits: cleanEdits({ [templateKey]: edits }, [templateKey])[templateKey],
    })
  },

  // Sửa thông tin điền thêm và ô sửa tay của một bộ đã tạo.
  async update(pool, id, { inputs, edits }) {
    await withTransaction(pool, async (conn) => {
      const { docs } = await loadPack(conn, id, { forUpdate: true })
      await conn.query('UPDATE export_pack SET inputs = ?, edits = ? WHERE id = ?', [JSON.stringify(cleanInputs(inputs)), JSON.stringify(cleanEdits(edits, docs)), id])
    })
    return this.get(pool, id)
  },

  // Một giấy của bộ, PDF hoặc Excel.
  async buildDoc(pool, id, key, format, gridlines = false) {
    const { row, docs } = await loadPack(pool, id)
    if (!docs.includes(key)) throw { statusCode: 404, message: 'Bộ này không có giấy đó' }
    const { files, missing } = await renderDocs({ row, keys: [key], wantPdf: format === 'pdf', gridlines })
    const buffer = files[0]?.[format]
    if (!buffer) throw { statusCode: 422, message: `Chưa xuất được ${missing[0] || templateOf(key).name}` }
    return { buffer, contentType: CONTENT_TYPE[format], filename: `${safeName(templateOf(key).name)} - ${safeName(row.seafarer_name)}.${format}` }
  },

  // Cả bộ trong một file .zip, giải nén ra một thư mục. format: pdf | xlsx | all (cả hai, chia thư mục con).
  // Giấy không xuất được ghi vào CHUA-CO.txt.
  async buildZip(pool, id, format = 'all', gridlines = false) {
    const { row, docs } = await loadPack(pool, id)
    const { files, missing } = await renderDocs({ row, keys: docs, wantPdf: format !== 'xlsx', gridlines })
    const folder = `${packCode(row.id)} ${safeName(row.seafarer_name)}`
    const zip = new PizZip()
    for (const file of files) {
      for (const [f, filePath] of Object.entries(zipPaths(folder, docs, file.key, format))) {
        if (file[f]) zip.file(filePath, file[f])
      }
    }
    if (missing.length) zip.file(`${folder}/CHUA-CO.txt`, `Các giấy chưa xuất được:\n${missing.join('\n')}\n`)
    // Bộ của một cơ hội: thêm file giấy tờ, chứng chỉ theo hồ sơ yêu cầu; mục không tìm được file ghi vào THIEU-GIAY.txt.
    if (row.opportunity_id) {
      const { found, lacking } = await requirementFiles(pool, row.opportunity_id, row.seafarer_id)
      found.forEach((file, i) => zip.file(`${folder}/GIAY-TO/${String(i + 1).padStart(2, '0')}-${safeName(file.name)}${path.extname(file.path).toLowerCase()}`, fs.readFileSync(file.path)))
      if (lacking.length) zip.file(`${folder}/THIEU-GIAY.txt`, `Chưa có file trên hồ sơ:\n${lacking.join('\n')}\n`)
    }
    return { buffer: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), filename: `${folder}.zip` }
  },
}

module.exports = {
  exportPackService, requirementFiles,
  normalizeDocs, packTitle, cleanInputs, cleanEdits, packCode, packIdFromCode, zipPaths,
}
