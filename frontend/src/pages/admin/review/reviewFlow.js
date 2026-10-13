// Màn "Duyệt từng giấy" (T2): logic thuần, không gọi API. Mỗi lần một giấy; bỏ qua ô là chấp nhận,
// gõ khác giá trị AI đọc là "Đã sửa"; chỉ ngày chưa chắc và số GCNKNCM cần chạm một lần.

const BOOK_TYPES = ['seaman_book_info', 'seaman_book_duty']

// Loại giấy theo cách người dùng nói: book (sổ), certificate (chứng chỉ), other (khác).
export function docKind(doc) {
  if (BOOK_TYPES.includes(doc.doc_type)) return 'book'
  if (doc.doc_type === 'certificate') return 'certificate'
  return 'other'
}

// Giấy không có ô để duyệt: loại "Khác" (lưu kèm hồ sơ), hoặc chưa đọc xong, hoặc đọc lỗi.
export const hasFields = (doc) => doc.status !== 'SKIPPED' && doc.fields.length > 0

// Ô cần người duyệt chạm một lần trước khi qua giấy kế: ngày AI chưa chắc, hoặc ô `confirm` (số GCNKNCM)
// còn ở trạng thái AI đề xuất. Các ô còn lại bỏ qua là chấp nhận.
export function needsTouch(field) {
  if (field.state === 'DATE_AMBIGUOUS') return true
  return Boolean(field.confirm) && field.state === 'PROPOSED'
}

export const touchCount = (doc) => doc.fields.filter(needsTouch).length

// Ô trống vẫn là ô chưa quyết (UNKNOWN): người duyệt nhập tay hoặc giữ trống; không chặn việc qua giấy kế.
const MONO_KEYS = ['no', 'coc', 'gt', 'kw', 'id']

// Ô vào hồ sơ hay chỉ để so với hồ sơ. Trang bố trí chức danh: mọi ô vào chuyến đi tàu (một dòng ghi chú ở đầu khung, không chip từng ô).
function destinationOf(field, doc) {
  const kind = docKind(doc)
  if (kind === 'other' || doc.doc_type === 'seaman_book_duty') return undefined
  if (kind === 'certificate') return ['holder', 'nameRaw', 'noExpiry'].includes(field.key) ? 'compare' : 'profile'
  return field.to_profile ? 'profile' : 'compare'
}

// Props cho ô nhập (components/ds/FieldInput) từ một ô của API.
export function fieldView(field, doc) {
  const unsure = field.state === 'DATE_AMBIGUOUS'
  let hint = field.note || ''
  if (unsure) hint = 'Chữ viết tay, kiểm lại với bản gốc'
  else if (field.confirm) hint = 'Số dài, so từng ký tự với bản gốc'
  else if (field.normalized) hint = `→ ${field.normalized.name_vi} (${field.normalized.code})`
  return {
    fieldKey: field.key,
    label: field.label,
    value: field.state === 'UNKNOWN' ? '' : field.value,
    state: field.state,
    destination: destinationOf(field, doc),
    half: field.half,
    mono: MONO_KEYS.includes(field.key),
    needsConfirm: needsTouch(field) || (Boolean(field.confirm) && field.state === 'ACCEPTED'),
    aiRead: field.ai_value || field.raw,
    hint: hint || undefined,
  }
}

// Gõ vào một ô → hành động gửi backend. Trống: giữ trống; trở về đúng giá trị AI: hoàn tác; khác: sửa.
export function decisionFor(field, text) {
  const value = String(text ?? '').trim()
  if (!value) return { action: 'keepUnknown' }
  if (value === field.value) return null
  if (value === (field.ai_value || '') && field.state === 'EDITED') return { action: 'undo' }
  return { action: 'edit', value }
}

// Thứ tự giấy trong lần duyệt là thứ tự API trả (tệp, rồi trang). Bộ chuyển "Giấy 3/9".
export function pager(docs, currentId) {
  const index = Math.max(0, docs.findIndex((doc) => doc.id === currentId))
  return {
    index: index + 1,
    total: docs.length,
    prevId: index > 0 ? docs[index - 1].id : null,
    nextId: index < docs.length - 1 ? docs[index + 1].id : null,
  }
}

// Giấy đầu tiên còn việc: đọc lỗi hay chờ duyệt; không còn thì giấy đầu tiên.
export function firstToReview(docs) {
  const todo = docs.find((doc) => ['REVIEW_REQUIRED', 'FAILED'].includes(doc.status))
  return (todo || docs[0] || {}).id ?? null
}

// Giấy kế tiếp còn việc sau giấy đang xem (vòng lại từ đầu); null nếu không còn.
export function nextToReview(docs, currentId) {
  const start = Math.max(0, docs.findIndex((doc) => doc.id === currentId))
  for (let step = 1; step <= docs.length; step += 1) {
    const doc = docs[(start + step) % docs.length]
    if (doc.id !== currentId && doc.status === 'REVIEW_REQUIRED') return doc.id
  }
  return null
}

// Có thể bấm "Xong, giấy tiếp": không còn ô cần chạm, giấy không đang đọc hay đã vào hồ sơ.
export function canContinue(doc) {
  if (!hasFields(doc)) return true
  if (['READING', 'PUBLISHED'].includes(doc.status)) return false
  return touchCount(doc) === 0
}

// Chứng chỉ có nút riêng "Đã so số, xác nhận" (backend chặn kèm lý do nếu thiếu loại hay hạn).
export const certificateNeedsConfirm = (doc) => docKind(doc) === 'certificate' && doc.status === 'REVIEW_REQUIRED'

// Tình trạng cả lần duyệt, cho nút "Đưa vào hồ sơ" và dòng "Còn N giấy chưa duyệt".
// Cùng luật với backend publish(): không còn giấy đang đọc hay chờ duyệt, không còn giấy khác người chưa xác nhận,
// và có ít nhất một giấy đã duyệt xong.
export function publishState(docs) {
  const active = docs.filter((doc) => doc.status !== 'PUBLISHED')
  const reading = active.filter((doc) => doc.status === 'READING').length
  const pending = active.filter((doc) => doc.status === 'REVIEW_REQUIRED').length
  const failed = active.filter((doc) => doc.status === 'FAILED').length
  const ownerMismatch = active.filter((doc) => doc.owner_mismatch && !doc.owner_mismatch_confirmed && doc.status !== 'SKIPPED').length
  const ready = active.filter((doc) => doc.status === 'COMPLETED').length
  const reasons = []
  if (reading) reasons.push(`Còn ${reading} giấy đang đọc`)
  if (pending) reasons.push(`Còn ${pending} giấy chưa duyệt`)
  if (ownerMismatch) reasons.push(`${ownerMismatch} giấy mang tên khác hồ sơ chưa xác nhận`)
  if (!reasons.length && ready === 0) reasons.push('Chưa có giấy nào duyệt xong để đưa vào hồ sơ')
  return { canPublish: reasons.length === 0, reasons, pending, reading, failed, ready, ownerMismatch }
}
