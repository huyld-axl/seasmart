import { useEffect } from 'react'
import { Drawer, Form, Input, Select, Button, Space, Switch } from 'antd'

const ROLES = ['admin', 'operator', 'training_center', 'manning_agent', 'seafarer']
const ROLE_LABELS = {
  admin: 'Admin',
  operator: 'Operator',
  training_center: 'Training Center',
  manning_agent: 'Manning Agent',
  seafarer: 'Seafarer',
}

export default function UserForm({ open, onClose, onSubmit, initialValues, loading }) {
  const [form] = Form.useForm()
  const isEdit = !!initialValues?.id
  const isMobile = window.innerWidth < 768

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) form.setFieldsValue(initialValues)
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
          <Input placeholder="user@example.com" />
        </Form.Item>

        {!isEdit && (
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
          <Select placeholder="Chọn role">
            {ROLES.map((r) => (
              <Select.Option key={r} value={r}>
                {ROLE_LABELS[r]}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {isEdit && (
          <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  )
}
