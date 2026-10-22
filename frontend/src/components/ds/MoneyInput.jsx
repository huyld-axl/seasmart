import { InputNumber } from 'antd'
import './ds.css'

const shown = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

// "88.200" -> 88200, "1.234,5" -> 1234.5. Ô trống giữ null.
const parse = (text) => {
  const raw = String(text ?? '')
  const clean = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  if (clean === '') return null
  return raw.trim().startsWith('-') ? -Number(clean) : Number(clean)
}
// Đang gõ thì giữ nguyên chữ người dùng; nhập xong mới thêm dấu chấm hàng nghìn.
const format = (value, info) => (info?.userTyping ? info.input : value === '' || value == null ? '' : shown.format(Number(value)))

// Ô nhập tiền USD dùng chung (màn chuyến tàu, hợp đồng). Giá trị là số hoặc null; >= 0 trừ khi `allowNegative` (dòng điều chỉnh).
export default function MoneyInput({ suffix = 'USD', className, allowNegative = false, ...props }) {
  return (
    <InputNumber
      controls={false}
      min={allowNegative ? -9999999999 : 0}
      max={9999999999}
      decimalSeparator=","
      formatter={format}
      parser={parse}
      suffix={suffix}
      placeholder="0,00"
      className={['ds-money', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
