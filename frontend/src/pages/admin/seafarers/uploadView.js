// Màn "Tải giấy tờ lên" (T1): đổi tệp của máy chủ và tệp đang gửi ở máy sang dòng của components/ds/UploadPanel.
// Người dùng chỉ cần biết đang xử lý, xong, hoặc tệp nào cần làm gì.

export const MAX_MB = 25
export const ACCEPT_EXT = ['.pdf', '.jpg', '.jpeg', '.png']
const ATTENTION = ['error', 'stuck', 'unsupported', 'tooBig', 'duplicate', 'unsent']

const kindOf = (name, mime) => {
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  if (String(mime || '').startsWith('image/') || /\.(jpe?g|png)$/i.test(name)) return 'image'
  return 'other'
}

const displayDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// "1 sổ thuyền viên", "3 chứng chỉ, 1 giấy khác".
export function summaryText({ book = 0, certificate = 0, other = 0 }) {
  return [
    book ? `${book} sổ thuyền viên` : null,
    certificate ? `${certificate} chứng chỉ` : null,
    other ? `${other} giấy khác` : null,
  ].filter(Boolean).join(', ')
}

// Một tệp đã có ở máy chủ (uploads[] kèm summary).
export function serverFile(upload, { aiConfigured = true } = {}) {
  const s = upload.summary || { total: 0, book: 0, certificate: 0, other: 0, to_review: 0, published: 0, phase: 'done', stalled: false }
  const base = { id: `u${upload.id}`, uploadId: upload.id, name: upload.file_name, kind: kindOf(upload.file_name, upload.mime_type), summaryData: s }
  if (s.phase === 'failed') {
    if (!aiConfigured) return { ...base, state: 'saved' }
    return { ...base, state: 'error', error: upload.error || 'Không đọc được tệp này.' }
  }
  if (s.phase === 'running') return { ...base, state: s.stalled ? 'stuck' : 'running' }
  if (s.total === 0) return { ...base, state: 'error', error: 'Không nhận ra giấy nào trong tệp này.' }
  const text = summaryText(s)
  if (s.book + s.certificate === 0) return { ...base, state: 'other', summary: text || 'Giấy khác' }
  const published = s.published === s.total
  return { ...base, state: 'done', summary: published ? `${text} · đã vào hồ sơ` : text, canReview: !published }
}

// Tệp đang gửi hoặc bị từ chối ở máy (chưa có ở máy chủ).
export function localFile(item) {
  return {
    id: item.key,
    localKey: item.key,
    name: item.name,
    kind: kindOf(item.name, item.mime),
    state: item.state,
    size: item.size,
    duplicateOf: item.duplicateOf,
    error: item.error,
  }
}

// Kiểm tệp trước khi gửi. Trả null nếu hợp lệ, hoặc trạng thái từ chối.
export function rejectReason(file) {
  if (!ACCEPT_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))) return { state: 'unsupported' }
  if (file.size > MAX_MB * 1024 * 1024) return { state: 'tooBig', size: `${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB` }
  return null
}

export { displayDate }

// Dòng tóm tắt đầu khung và nút "Duyệt N giấy" (khi mọi tệp đã xong).
export function panelSummary(files, { aiConfigured = true } = {}) {
  const running = files.filter((f) => f.state === 'running').length
  const attention = files.filter((f) => ATTENTION.includes(f.state)).length
  const saved = files.filter((f) => f.state === 'saved').length
  const doneFiles = files.filter((f) => f.state === 'done')
  const toReview = files.reduce((sum, f) => sum + (f.summaryData?.to_review || 0), 0)

  if (running > 0) {
    return {
      title: `Đang xử lý ${running} tệp. Bạn có thể làm việc khác, trang tự cập nhật.`,
      note: doneFiles.length ? 'Xong đến đâu duyệt được đến đó.' : undefined,
    }
  }
  if (attention > 0) return { title: `${attention} tệp cần bạn xử lý` }
  if (saved > 0 && !aiConfigured) return { title: 'Tệp đã lưu. AI chưa đọc được vì chưa cấu hình.' }
  if (doneFiles.length === 0) return { title: 'Xong. Giấy "Khác" chỉ lưu kèm hồ sơ, không cần duyệt.' }
  const total = files.reduce((sum, f) => {
    const s = f.summaryData
    return s ? { book: sum.book + s.book, certificate: sum.certificate + s.certificate, other: sum.other + s.other } : sum
  }, { book: 0, certificate: 0, other: 0 })
  return {
    title: `Xong: ${summaryText(total)}`,
    action: toReview > 0 ? `Duyệt ${toReview} giấy` : undefined,
  }
}

// Có tệp nào còn đang chạy (máy chủ hay máy này) thì hỏi lại máy chủ mỗi 3 giây.
export const hasRunning = (files) => files.some((f) => f.state === 'running')
