// Màn A3 Duyệt giấy tờ: mỗi loại giấy một khuôn, ô xếp đúng thứ tự trên giấy để mắt dò ngang được.
// Khuôn và kết quả AI đọc đến từ /api/v1/documents; hành động trên ô cùng nghĩa với backend.

// Trạng thái một ô: còn phải xem (todo) hay đã quyết (done).
export const TODO_STATES = ['PROPOSED', 'UNKNOWN', 'DATE_AMBIGUOUS']
export const DONE_STATES = ['ACCEPTED', 'EDITED', 'UNKNOWN_KEPT', 'REJECTED']

// Hành động trên một ô: accept | edit (kèm giá trị) | reject | keepUnknown | undo.
export function applyAction(field, action, value) {
  switch (action) {
    case 'accept':
      return { ...field, state: field.value ? 'ACCEPTED' : 'UNKNOWN_KEPT', original: field.original ?? field }
    case 'edit': {
      const text = String(value ?? '').trim()
      if (!text) return field
      return { ...field, value: text, state: 'EDITED', original: field.original ?? field }
    }
    case 'reject':
      return { ...field, state: 'REJECTED', original: field.original ?? field }
    case 'keepUnknown':
      return { ...field, value: '', state: 'UNKNOWN_KEPT', original: field.original ?? field }
    case 'undo':
      return field.original ? { ...field.original } : field
    default:
      return field
  }
}

export function updateField(docs, docKey, fieldKey, action, value) {
  return docs.map((doc) => (doc.key !== docKey ? doc : {
    ...doc,
    fields: doc.fields.map((field) => (field.key === fieldKey ? applyAction(field, action, value) : field)),
  }))
}

export function progress(doc) {
  const done = doc.fields.filter((field) => DONE_STATES.includes(field.state)).length
  return { done, total: doc.fields.length, todo: doc.fields.length - done }
}

// Trạng thái giấy trong hàng chọn giấy: xong khi mọi ô đã quyết.
export function docStatus(doc) {
  return progress(doc).todo === 0 ? 'COMPLETED' : 'REVIEW_REQUIRED'
}

export function totalTodo(docs) {
  return docs.reduce((sum, doc) => sum + progress(doc).todo, 0)
}

// Ô kế tiếp cần xem sau ô đang chọn (để duyệt liền tay).
export function nextTodo(doc, fromKey) {
  const list = doc.fields
  const start = Math.max(0, list.findIndex((field) => field.key === fromKey))
  for (let step = 1; step <= list.length; step += 1) {
    const field = list[(start + step) % list.length]
    if (TODO_STATES.includes(field.state)) return field.key
  }
  return null
}

// Giấy từ API → dạng màn duyệt dùng. Giấy đã đưa vào hồ sơ không duyệt nữa.
export function fromApi(doc) {
  return {
    key: String(doc.id),
    id: doc.id,
    label: doc.label,
    file: doc.file_name,
    mime: doc.mime_type,
    page: doc.page || '',
    title: doc.title || [doc.label, ''],
    status: doc.status,
    error: doc.error,
    stamps: [],
    fields: doc.fields.map((field) => ({ ...field, note: field.note || null })),
  }
}

export function reviewable(docs) {
  return docs.filter((doc) => doc.status !== 'PUBLISHED')
}

// Giấy đọc được (có ô) mới tính vào tiến độ; giấy đang đọc hoặc lỗi thì chặn/không chặn riêng.
export function canPublish(docs) {
  const read = docs.filter((doc) => ['REVIEW_REQUIRED', 'COMPLETED'].includes(doc.status))
  return !docs.some((doc) => doc.status === 'READING') && read.length > 0 && totalTodo(read) === 0
}
