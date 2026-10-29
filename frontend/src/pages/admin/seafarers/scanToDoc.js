import dayjs from 'dayjs'

// Nạp giấy ở tab Giấy tờ: kết quả AI đọc (POST /documents/scan, kind 'any') → ô của hộp thoại nạp,
// và với giấy tuỳ thân: các ô hồ sơ thuyền viên sẽ đổi (cũ → mới) để người dùng tích chọn trước khi lưu.

// Giấy tuỳ thân: loại giấy trong danh mục ↔ ô hồ sơ (số, ngày cấp, hạn).
export const IDENTITY = {
  national_id: { code: 'CITIZEN_ID', number: 'national_id', issued: 'national_id_issued_date' },
  passport: { code: 'PASSPORT', number: 'passport_number', issued: 'passport_issued_date', expiry: 'passport_expiry' },
  seaman_book_info: { code: 'SEAMAN_BOOK', number: 'seaman_book_number', expiry: 'seaman_book_expiry' },
}
export const identityOfCode = (code) => Object.values(IDENTITY).find((i) => i.code === code || (i.code === 'SEAMAN_BOOK' && code === 'SEAMAN-BOOK')) || null

export const PROFILE_LABELS = {
  full_name: 'Họ tên', date_of_birth: 'Ngày sinh', gender: 'Giới tính', place_of_origin: 'Nguyên quán', permanent_address: 'Địa chỉ thường trú',
  national_id: 'Số CCCD', national_id_issued_date: 'Ngày cấp CCCD', national_id_issued_place: 'Nơi cấp CCCD',
  passport_number: 'Số hộ chiếu', passport_issued_date: 'Ngày cấp hộ chiếu', passport_expiry: 'Hạn hộ chiếu', place_of_birth: 'Nơi sinh',
  seaman_book_number: 'Số sổ thuyền viên', seaman_book_expiry: 'Hạn sổ thuyền viên',
}
const DATE_FIELDS = new Set(['date_of_birth', 'national_id_issued_date', 'passport_issued_date', 'passport_expiry', 'seaman_book_expiry'])
const GENDER = { M: 'Nam', F: 'Nữ' }

const iso = (v) => (v ? String(v).slice(0, 10) : '')
export const showValue = (field, v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (DATE_FIELDS.has(field)) return dayjs(iso(v)).format('DD/MM/YYYY')
  if (field === 'gender') return GENDER[v] || v
  return String(v)
}

// result: { documents: [{ type }], fields: [{ field, value, source }] }; certTypes: [{ id, code }].
// Trả { docType, typeId, values (ô hộp thoại, ngày là chuỗi ISO), profile: { ô hồ sơ: giá trị } } hoặc null khi AI không nhận ra.
export function fromScan(result, certTypes = []) {
  const docType = result?.documents?.[0]?.type
  if (!docType) return null
  const got = Object.fromEntries((result.fields || []).filter((f) => !f.source || f.source === docType).map((f) => [f.field, f.value]))
  const identity = IDENTITY[docType]
  if (identity) {
    const type = certTypes.find((c) => c.code === identity.code || (identity.code === 'SEAMAN_BOOK' && c.code === 'SEAMAN-BOOK'))
    const profile = Object.fromEntries(Object.entries(got).filter(([field]) => PROFILE_LABELS[field]))
    return {
      docType,
      typeId: type?.id ?? null,
      values: {
        certificate_number: got[identity.number] || undefined,
        issued_date: identity.issued ? got[identity.issued] || undefined : undefined,
        expiry_date: identity.expiry ? got[identity.expiry] || undefined : undefined,
        no_expiry: docType === 'national_id' ? true : undefined,
      },
      profile,
    }
  }
  if (docType === 'certificate') {
    const type = certTypes.find((c) => c.code === got.certificate_type_code)
    return {
      docType,
      typeId: type?.id ?? null,
      values: { certificate_number: got.certificate_number, issued_date: got.issued_date, expiry_date: got.expiry_date, no_expiry: got.no_expiry === 'true' ? true : undefined },
      profile: {},
    }
  }
  return null
}

// Ô hồ sơ của giấy tuỳ thân theo giá trị trong hộp thoại (số, ngày cấp, hạn), để số và hạn ở hồ sơ luôn khớp giấy mới nhất.
export function profileFromForm(typeCode, { certificate_number: number, issued_date: issued, expiry_date: expiry, no_expiry: noExpiry } = {}) {
  const identity = identityOfCode(typeCode)
  if (!identity) return {}
  const out = {}
  if (number) out[identity.number] = String(number).trim()
  if (identity.issued && issued) out[identity.issued] = iso(issued)
  if (identity.expiry && expiry && !noExpiry) out[identity.expiry] = iso(expiry)
  return out
}

// Các ô hồ sơ sẽ đổi: [{ field, label, from, to }], bỏ ô trùng giá trị đang có.
export function profileDiff(next, seafarer = {}) {
  const same = (field, a, b) => (DATE_FIELDS.has(field) ? iso(a) === iso(b) : String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase())
  return Object.entries(next)
    .filter(([field, value]) => PROFILE_LABELS[field] && value !== undefined && value !== null && value !== '' && !same(field, value, seafarer[field]))
    .map(([field, value]) => ({ field, label: PROFILE_LABELS[field], from: seafarer[field] ?? null, to: value }))
}
