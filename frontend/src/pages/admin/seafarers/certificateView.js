// Chứng chỉ cho tab Chứng chỉ (T5): đổi dòng API sang props của components/ds/CertificateTable.
// Trạng thái hạn (expiry_status) và tên hiện ra (display_name) do backend tính.

const toDisplayDate = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')

export function toTableCerts(rows) {
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    number: row.certificate_number || '—',
    issuedOn: toDisplayDate(row.issued_date) || '—',
    expiresOn: row.no_expiry ? '' : toDisplayDate(row.expiry_date),
    status: row.expiry_status,
    manual: row.source === 'manual',
    fileName: row.source_file_name || null,
    uploadId: row.source_upload_id || null,
    raw: row,
  }))
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
