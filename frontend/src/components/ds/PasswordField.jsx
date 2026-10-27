import { CheckCircleFilled, MinusCircleOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import { passwordRules } from './passwordRules'
import './ds.css'

// Ô mật khẩu có hiện / ẩn, thanh độ mạnh và luật hiện sẵn. Dùng được trong Form.Item (value, onChange).
export default function PasswordField({ value = '', onChange, email = '', ...rest }) {
  const rules = passwordRules(value, email)
  const level = value ? rules.filter((r) => r.ok).length : 0
  return (
    <div className="ds-pw">
      <Input.Password value={value} onChange={onChange} autoComplete="new-password" {...rest} />
      <div className="ds-pw__bar" data-level={level} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <ul className="ds-pw__rules">
        {rules.map((rule) => (
          <li key={rule.key} data-ok={rule.ok}>
            {rule.ok ? <CheckCircleFilled aria-hidden /> : <MinusCircleOutlined aria-hidden />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
