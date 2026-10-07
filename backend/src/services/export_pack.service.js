const crypto = require('crypto')
const PizZip = require('pizzip')
const { PACK_TEMPLATES, TEMPLATE_KEYS, STAGE_TITLE, SELF_SIGNER, templateOf } = require('../constants/pack_templates')
const formExportService = require('./form_export.service')

// Bộ giấy tờ xuất (B3 tạo, B4 duyệt và ký, C1 danh sách, C2 thuyền viên ký qua link).

const SIGN_LINK_HOURS = 72
const MAX_SIGNATURE_BYTES = 300 * 1024
const INPUT_KEYS = [...new Set(['Điểm từng tiêu chuẩn', 'Ngày có mặt', 'Số tiền', 'Lý do thu', 'Tên tàu', 'Ngày xuống tàu', 'Mức đóng', 'Người được ủy quyền', 'Người nhận lương', 'Ngày rời tàu', 'Cảng rời tàu', 'Ngày thanh lý'])]

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

function requiredSignatures(docs) {
  return docs.flatMap((key) => templateOf(key).signers.map((signer) => ({ templateKey: key, signer })))
}

function isComplete(docs, signatures) {
  const done = new Set(signatures.map((s) => `${s.template_key}|${s.signer}`))
  return requiredSignatures(docs).every((s) => done.has(`${s.templateKey}|${s.signer}`))
}

const packCode = (id) => `B${String(id).padStart(4, '0')}`
const packIdFromCode = (code) => {
  const match = /^B?(\d{1,9})$/i.exec(String(code || ''))
  return match ? Number(match[1]) : null
}

function checkSignatureImage(image) {
  if (typeof image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw { statusCode: 400, message: 'Chữ ký phải là ảnh PNG' }
  }
  if (image.length > MAX_SIGNATURE_BYTES * 1.4) throw { statusCode: 413, message: 'Ảnh chữ ký quá lớn' }
}

// ---------- DB ----------

const parseJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value || {})

