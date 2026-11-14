import { useState } from 'react'
import { Button, Modal } from 'antd'
import api from '../../api/client'
import useAiConsentStore from '../../stores/aiConsentStore'
import useToast from '../ds/useToast'

// Lần đầu quét giấy tờ / danh thiếp bằng AI: hỏi đồng ý gửi ảnh lên máy chủ (docs/mcah-ke-hoach-desktop-gd4.md 3.8).
export default function AiConsentModal() {
  const { open, finish } = useAiConsentStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const agree = async () => {
    setBusy(true)
    try {
      await api.post('/auth/ai-consent')
      finish(true)
    } catch {
      toast.error('Chưa ghi được lựa chọn', { description: 'Thử lại sau ít phút.' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      title="Gửi ảnh cho AI đọc?"
      onCancel={() => finish(false)}
      footer={
        <div className="dsp-modal__footer">
          <Button color="default" variant="filled" onClick={() => finish(false)}>Không, tôi nhập tay</Button>
          <Button type="primary" loading={busy} onClick={agree}>Đồng ý và quét</Button>
        </div>
      }
    >
      <p>Để tự điền, ảnh giấy tờ được gửi lên máy chủ MCAH cho AI đọc. Máy chủ <b>không lưu</b> ảnh, chỉ ghi số trang và thời gian để tính phí.</p>
      <p className="muted" style={{ marginBottom: 0 }}>Không đồng ý thì vẫn nhập tay được như thường.</p>
    </Modal>
  )
}
