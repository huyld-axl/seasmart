import { useState } from 'react'
import { Button, Form, Modal } from 'antd'
import SearchSelect from '../ds/SearchSelect'
import StatusBadge from '../ds/StatusBadge'
import useToast from '../ds/useToast'
import { usePicOptions } from '../../hooks/usePicOptions'
import apiErrorText from '../../utils/apiError'

// Người phụ trách (docs/mcah-ke-hoach-nguoi-phu-trach.md): thuyền viên → hợp đồng → bill, kế thừa lúc tạo, đổi không lan.

export function PicSelect({ current, ...props }) {
  const { options, loading } = usePicOptions(current)
  return (
    <SearchSelect
      showSearch
      placeholder="Chọn người phụ trách"
      loading={loading}
      options={options}
      optionRender={(option) => (
        <div>
          <div>{option.data.label}</div>
          {option.data.email && option.data.email !== option.data.label ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{option.data.email}</div> : null}
        </div>
      )}
      {...props}
    />
  )
}

// Tên người phụ trách; tài khoản đã khoá có nhãn Đã khoá; chưa có thì "Chưa giao".
export function PicName({ pic }) {
  if (!pic) return <span style={{ color: "var(--muted)" }}>Chưa giao</span>
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {pic.name}
      {pic.is_active === false ? <StatusBadge group="account" value="LOCKED" /> : null}
    </span>
  )
}

// Tên + chữ Đổi (khi có quyền) mở hộp đổi người phụ trách. `onSave(picUserId)` trả Promise.
// `note`: dòng nhắc rằng chỉ bản ghi này đổi. Danh sách người chỉ tải khi mở hộp.
export function PicChange({ pic, canEdit, note, onSave, saving }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <PicName pic={pic} />
      {canEdit ? <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setOpen(true)}>Đổi</Button> : null}
      {open ? <PicChangeDialog pic={pic} note={note} onSave={onSave} saving={saving} onClose={() => setOpen(false)} /> : null}
    </span>
  )
}

function PicChangeDialog({ pic, note, onSave, saving, onClose }) {
  const [form] = Form.useForm()
  const toast = useToast()
  const picked = Form.useWatch('pic_user_id', form)
  const { options } = usePicOptions(pic)

  async function submit({ pic_user_id }) {
    try {
      await onSave(pic_user_id)
      toast.success(`Đã giao cho ${options.find((o) => o.value === pic_user_id)?.label || 'người mới'}`)
      onClose()
    } catch (error) {
      toast.error('Không đổi được người phụ trách', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <Modal
      open
      onCancel={onClose}
      width={440}
      title="Đổi người phụ trách"
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={saving} disabled={!picked || picked === pic?.id} onClick={() => form.submit()}>Lưu</Button>,
      ]}
    >
      <Form form={form} layout="vertical" initialValues={{ pic_user_id: pic?.id }} onFinish={submit}>
        <Form.Item name="pic_user_id" label="Người phụ trách" rules={[{ required: true, message: 'Chọn người phụ trách' }]} extra={note}>
          <PicSelect current={pic} autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  )
}