async function loadPack(pool, id, { forUpdate = false } = {}) {
  const [[row]] = await pool.query(
    `SELECT p.*, s.full_name AS seafarer_name, u.email AS created_by_email, a.email AS approved_by_email
     FROM export_pack p
     JOIN seafarer s ON s.id = p.seafarer_id
     JOIN user u ON u.id = p.created_by
     LEFT JOIN user a ON a.id = p.approved_by
     WHERE p.id = ? AND p.deleted_at IS NULL${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  )
  if (!row) throw { statusCode: 404, message: 'Không tìm thấy bộ giấy' }
  const [docs] = await pool.query('SELECT template_key FROM export_pack_doc WHERE pack_id = ? ORDER BY sort_order', [id])
  const [signatures] = await pool.query(
    `SELECT es.template_key, es.signer, es.signed_at, es.signed_by_user_id, u.email AS signed_by_email
     FROM export_signature es LEFT JOIN user u ON u.id = es.signed_by_user_id WHERE es.pack_id = ?`,
    [id]
  )
  return { row, docs: docs.map((d) => d.template_key), signatures }
}

function shape({ row, docs, signatures }, { includeToken = false } = {}) {
  return {
    id: row.id,
    code: packCode(row.id),
    seafarer_id: row.seafarer_id,
    seafarer_name: row.seafarer_name,
    title: row.title,
    status: row.status,
    docs,
    inputs: parseJson(row.inputs),
    snapshot: parseJson(row.snapshot),
    reject_reason: row.reject_reason,
    stale_reason: row.stale_reason,
    created_by: row.created_by,
    created_by_email: row.created_by_email,
    approved_by_email: row.approved_by_email || null,
    approved_at: row.approved_at,
    created_at: row.created_at,
    signatures: signatures.map((s) => ({ template_key: s.template_key, signer: s.signer, signed_at: s.signed_at, signed_by_email: s.signed_by_email || null })),
    sign_token: includeToken && row.status === 'SIGNING' ? row.sign_token : undefined,
    sign_token_expires_at: includeToken && row.status === 'SIGNING' ? row.sign_token_expires_at : undefined,
  }
}

async function withTransaction(pool, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

const exportPackService = {
  templates: () => PACK_TEMPLATES.map(({ formKey, ...rest }) => ({ ...rest, has_file: !!formKey })),

  async list(pool, { status, search, seafarer_id: seafarerId, page = 1, limit = 50 }) {
    const where = ['p.deleted_at IS NULL']
    const params = []
    if (status) { where.push('p.status = ?'); params.push(status) }
    if (seafarerId) { where.push('p.seafarer_id = ?'); params.push(seafarerId) }
    if (search) {
      const code = packIdFromCode(search.trim())
      where.push(code ? '(s.full_name LIKE ? OR p.id = ?)' : 's.full_name LIKE ?')
      params.push(`%${search.trim()}%`)
      if (code) params.push(code)
    }
    const whereSql = where.join(' AND ')
    const [[counts]] = await pool.query(
      `SELECT COUNT(*) AS \`all\`,
         SUM(p.status = 'PENDING_APPROVAL') AS PENDING_APPROVAL, SUM(p.status = 'SIGNING') AS SIGNING,
         SUM(p.status = 'STALE') AS STALE, SUM(p.status = 'DONE') AS DONE, SUM(p.status = 'REJECTED') AS REJECTED
       FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id
       WHERE ${['p.deleted_at IS NULL', ...(seafarerId ? ['p.seafarer_id = ?'] : [])].join(' AND ')}`,
      seafarerId ? [seafarerId] : []
    )
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id WHERE ${whereSql}`, params)
    const offset = (page - 1) * limit
    const [rows] = await pool.query(
      `SELECT p.id, p.seafarer_id, s.full_name AS seafarer_name, p.title, p.status, p.created_at, u.email AS created_by_email, p.created_by,
         (SELECT GROUP_CONCAT(d.template_key ORDER BY d.sort_order) FROM export_pack_doc d WHERE d.pack_id = p.id) AS doc_keys,
         (SELECT COUNT(*) FROM export_signature es WHERE es.pack_id = p.id) AS signed_count
       FROM export_pack p JOIN seafarer s ON s.id = p.seafarer_id JOIN user u ON u.id = p.created_by
       WHERE ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    return {
      data: rows.map((r) => {
        const docs = r.doc_keys ? r.doc_keys.split(',') : []
        return {
          id: r.id, code: packCode(r.id), seafarer_id: r.seafarer_id, seafarer_name: r.seafarer_name, title: r.title, status: r.status,
          docs, created_at: r.created_at, created_by: r.created_by, created_by_email: r.created_by_email,
          signed: Number(r.signed_count) || 0, signatures_needed: requiredSignatures(docs).length,
        }
      }),
      total,
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v) || 0])),
    }
  },

  async get(pool, id, user) {
    const pack = await loadPack(pool, id)
    return shape(pack, { includeToken: user && ['admin', 'operator', 'reviewer'].includes(user.role) })
  },

  async create(pool, { seafarer_id: seafarerId, docs, inputs }, user) {
    const keys = normalizeDocs(docs)
    const [[seafarer]] = await pool.query(
      `SELECT s.id, s.full_name, s.date_of_birth, r.name_vi AS rank_name FROM seafarer s LEFT JOIN rank r ON r.id = s.current_rank_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [seafarerId]
    )
    if (!seafarer) throw { statusCode: 404, message: 'Không tìm thấy thuyền viên' }
    const snapshot = { full_name: seafarer.full_name, date_of_birth: seafarer.date_of_birth, rank_name: seafarer.rank_name }
    const id = await withTransaction(pool, async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO export_pack (seafarer_id, title, inputs, snapshot, created_by) VALUES (?, ?, ?, ?, ?)',
        [seafarerId, packTitle(keys), JSON.stringify(cleanInputs(inputs)), JSON.stringify(snapshot), user.id]
      )
      await conn.query('INSERT INTO export_pack_doc (pack_id, template_key, sort_order) VALUES ?', [keys.map((key, i) => [result.insertId, key, i])])
      return result.insertId
    })
    return this.get(pool, id, user)
  },

  // Người tạo không tự duyệt bộ của mình.
  async approve(pool, id, user) {
    await withTransaction(pool, async (conn) => {
      const { row } = await loadPack(conn, id, { forUpdate: true })
      if (row.status !== 'PENDING_APPROVAL') throw { statusCode: 409, message: 'Bộ giấy không còn ở bước chờ duyệt' }
      if (row.created_by === user.id) throw { statusCode: 403, message: 'Bạn tạo bộ này nên không tự duyệt được' }
      const token = crypto.randomBytes(32).toString('hex')
      await conn.query(
        `UPDATE export_pack SET status = 'SIGNING', approved_by = ?, approved_at = NOW(),
           sign_token = ?, sign_token_expires_at = DATE_ADD(NOW(), INTERVAL ${SIGN_LINK_HOURS} HOUR) WHERE id = ?`,
        [user.id, token, id]
      )
    })
    return this.get(pool, id, user)
  },

  async reject(pool, id, reason, user) {
    const text = String(reason || '').trim()
    if (!text) throw { statusCode: 400, message: 'Ghi lý do trả lại' }
    await withTransaction(pool, async (conn) => {
      const { row } = await loadPack(conn, id, { forUpdate: true })
      if (row.status !== 'PENDING_APPROVAL') throw { statusCode: 409, message: 'Bộ giấy không còn ở bước chờ duyệt' }
      if (row.created_by === user.id) throw { statusCode: 403, message: 'Bạn tạo bộ này nên không tự trả lại được' }
      await conn.query('UPDATE export_pack SET status = \'REJECTED\', reject_reason = ? WHERE id = ?', [text.slice(0, 500), id])
    })
    return this.get(pool, id, user)
  },

  // Ký trong app mọi giấy mà vai `signer` cần ký (không phải thuyền viên).
  async signInApp(pool, id, signer, user) {
    if (signer === SELF_SIGNER) throw { statusCode: 400, message: 'Thuyền viên ký qua link SMS, không ký trong app' }
    await withTransaction(pool, async (conn) => {
      const { row, docs } = await loadPack(conn, id, { forUpdate: true })
      if (row.status !== 'SIGNING') throw { statusCode: 409, message: 'Bộ giấy chưa ở bước ký' }
      const mine = requiredSignatures(docs).filter((s) => s.signer === signer)
      if (!mine.length) throw { statusCode: 400, message: `Bộ này không có giấy nào cần ${signer} ký` }
      await conn.query(
        'INSERT IGNORE INTO export_signature (pack_id, template_key, signer, signed_by_user_id) VALUES ?',
        [mine.map((s) => [id, s.templateKey, s.signer, user.id])]
      )
      await finishIfComplete(conn, id)
    })
    return this.get(pool, id, user)
  },

  // ---------- Link ký của thuyền viên (không đăng nhập) ----------
  async getByToken(pool, token) {
    const pack = await packByToken(pool, token)
    const crewDocs = pack.docs.filter((key) => templateOf(key).signers.includes(SELF_SIGNER))
    const signed = new Set(pack.signatures.filter((s) => s.signer === SELF_SIGNER).map((s) => s.template_key))
    return {
      code: packCode(pack.row.id),
      seafarer_name: pack.row.seafarer_name,
      snapshot: parseJson(pack.row.snapshot),
      inputs: parseJson(pack.row.inputs),
      docs: crewDocs.map((key) => ({ key, name: templateOf(key).name, signers: templateOf(key).signers, signed: signed.has(key) })),
      other_signatures: pack.signatures.filter((s) => s.signer !== SELF_SIGNER).map((s) => ({ template_key: s.template_key, signer: s.signer })),
      done: crewDocs.length > 0 && crewDocs.every((key) => signed.has(key)),
    }
  },

  async signByToken(pool, token, { image, agreed }, ip) {
    if (agreed !== true) throw { statusCode: 400, message: 'Cần đồng ý nội dung giấy trước khi ký' }
    checkSignatureImage(image)
    const pack = await packByToken(pool, token)
    const crewDocs = pack.docs.filter((key) => templateOf(key).signers.includes(SELF_SIGNER))
    if (!crewDocs.length) throw { statusCode: 400, message: 'Bộ này không có giấy nào thuyền viên cần ký' }
    await withTransaction(pool, async (conn) => {
      await conn.query(
        'INSERT IGNORE INTO export_signature (pack_id, template_key, signer, signature_image, signed_ip) VALUES ?',
        [crewDocs.map((key) => [pack.row.id, key, SELF_SIGNER, image, ip || null])]
      )
      await finishIfComplete(conn, pack.row.id)
    })
    return this.getByToken(pool, token)
  },

  // Hồ sơ đổi thì bộ chưa xong phải làm lại.
  async markStaleForSeafarer(pool, seafarerId, reason = 'Hồ sơ đã sửa sau khi tạo bộ') {
    await pool.query(
      'UPDATE export_pack SET status = \'STALE\', stale_reason = ?, sign_token = NULL WHERE seafarer_id = ? AND status IN (\'PENDING_APPROVAL\', \'SIGNING\') AND deleted_at IS NULL',
      [reason, seafarerId]
    )
  },

  // File .zip: mỗi giấy có mẫu Excel thì điền từ hồ sơ; giấy chưa có mẫu ghi vào danh sách thiếu.
  async buildZip(pool, id) {
    const { row, docs } = await loadPack(pool, id)
    if (row.status !== 'DONE') throw { statusCode: 409, message: 'Chỉ tải được bộ đã ký xong' }
    const zip = new PizZip()
    const missing = []
    for (const key of docs) {
      const tpl = templateOf(key)
      if (!tpl.formKey) { missing.push(`${tpl.name}: chưa có file mẫu`); continue }
      try {
        const { buffer } = await formExportService.exportForm(row.seafarer_id, tpl.formKey)
        zip.file(`${String(docs.indexOf(key) + 1).padStart(2, '0')} ${tpl.name}.xlsx`, Buffer.from(buffer))
      } catch (error) {
        missing.push(`${tpl.name}: ${/not found/i.test(error.message || '') ? 'chưa có file mẫu trên máy chủ' : 'không điền được từ hồ sơ'}`)
      }
    }
    if (missing.length) zip.file('CHUA-CO.txt', `Các giấy chưa xuất được:\n${missing.join('\n')}\n`)
    return { buffer: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), filename: `${packCode(row.id)} ${row.seafarer_name}.zip` }
  },
}

async function packByToken(pool, token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw { statusCode: 404, message: 'Link ký không còn dùng được' }
  const [[found]] = await pool.query(
    'SELECT id FROM export_pack WHERE sign_token = ? AND status IN (\'SIGNING\', \'DONE\') AND sign_token_expires_at > NOW() AND deleted_at IS NULL',
    [token]
  )
  if (!found) throw { statusCode: 404, message: 'Link ký không còn dùng được' }
  return loadPack(pool, found.id)
}

async function finishIfComplete(conn, id) {
  const { docs, signatures } = await loadPack(conn, id)
  if (isComplete(docs, signatures)) await conn.query('UPDATE export_pack SET status = \'DONE\' WHERE id = ? AND status = \'SIGNING\'', [id])
}

module.exports = {
  exportPackService,
  normalizeDocs, packTitle, cleanInputs, requiredSignatures, isComplete, packCode, packIdFromCode, checkSignatureImage,
  SIGN_LINK_HOURS,
}
