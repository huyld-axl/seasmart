import { InputNumber } from 'antd'
import { formatNumericInput, parseNumericInput } from '../../utils/numericInput'

export default function NumberInput(props) {
  return (
    <InputNumber
      decimalSeparator=","
      formatter={formatNumericInput}
      parser={parseNumericInput}
      inputMode="decimal"
      {...props}
    />
  )
}