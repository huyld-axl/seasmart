import useFormShortcuts from '../../../hooks/useFormShortcuts'
import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Select, Switch } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import Banner from '../../ds/Banner'
import SlidePanel from '../../ds/SlidePanel'
import { useRoleOptions } from '../../../hooks/useRoles'
import useAuthStore from '../../../stores/authStore'
import { isDesktop } from '../../../lib/desktop'
import useEditConflict from '../../../hooks/useEditConflict'
import { usersApi } from '../../../api/usersApi'

const toValues = (u) => (u ? { full_name: u.full_name, email: u.email, role_id: u.role?.id, is_active: !!u.is_active } : {})
const LABELS = { full_name: 'Họ tên', email: 'Email', role_id: 'Vai trò', is_active: 'Đang hoạt động' }

// Tạo tài khoản: hộp thoại (họ tên, email, vai trò; mật khẩu do người dùng tự đặt qua thư mời).
// Sửa tài khoản: panel trượt (khuôn D3).
// Vai trò lấy từ danh sách vai trò. Người không phải Quản trị viên không thấy lựa chọn Quản trị viên;
// sửa tài khoản của chính mình thì khoá ô vai trò.
export default function UserForm({ open, onClose, onSubmit, initialValues, loading, resetKey }) {
  const [form] = Form.useForm()
  const me = useAuthStore((state) => state.user)
  const isEdit = !!initialValues?.id
  const shortcuts = useFormShortcuts({ enabled: open, autoFocus: !isEdit, focusKey: resetKey, onCancel: onClose })
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
      if (initialValues) form.setFieldsValue(toValues(initialValues))
    }
  }, [open, initialValues, form, resetKey])

  // Chống ghi đè (docs/mcah-ke-hoach-desktop-gd3.md 3.4): bản mới nạp khi bị 409 thay cho initialValues.
  const [latest, setLatest] = useState(null)
  const current = isEdit && latest?.id === initialValues.id && latest.version > (initialValues.version || 0) ? latest : initialValues
  const conflict = useEditConflict({
    form,
    initial: toValues(current),
    labels: LABELS,
    format: (key, value) => (key === 'role_id' ? roles.find((r) => r.id === value)?.name || '' : key === 'is_active' ? (value ? 'Có' : 'Không') : value),
    reload: async () => {
      const user = (await usersApi.getById(initialValues.id)).data.data
      setLatest(user)
      return toValues(user)
    },
  })

  // onSubmit(values, form, { addAnother, onConflict }): lỗi lưu chuyển cho onConflict trước; trả true là đã hiện hộp xung đột.
  const handleFinish = (values) => onSubmit(isEdit ? { ...values, version: current.version } : values, form, { onConflict: conflict.handleError })

  const fields = (
    <Form ref={shortcuts} form={form} layout="vertical" initialValues={toValues(current)} onFinish={handleFinish}>
      <Form.Item
        name="full_name"
        label="Họ tên"
        rules={[{ required: true, whitespace: true, message: 'Nhập họ tên' }]}
      >
        <Input />
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
      form.validateFields().then((values) => onSubmit(values, form, { addAnother }), () => {})
    }
    return (
      <Modal
        open={open}
        onCancel={onClose}
        title={isDesktop() ? 'Mời vào văn phòng' : 'Thêm tài khoản'}
        footer={
          <>
            <Button onClick={onClose}>Huỷ</Button>
            <Button onClick={() => submit(true)} loading={loading}>
              {isDesktop() ? 'Gửi & mời người khác' : 'Lưu & thêm tài khoản khác'}
            </Button>
            <Button data-form-submit type="primary" onClick={() => submit(false)} loading={loading}>
              {isDesktop() ? 'Gửi thư mời' : 'Thêm tài khoản'}
            </Button>
          </>
        }
      >
        <Banner tone="neutral" icon={MailOutlined} title="Hệ thống sẽ gửi email mời" description={isDesktop() ? 'Người được mời đăng ký trên trang MCAH rồi đăng nhập app. Cần kết nối internet.' : 'Người dùng bấm liên kết trong email để tự đặt mật khẩu.'} />
        <div style={{ marginTop: 16 }}>{fields}</div>
      </Modal>
    )
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Sửa tài khoản"
      hasForm={false}
      description={initialValues.email}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button data-form-submit type="primary" onClick={() => form.submit()} loading={loading}>
            Lưu
          </Button>
        </>
      }
    >
      {fields}
      {conflict.dialog}
    </SlidePanel>
  )
}
