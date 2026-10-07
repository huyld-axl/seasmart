import { useEffect } from 'react'
import { Button, Form, Input, Select, Switch } from 'antd'
import SlidePanel from '../../ds/SlidePanel'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../../constants/roles'

const ROLE_OPTIONS = ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_DESCRIPTIONS[role],
}))

// Tạo và sửa tài khoản chung một form trong panel trượt (khuôn D3).
export default function UserForm({ open, onClose, onSubmit, initialValues, loading }) {
  const [form] = Form.useForm()
  const isEdit = !!initialValues?.id

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) form.setFieldsValue({ ...initialValues, is_active: !!initialValues.is_active })
    }
  }, [open, initialValues, form])

  const handleFinish = (values) => {
    if (isEdit) {
      const { password: _password, ...rest } = values
      onSubmit(rest)
    } else {
      onSubmit(values)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? 'Sửa tài khoản' : 'Tạo tài khoản'}
      description={isEdit ? initialValues.email : 'Người dùng đăng nhập bằng email và mật khẩu này.'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" onClick={() => form.submit()} loading={loading}>
            {isEdit ? 'Lưu' : 'Tạo tài khoản'}
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Nhập email đăng nhập' },
            { type: 'email', message: 'Email phải có dạng ten@congty.com' },
          ]}
        >
          <Input inputMode="email" autoFocus={!isEdit} />
        </Form.Item>

        {!isEdit && (
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: 'Nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu cần ít nhất 6 ký tự' },
            ]}
          >
            <Input.Password />
          </Form.Item>
        )}

        <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
          <Select
            placeholder="Chọn vai trò"
            options={ROLE_OPTIONS}
            optionRender={(option) => (
              <span className="ds-cell2">
                <span className="ds-cell2__main" style={{ fontWeight: 400 }}>{option.data.label}</span>
                <span className="ds-cell2__sub">{option.data.description}</span>
              </span>
            )}
          />
        </Form.Item>

        {isEdit && (
          <Form.Item name="is_active" label="Cho phép đăng nhập" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </SlidePanel>
  )
}
