import { Input } from 'antd'
import { docFields } from './packModel'
import './exports.css'

// Thông tin điền thêm của riêng một giấy: những thứ hồ sơ không có (ngày, số tiền, người nhận...).
// Giấy không cần điền thêm gì thì không vẽ gì.
export default function DocFields({ docKey, inputs, onChange, onFocus }) {
  const fields = docFields(docKey)
  if (!fields.length) return null
  return (
    <div className="pk-fields">
      {fields.map(({ label, hint }) => (
        <label key={label} className="ds-field">
          <span className="ds-field__label">{label}</span>
          <Input placeholder={hint} value={inputs[label] || ''} onFocus={onFocus} onChange={(event) => onChange(label, event.target.value)} />
        </label>
      ))}
    </div>
  )
}
