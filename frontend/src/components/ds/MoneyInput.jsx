import { InputNumber } from 'antd'
import './ds.css'

const shown = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

// "88.200" -> 88200, "1.234,5" -> 1234.5. Ô trống giữ null.
const parse = (text) => {
  const clean = String(text ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  return clean === '' ? null : Number(clean)
}
// Đang gõ thì giữ nguyên chữ người dùng; nhập xong mới thêm dấu chấm hàng nghìn.
const format = (value, info) => (info?.userTyping ? info.input : value === '' || value == null ? '' : shown.format(Number(value)))

// Ô nhập tiền USD dùng chung (màn chuyến tàu, hợp đồng). Giá trị là số hoặc null; luôn >= 0.
export default function MoneyInput({ suffix = 'USD', className, ...props }) {
  return (
    <InputNumber
      controls={false}
      min={0}
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
