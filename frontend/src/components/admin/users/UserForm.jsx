import { useEffect, useMemo } from 'react'
import { Button, Form, Input, Modal, Select, Switch } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import Banner from '../../ds/Banner'
import SlidePanel from '../../ds/SlidePanel'
import { useRoleOptions } from '../../../hooks/useRoles'
import useAuthStore from '../../../stores/authStore'

// Tạo tài khoản: hộp thoại (họ tên, email, vai trò; mật khẩu do người dùng tự đặt qua thư mời).
// Sửa tài khoản: panel trượt (khuôn D3).
// Vai trò lấy từ danh sách vai trò. Người không phải Quản trị viên không thấy lựa chọn Quản trị viên;
// sửa tài khoản của chính mình thì khoá ô vai trò.
export default function UserForm({ open, onClose, onSubmit, initialValues, loading, resetKey }) {
  const [form] = Form.useForm()
  const me = useAuthStore((state) => state.user)
  const isEdit = !!initialValues?.id
  const isSelf = isEdit && initialValues.id === me?.id
  const iAmAdmin = Boolean(me?.role?.is_system)
  const { data: roles = [] } = useRoleOptions({ enabled: open })

  const roleOptions = useMemo(
    () =>
      roles
        .filter((role) => iAmAdmin || !role.is_system)
        .map((role) => ({ value: role.id, label: role.name, description: role.description })),
    [roles, iAmAdmin]
  )

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) {
        form.setFieldsValue({
          full_name: initialValues.full_name,
          email: initialValues.email,
          role_id: initialValues.role?.id,
          is_active: !!initialValues.is_active,
        })
      }
    }
  }, [open, initialValues, form, resetKey])

  const handleFinish = (values) => onSubmit(values, form)

  const fields = (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <Form.Item
        name="full_name"
        label="Họ tên"
        rules={[{ required: true, whitespace: true, message: 'Nhập họ tên' }]}
      >
        <Input autoFocus={!isEdit} />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Nhập email đăng nhập' },
          { type: 'email', message: 'Email phải có dạng ten@congty.com' },
        ]}
      >
        <Input inputMode="email" />
      </Form.Item>

      <Form.Item
        name="role_id"
        label="Vai trò"
        rules={[{ required: true, message: 'Chọn vai trò' }]}
        extra={isSelf ? 'Không tự đổi vai trò của mình.' : undefined}
      >
        <Select
          allowClear
          placeholder="Chọn vai trò"
          options={
            isSelf && initialValues.role
              ? [{ value: initialValues.role.id, label: initialValues.role.name }]
              : roleOptions
          }
          disabled={isSelf}
          optionRender={(option) => (
            <span className="ds-cell2">
              <span className="ds-cell2__main" style={{ fontWeight: 400 }}>
                {option.data.label}
              </span>
              {option.data.description ? (
                <span className="ds-cell2__sub">{option.data.description}</span>
              ) : null}
            </span>
          )}
        />
      </Form.Item>

      {isEdit && (
        <Form.Item
          name="is_active"
          label="Cho phép đăng nhập"
          valuePropName="checked"
          extra={isSelf ? 'Không tự khoá tài khoản của mình.' : undefined}
        >
          <Switch disabled={isSelf} />
        </Form.Item>
      )}
    </Form>
  )

  if (!isEdit) {
    // Nút Lưu & thêm khác: lưu xong ở lại hộp thoại, form về trống.
    const submit = (addAnother) => {
      form.validateFields().then((values) => onSubmit(values, form, addAnother), () => {})
    }
    return (
      <Modal
        open={open}
        onCancel={onClose}
        title="Thêm tài khoản"
        footer={
          <>
            <Button onClick={onClose}>Huỷ</Button>
            <Button onClick={() => submit(true)} loading={loading}>
              Lưu &amp; thêm tài khoản khác
            </Button>
            <Button type="primary" onClick={() => submit(false)} loading={loading}>
              Thêm tài khoản
            </Button>
          </>
        }
      >
        <Banner tone="neutral" icon={MailOutlined} title="Hệ thống sẽ gửi email mời" description="Người dùng bấm liên kết trong email để tự đặt mật khẩu." />
        <div style={{ marginTop: 16 }}>{fields}</div>
      </Modal>
    )
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Sửa tài khoản"
      description={initialValues.email}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" onClick={() => form.submit()} loading={loading}>
            Lưu
          </Button>
        </>
      }
    >
      {fields}
    </SlidePanel>
  )
}
