import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Input } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import useToast from '../../../components/ds/useToast'
import { vesselTypeApi } from '../../../api/fleetApi'
import { vesselTypeCode } from './smartFetch'

const errorText = (error) => error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.'

// Thêm nhanh loại tàu ngay tại ô Loại tàu khi nguồn ghi một loại MCAH chưa có (cần quyền catalog.update).
// Tên tiếng Anh điền sẵn từ nguồn, tên tiếng Việt bắt buộc, mã tự sinh. onCreated(row): loại mới đã được tạo.
export default function QuickAddVesselType({ nameEn, existingCodes, onCreated, onCancel }) {
  const toast = useToast()
  const [en, setEn] = useState(nameEn || '')
  const [vi, setVi] = useState('')
  const [tried, setTried] = useState(false)
  const create = useMutation({ mutationFn: (data) => vesselTypeApi.create(data) })
  const code = vesselTypeCode(en, existingCodes)
  const viError = tried && !vi.trim()
  const enError = tried && !en.trim()

  async function submit() {
    setTried(true)
    if (!vi.trim() || !en.trim()) return
    try {
      onCreated(await create.mutateAsync({ code, name_en: en.trim(), name_vi: vi.trim() }))
    } catch (error) {
      toast.error('Không thêm được loại tàu', { description: errorText(error) })
    }
  }

  return (
    <div className="fl-quick">
      <div className="fl-quick__head">
        <b>Thêm loại tàu mới</b>
        <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Đóng" onClick={onCancel} />
      </div>
      <div className="fl-quick__grid">
        <label className="fl-quick__field">
          <span>Tên tiếng Anh <i>*</i></span>
          <Input value={en} status={enError ? 'error' : undefined} maxLength={100} onChange={(event) => setEn(event.target.value)} />
          {enError ? <em>Nhập tên tiếng Anh.</em> : null}
        </label>
        <label className="fl-quick__field">
          <span>Tên tiếng Việt <i>*</i></span>
          <Input value={vi} status={viError ? 'error' : undefined} maxLength={100} placeholder="Ví dụ Tàu chở đá vôi" autoFocus onChange={(event) => setVi(event.target.value)} onPressEnter={submit} />
          {viError ? <em>Nhập tên tiếng Việt.</em> : null}
        </label>
      </div>
      <div className="fl-quick__foot">
        <span>Mã <b className="ds-mono">{code}</b> tự sinh. Dùng được ngay cho mọi tàu; sửa sau ở Danh mục › Loại tàu.</span>
        <span className="fl-quick__acts">
          <Button size="small" onClick={onCancel}>Huỷ</Button>
          <Button size="small" type="primary" loading={create.isPending} onClick={submit}>Thêm loại tàu</Button>
        </span>
      </div>
    </div>
  )
}
