import dayjs from 'dayjs'
import { template } from './packModel'

// Giá trị trên hồ sơ cho một trường mẫu cần; null nếu hồ sơ chưa có.
function profileValue(label, s, contacts) {
  const contact = (guarantor) => contacts.find((c) => !!c.is_guarantor === guarantor)
  const values = {
    'Cỡ giày': s?.shoe_size,
    'Nhóm máu': s?.blood_type,
    'Người thân liên hệ': contact(false) && `${contact(false).full_name}${contact(false).relationship ? ` (${contact(false).relationship})` : ''}`,
    'Người bảo lãnh': contact(true)?.full_name,
    'Số tài khoản': s?.bank_account_number,
  }
  return values[label] || null
}
import './exports.css'

// Xem trước một giấy A4 điền sẵn từ hồ sơ. Trường hồ sơ chưa có hiện "thiếu trong hồ sơ",
// ô điền lúc xuất để trống thì in ra điền tay.
export default function A4Preview({ docKey, seafarer, contacts = [], inputs = {}, signs = {}, agency = 'AGENCY DEMO · Hải Phòng' }) {
  const t = template(docKey)
  const fmt = (date) => (date ? dayjs(date).format('DD/MM/YYYY') : null)
  const lines = [
    ['Họ và tên', seafarer?.full_name?.toUpperCase()],
    ['Ngày sinh', fmt(seafarer?.date_of_birth)],
    ['Chức danh', seafarer?.rank_name],
    ...t.inputs.map((label) => [label, inputs[label] || '']),
    ...t.needs.map((label) => [label, profileValue(label, seafarer, contacts)]),
  ]
  const signers = t.signers.length ? t.signers : [null]
  return (
    <div className="a4" role="img" aria-label={`Xem trước ${t.name}`}>
      <p className="a4__org">{agency}</p>
      <p className="a4__title">{t.name.toUpperCase()}</p>
      <div className="a4__lines">
        {lines.map(([label, value]) => (
          <p key={label} className="a4__line">
            <span>{label}:</span>
            {value === null || value === undefined ? (
              <b className="a4__miss">thiếu trong hồ sơ</b>
            ) : value ? (
              <b>{value}</b>
            ) : (
              <i className="a4__blank">…………………… (điền tay)</i>
            )}
          </p>
        ))}
      </div>
      <p className="a4__date">Hải Phòng, ngày … tháng … năm {new Date().getFullYear()}</p>
      <div className="a4__signs">
        {signers.map((who) => {
          const st = who ? signs[who] || 'wait' : 'none'
          return (
            <div key={who || 'none'} className="a4__sign" data-st={st}>
              <span className="a4__who">{who || 'Không cần ký'}</span>
              {who && (st === 'done' ? <span className="a4__ink">Đã ký</span> : <span className="a4__pending">chờ ký</span>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
