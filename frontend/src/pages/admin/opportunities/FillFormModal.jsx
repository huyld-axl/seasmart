import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Input, Modal, Tooltip } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { exportApi } from '../../../api/exportApi'
import useToast from '../../../components/ds/useToast'
import DocFields from '../exports/DocFields'
import FormPreview from '../exports/FormPreview'
import { DocDownload } from '../exports/DownloadButtons'
import { VESSEL_FIELD, setEdit, template } from '../exports/packModel'
import '../exports/exports.css'

// Điền một biểu mẫu của hồ sơ nộp: xem trước bên trái (đúng như file xuất), ô điền thêm bên phải.
// Hệ thống điền sẵn từ hồ sơ thuyền viên, cơ hội và đối tác; ở đây chỉ điền phần hồ sơ không có, hoặc sửa thẳng trên giấy.
// Lưu thì ghi vào bộ giấy của ứng viên (dùng khi tải và gửi chủ tàu).
export default function FillFormModal({ pack, docKey, title, seafarerName, onClose, onSaved }) {
  const toast = useToast()
  const [inputs, setInputs] = useState(pack.inputs || {})
  const [edits, setEdits] = useState(pack.edits || {})
  const [onPaper, setOnPaper] = useState(false)
  const [dirty, setDirty] = useState(false)
  const doc = template(docKey)

  const save = useMutation({
    mutationFn: () => exportApi.update(pack.id, { inputs, edits }),
    onSuccess: (next) => {
      setDirty(false)
      onSaved(next)
      toast.success(`Đã lưu ${doc.name}`)
    },
    onError: (e) => toast.error('Không lưu được biểu mẫu', { description: e.response?.data?.error || 'Thử lại sau ít phút.' }),
  })
  const change = (label, value) => { setInputs((current) => ({ ...current, [label]: value })); setDirty(true) }

  return (
    <Modal
      open
      width={1120}
      zIndex={1100}
      onCancel={onClose}
      destroyOnHidden
      title={<span>{doc.name} · {seafarerName}<span className="fill-sub">{title}</span></span>}
      footer={[
        <Button key="close" onClick={onClose}>{dirty ? 'Huỷ' : 'Đóng'}</Button>,
        <Tooltip key="dl" title={dirty ? 'Lưu trước khi tải' : ''}><span><DocDownload pack={pack} docKey={docKey} docName={doc.name} disabled={dirty} /></span></Tooltip>,
        <Button key="save" type="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Lưu vào hồ sơ</Button>,
      ]}
    >
      <div className="fill-layout">
        <div className="fill-paper">
          <FormPreview
            docKey={docKey}
            seafarerId={pack.seafarer_id}
            shipOwnerId={pack.ship_owner_id}
            inputs={inputs}
            edits={edits[docKey]}
            editable={onPaper}
            highlightFields
            onEdit={(address, text) => { setEdits((current) => setEdit(current, docKey, address, text)); setDirty(true) }}
            label={`Xem trước ${doc.name}`}
          />
        </div>
        <aside className="fill-side">
          <p className="fill-note">Ô tô vàng trên giấy là chỗ còn trống; chữ đỏ là chỗ hệ thống đã điền từ hồ sơ, cơ hội, đối tác.</p>
          <label className="ds-field">
            <span className="ds-field__label">{VESSEL_FIELD} <span className="fill-src">Cơ hội</span></span>
            <Input value={inputs[VESSEL_FIELD] || ''} onChange={(e) => change(VESSEL_FIELD, e.target.value)} />
          </label>
          <DocFields docKey={docKey} inputs={inputs} onChange={change} />
          {doc.needs.length ? <p className="fill-note">Mẫu này lấy thêm từ hồ sơ: {doc.needs.join(', ')}. Thiếu thì bổ sung ở hồ sơ thuyền viên.</p> : null}
          <Button icon={<EditOutlined />} type={onPaper ? 'primary' : 'default'} onClick={() => setOnPaper((v) => !v)}>{onPaper ? 'Đang sửa trên giấy' : 'Sửa thẳng trên giấy'}</Button>
        </aside>
      </div>
    </Modal>
  )
}
