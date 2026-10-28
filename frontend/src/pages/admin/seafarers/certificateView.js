// Chứng chỉ cho tab Chứng chỉ (T5): đổi dòng API sang props của components/ds/CertificateTable.
// Trạng thái hạn (expiry_status) và tên hiện ra (display_name) do backend tính.

const toDisplayDate = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')

export const CATEGORY = { DOCUMENT: 'Tuỳ thân', STCW: 'STCW', MEDICAL: 'Y tế', VN: 'Việt Nam', PANAMA: 'Panama', OTHER: 'Khác' }

// Chứng chỉ đã có bản mới thay (cùng loại, bản kia không thời hạn hoặc hết hạn muộn hơn): không còn cảnh báo, không cần cập nhật.
export function supersededIds(rows) {
  const out = new Set()
  rows.forEach((row) => {
    if (row.no_expiry || !row.expiry_date || !row.certificate_type_id) return
    const newer = rows.some((other) => other.id !== row.id && other.certificate_type_id === row.certificate_type_id
      && (other.no_expiry || !other.expiry_date || String(other.expiry_date).slice(0, 10) > String(row.expiry_date).slice(0, 10)))
    if (newer) out.add(row.id)
  })
  return out
}

// Cảnh báo đã tắt: { [id chứng chỉ]: hạn lúc tắt }. Đổi hạn (gia hạn) thì cảnh báo hiện lại.
export const isDismissed = (dismissed, row) => dismissed?.[row.id] === String(row.expiry_date || '').slice(0, 10)

// Cảnh báo hạn của một dòng: 'expired' | 'expiring' | null (đã có bản mới thay hoặc đã tắt).
export function alertOf(row, { superseded, dismissed } = {}) {
  if (!['EXPIRED', 'EXPIRING'].includes(row.expiry_status) || superseded?.has(row.id) || isDismissed(dismissed, row)) return null
  return row.expiry_status === 'EXPIRED' ? 'expired' : 'expiring'
}

export function toTableCerts(rows, { today = new Date(), dismissed } = {}) {
  const superseded = supersededIds(rows)
  // Chứng chỉ đã có bản mới thay xuống cuối bảng, giữ nguyên thứ tự ở mỗi nhóm.
  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    number: row.certificate_number || '—',
    issuedOn: toDisplayDate(row.issued_date) || '—',
    expiresOn: row.no_expiry ? '' : toDisplayDate(row.expiry_date),
    status: row.expiry_status,
    category: CATEGORY[row.certificate_category] || row.certificate_category || '',
    categoryKey: row.certificate_category || 'OTHER',
    noExpiry: Boolean(row.no_expiry || !row.expiry_date),
    daysLeft: daysLeft(row, today),
    alert: alertOf(row, { superseded, dismissed }),
    muted: ['EXPIRED', 'EXPIRING'].includes(row.expiry_status) && !superseded.has(row.id) && isDismissed(dismissed, row),
    canRenew: !(row.no_expiry || !row.expiry_date) && !superseded.has(row.id),
    manual: row.source === 'manual',
    fileName: row.source_file_name || null,
    uploadId: row.source_upload_id || null,
    hasFile: Boolean(row.source_upload_id || row.document_url),
    replaced: superseded.has(row.id),
    raw: row,
  }))
  return [...mapped.filter((cert) => !cert.replaced), ...mapped.filter((cert) => cert.replaced)]
}

// Số ngày còn lại tới hạn (âm là đã quá hạn); null nếu không thời hạn.
export function daysLeft(row, today = new Date()) {
  if (row.no_expiry || !row.expiry_date) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((new Date(`${String(row.expiry_date).slice(0, 10)}T00:00:00`) - start) / 86400000)
}

// Chứng chỉ cần cảnh báo ở đầu tab: đã quá hạn (đỏ) và còn hạn nhưng trong 60 ngày tới (vàng), gần hạn nhất lên trước.
export function expiryAlerts(rows, { today = new Date(), dismissed } = {}) {
  const superseded = supersededIds(rows)
  const items = rows
    .filter((row) => alertOf(row, { superseded, dismissed }))
    .map((row) => ({ id: row.id, name: row.display_name, expiresOn: toDisplayDate(row.expiry_date), expiry: String(row.expiry_date).slice(0, 10), days: daysLeft(row, today), expired: row.expiry_status === 'EXPIRED' }))
    .sort((a, b) => a.days - b.days)
  return { expired: items.filter((i) => i.expired), expiring: items.filter((i) => !i.expired) }
}

// Số chứng chỉ cần chú ý trên nhãn tab: đã hết hạn hoặc sắp hết hạn.
export const attentionCount = (rows) => rows.filter((row) => ['EXPIRED', 'EXPIRING'].includes(row.expiry_status)).length

// Chuyển ô nhập tay (form Thêm chứng chỉ) sang thân gửi backend. Ngày nhập dd/mm/yyyy → yyyy-mm-dd.
export function toPayload(form) {
  const iso = (text) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim())
    if (!m) return null
    const [, d, mo, y] = m
    const date = new Date(Date.UTC(+y, +mo - 1, +d))
    const out = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return date.toISOString().slice(0, 10) === out ? out : null
  }
  const issued = iso(form.issuedOn)
  const expiry = form.noExpiry ? null : iso(form.expiresOn)
  const errors = {}
  if (!form.certificateTypeId) errors.certificateTypeId = 'Chọn loại chứng chỉ'
  if (!issued) errors.issuedOn = 'Nhập ngày cấp dạng dd/mm/yyyy'
  if (form.expiresOn && !form.noExpiry && !expiry) errors.expiresOn = 'Nhập hạn dạng dd/mm/yyyy'
  if (!form.noExpiry && !form.expiresOn) errors.expiresOn = 'Nhập hạn hoặc đánh dấu không thời hạn'
  if (Object.keys(errors).length) return { errors }
  return {
    payload: {
      certificate_type_id: form.certificateTypeId,
      certificate_number: form.number?.trim() || undefined,
      issued_date: issued,
      ...(expiry ? { expiry_date: expiry } : {}),
      no_expiry: Boolean(form.noExpiry),
      issued_by: form.issuer?.trim() || undefined,
    },
  }
}
