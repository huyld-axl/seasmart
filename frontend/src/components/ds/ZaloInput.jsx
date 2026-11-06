import { Button, Form, Input } from 'antd'
import './ds.css'

export default function ZaloInput({ value, onChange, phoneName, ...props }) {
  const form = Form.useFormInstance()
  const phone = Form.useWatch(phoneName, form)
  return <div>
    <Input {...props} value={value} onChange={(event) => onChange?.(event.target.value)} maxLength={300} placeholder="Số đăng ký Zalo hoặc link kết bạn" />
    <Button className="ds-zalo-use" type="link" size="small" disabled={!phone} onClick={() => onChange?.(phone)}>Dùng số điện thoại này cho Zalo</Button>
  </div>
}
