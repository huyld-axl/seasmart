import { useEffect } from 'react'
import { Button, Form, Input, Modal, Select } from 'antd'
import { useCreateRole, useUpdateRole } from '../../../hooks/useRoles'
import useToast from '../../../components/ds/useToast'
import apiErrorText from '../../../utils/apiError'

const NO_COPY = 'none'

// Thêm / sửa / nhân bản vai trò. `mode`: 'add' | 'edit'. Nhân bản = thêm với tên "Bản sao của X" và chép từ X (`initial`).
// Thêm: nút luôn bấm được, lỗi hiện dưới ô. Sửa: nút "Lưu thay đổi" tắt khi chưa đổi gì.
export default function RoleFormModal({ open, mode, role, initial, roles, onClose, onCreated }) {
  const [form] = Form.useForm()
  const toast = useToast()
  const create = useCreateRole()
  const update = useUpdateRole()
  const editing = mode === 'edit'
  const pending = create.isPending || update.isPending
  const watched = Form.useWatch([], form)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      name: editing ? role.name : initial?.name || '',
      description: editing ? role.description || '' : initial?.description || '',
      copy: initial?.copy ?? NO_COPY,
    })
  }, [open, editing, role, initial, form])

  const unchanged =
    editing &&
    role &&
    (watched?.name ?? role.name) === role.name &&
    (watched?.description ?? role.description ?? '') === (role.description || '')

  const duplicate = (_, value) => {
    const name = (value || '').trim().toLowerCase()
    const taken = roles.some((r) => r.id !== role?.id && r.name.trim().toLowerCase() === name)
    return taken ? Promise.reject(new Error('Đã có vai trò tên này.')) : Promise.resolve()
  }

  async function submit(values) {
    const name = values.name.trim()
    const description = (values.description || '').trim()
    try {
      if (editing) {
        await update.mutateAsync({ id: role.id, data: { name, description } })
        toast.success(`Đã lưu vai trò ${name}`)
        onClose()
        return
      }
      const copyId = values.copy && values.copy !== NO_COPY ? values.copy : null
      const created = await create.mutateAsync({ name, description, copy_from_role_id: copyId })
      const source = copyId ? roles.find((r) => r.id === copyId) : null
      toast.success(
        `Đã thêm vai trò ${name}${source ? `, chép ${source.is_system ? created.permissions.length : source.permissions.length} quyền từ ${source.name}` : ''}`
      )
      onClose()
      onCreated?.(created)
    } catch (error) {
      if (error?.response?.status === 409)
        form.setFields([{ name: 'name', errors: [apiErrorText(error, 'Đã có vai trò tên này.')] }])
      else
        toast.error(editing ? 'Không lưu được vai trò' : 'Không thêm được vai trò', {
          description: apiErrorText(error, "+D+"),
        })
    }
  }

  const copyOptions = [
    { value: NO_COPY, label: 'Không chép, bắt đầu trống' },
    ...roles.map((r) => ({
      value: r.id,
      label: `${r.name} (${r.is_system ? 'toàn quyền' : `${r.permissions.length} quyền`})`,
    })),
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={520}
      destroyOnHidden
      title={
        <div>
          <div className="rm-modal-title">{editing ? 'Sửa vai trò' : 'Thêm vai trò'}</div>
          <p className="rm-modal-desc">
            {editing
              ? 'Đổi tên không ảnh hưởng quyền và tài khoản đang dùng.'
              : 'Tạo xong là lưu ngay. Sau đó tích quyền ở cột mới.'}
          </p>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>
          Huỷ
        </Button>,
        <Button
          key="ok"
          type="primary"
          loading={pending}
          disabled={unchanged}
          onClick={() => form.submit()}
        >
          {editing ? 'Lưu thay đổi' : 'Thêm vai trò'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark onFinish={submit}>
        <Form.Item
          name="name"
          label="Tên vai trò"
          validateTrigger={['onSubmit', 'onBlur']}
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên vai trò.' },
            { max: 100, message: 'Tên tối đa 100 ký tự.' },
            { validator: duplicate },
          ]}
        >
          <Input placeholder="Ví dụ: Kế toán" autoFocus maxLength={100} />
        </Form.Item>
        <Form.Item
          name="description"
          label="Mô tả"
          rules={[{ max: 500, message: 'Mô tả tối đa 500 ký tự.' }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            placeholder="Vai trò này làm gì, hiện ở ô chọn vai trò khi tạo tài khoản"
          />
        </Form.Item>
        {editing ? null : (
          <Form.Item
            name="copy"
            label="Chép quyền từ"
            extra="Chép từ vai trò gần giống rồi sửa vài ô sẽ nhanh hơn tích từ đầu."
          >
            <Select allowClear options={copyOptions} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
