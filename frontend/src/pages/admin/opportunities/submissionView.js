import { template, docFields } from '../exports/packModel'
import { formatDate } from '../../../utils/format'

// Hồ sơ nộp (bảng trượt ở trang cơ hội): chữ và tông cho từng giấy tờ, ô còn thiếu của từng biểu mẫu.

// d: một giấy theo yêu cầu từ API submission. tone: ok | warn | bad.
export function docState(d) {
  if (d.state === 'missing') return { tone: 'bad', text: d.certificate ? 'Chưa đủ thông tin trên hồ sơ' : 'Chưa có trên hồ sơ' }
  if (d.state === 'expires_early') return { tone: 'bad', text: `Hết hạn ${formatDate(d.expiry)}, trước mốc cần ${formatDate(d.needed_until)}` }
  if (d.state === 'no_file') return { tone: 'warn', text: 'Có trên hồ sơ nhưng chưa có ảnh' }
  return { tone: 'ok', text: d.certificate?.certificate_number ? `Số ${d.certificate.certificate_number}${d.expiry ? ` · hết hạn ${formatDate(d.expiry)}` : ''}` : '' }
}

// Ô điền thêm còn trống của một biểu mẫu trong bộ; null khi bộ chưa có biểu mẫu này (chưa điền lần nào).
export function formMissing(key, pack) {
  if (!pack?.docs?.includes(key)) return null
  return docFields(key).map((f) => f.label).filter((label) => !String(pack.inputs?.[label] || '').trim())
}

export const formName = (key) => template(key)?.name || key
