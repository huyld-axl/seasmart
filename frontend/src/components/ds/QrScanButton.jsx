import { useRef, useState } from 'react'
import { Tooltip } from 'antd'
import { LoadingOutlined, QrcodeOutlined } from '@ant-design/icons'
import { decodeQrFile } from '../../utils/qrDecode'
import './ds.css'

// Nút quét mã QR kết bạn (WhatsApp, LINE, WeChat, Zalo) đặt cuối ô nhập. Chọn ảnh chứa mã (ảnh chụp màn hình, hoặc chụp bằng camera trên điện thoại);
// đọc được thì gọi onText(chữ trong mã), không đọc được thì gọi onFail(). Kiểu duy nhất của MCAH cho việc nhập nhanh bằng mã QR.
export default function QrScanButton({ onText, onFail, label = 'Quét mã QR' }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const text = await decodeQrFile(file)
      if (text) onText(text)
      else onFail?.()
    } catch {
      onFail?.()
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="environment" className="ds-sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />
      <Tooltip title={label}>
        <button type="button" className="ds-copy ds-qr" aria-label={label} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <LoadingOutlined spin /> : <QrcodeOutlined />}
        </button>
      </Tooltip>
    </>
  )
}
