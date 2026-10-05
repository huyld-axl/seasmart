import { useEffect } from 'react'
import { Drawer, Form, Input, Select, Button, Space, Switch, Grid } from 'antd'

const { useBreakpoint } = Grid

const ROLES = ['admin', 'operator', 'accountant']
const ROLE_LABELS = {
  admin: 'Admin',
  operator: 'Chuyên viên',
  accountant: 'Kế toán',
}

export default function UserForm({ open, onClose, onSubmit, initialValues, loading }) {
  const [form] = Form.useForm()
  const isEdit = !!initialValues?.id
  const isProtectedUser = isEdit && String(initialValues?.id) === '1'
  const screens = useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) form.setFieldsValue(initialValues)
    }
  }, [open, initialValues, form])

  const handleFinish = (values) => {
    if (isEdit) {
      const { password, password_old, ...rest } = values
      const newPass = password && String(password).trim()
      if (newPass && newPass.length > 0) {
        const oldPass = password_old && String(password_old).trim()
        onSubmit({ ...rest, password: newPass, password_old: oldPass })
      } else {
        onSubmit(rest)
      }
    } else {
      onSubmit(values)
    }
  }

  return (
    <Drawer
      title={isEdit ? 'Sửa user' : 'Tạo user mới'}
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 480}
      footer={
        <Space>
          <Button type="primary" onClick={() => form.submit()} loading={loading}>
            {isEdit ? 'Lưu' : 'Tạo'}
          </Button>
          <Button onClick={onClose}>Hủy</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="user@example.com" disabled={isProtectedUser} />
        </Form.Item>

        {isEdit ? (
          <>
            <Form.Item
              name="password_old"
              label="Mật khẩu cũ"
              rules={[
                {
                  validator: (_, value) => {
                    const newPass = form.getFieldValue('password')
                    if (!newPass || String(newPass).trim().length === 0) return Promise.resolve()
                    if (!value || String(value).trim().length === 0) {
                      return Promise.reject(new Error('Vui lòng nhập mật khẩu cũ'))
                    }
                    if (String(value).trim().length < 6) {
                      return Promise.reject(new Error('Mật khẩu tối thiểu 6 ký tự'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <Input.Password placeholder="Nhập mật khẩu cũ" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu mới (tuỳ chọn)"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || String(value).trim().length === 0) return Promise.resolve()
                    if (String(value).trim().length < 6) {
                      return Promise.reject(new Error('Mật khẩu tối thiểu 6 ký tự'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <Input.Password placeholder="Nhập mật khẩu mới nếu muốn đổi" />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>
        )}

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: 'Vui lòng chọn role' }]}
        >
          <Select placeholder="Chọn role" disabled={isProtectedUser}>
            {ROLES.map((r) => (
              <Select.Option key={r} value={r}>
                {ROLE_LABELS[r]}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {isEdit && (
          <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
            <Switch disabled={isProtectedUser} />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  )
}
