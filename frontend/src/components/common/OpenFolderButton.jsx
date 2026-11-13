import { useState } from 'react'
import { Button } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import useToast from '../ds/useToast'
import { bridgeError, desktop } from '../../lib/desktop'

// "Mở thư mục hồ sơ" (app máy tính, docs/design/wireframes/desktop-gd4.html màn 4): máy chính mở thư mục thật,
// máy nhân viên tải bản xem tạm chỉ đọc rồi mở.
export default function OpenFolderButton({ seafarerId }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      await desktop.openFolder(seafarerId)
    } catch (err) {
      toast.error('Không mở được thư mục hồ sơ', { description: bridgeError(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button icon={<FolderOpenOutlined />} loading={busy} onClick={open}>
      {busy ? 'Đang chuẩn bị…' : 'Mở thư mục hồ sơ'}
    </Button>
  )
}
