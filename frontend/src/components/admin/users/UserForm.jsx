import { useEffect, useMemo } from 'react'
import { Button, Form, Input, Select, Switch } from 'antd'
import SlidePanel from '../../ds/SlidePanel'
import { useRoleOptions } from '../../../hooks/useRoles'
import useAuthStore from '../../../stores/authStore'

// Tạo và sửa tài khoản chung một form trong panel trượt (khuôn D3).
// Vai trò lấy từ danh sách vai trò. Người không phải Quản trị viên không thấy lựa chọn Quản trị viên;
// sửa tài khoản của chính mình thì khoá ô vai trò.
export default function UserForm({ open, onClose, onSubmit, initialValues, loading }) {
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
          email: initialValues.email,
          role_id: initialValues.role?.id,
          is_active: !!initialValues.is_active,
        })
      }
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
      description={
        isEdit ? initialValues.email : 'Người dùng đăng nhập bằng email và mật khẩu này.'
      }
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

        <Form.Item
          name="role_id"
          label="Vai trò"
          rules={[{ required: true, message: 'Chọn vai trò' }]}
          extra={isSelf ? 'Không tự đổi vai trò của mình.' : undefined}
        >
          <Select
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
    </SlidePanel>
  )
}
