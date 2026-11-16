import { InputNumber } from 'antd'
import { formatNumericInput, parseNumericInput } from '../../utils/numericInput'
import './ds.css'

const shown = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

const format = (value, info) => (info?.userTyping ? formatNumericInput(value, info) : value === '' || value == null ? '' : shown.format(Number(value)))

// Ô nhập tiền USD dùng chung (màn chuyến tàu, hợp đồng). Giá trị là số hoặc null; >= 0 trừ khi `allowNegative` (dòng điều chỉnh).
export default function MoneyInput({ suffix = 'USD', className, allowNegative = false, ...props }) {
  return (
    <InputNumber
      controls={false}
      min={allowNegative ? -9999999999 : 0}
      max={9999999999}
      decimalSeparator=","
      formatter={format}
      parser={parseNumericInput}
      suffix={suffix}
      placeholder="0,00"
      // Điện thoại mở bàn phím số; ô cho số âm giữ bàn phím thường vì bàn phím số của iOS không có dấu trừ.
      inputMode={allowNegative ? 'text' : 'decimal'}
      className={['ds-money', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
