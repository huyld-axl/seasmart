import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Progress } from 'antd'
import usePdfComponentStore from '../../stores/pdfComponentStore'
import { desktop } from '../../lib/desktop'

// Wireframe 5 (docs/design/wireframes/desktop-gd1.html): máy chưa có LibreOffice. Cài ngay → Đang cài… (tiến độ) →
// đóng và để client.js làm lại việc xuất vừa bấm. Lỗi: lý do + Thử lại + cài tay. Chỉ dùng trong app máy tính.
export default function PdfComponentModal() {
  const { open, finish } = usePdfComponentStore()
  const [state, setState] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setState('idle')
      setProgress(null)
      setError('')
    }
  }, [open])

  async function install() {
    setState('installing')
    setError('')
    const stop = desktop.onPdfInstallProgress(setProgress)
    try {
      await desktop.installPdfComponent()
      finish(true)
    } catch (err) {
      setState('error')
      setError(String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      stop()
    }
  }

  const installing = state === 'installing'
  return (
    <Modal
      open={open}
      title="Cần cài thành phần xuất PDF"
      closable={!installing}
      maskClosable={false}
      onCancel={() => finish(false)}
      footer={[
        <Button key="later" disabled={installing} onClick={() => finish(false)}>Để sau</Button>,
        <Button key="install" type="primary" loading={installing} onClick={install}>
          {installing ? 'Đang cài…' : state === 'error' ? 'Thử lại' : 'Cài ngay'}
        </Button>,
      ]}
    >
      <p>Xuất PDF dùng LibreOffice (miễn phí). Cài một lần trên máy này, khoảng 5–10 phút. Trong lúc chờ bạn vẫn xuất Excel được.</p>
      <Alert type="warning" showIcon message="Máy sẽ hỏi mật khẩu quản trị để cài." />
      {installing ? (
        <div style={{ marginTop: 16 }}>
          <div className="muted">{progress?.text || 'Đang chuẩn bị…'}</div>
          {progress?.percent != null ? <Progress percent={progress.percent} size="small" /> : <Progress percent={100} status="active" showInfo={false} size="small" />}
        </div>
      ) : null}
      {state === 'error' ? (
        <Alert
          style={{ marginTop: 16 }}
          type="error"
          showIcon
          message={error || 'Cài không thành công'}
          description={<button type="button" className="ds-link" onClick={() => desktop.openExternal('libreoffice')}>Tải và cài tay LibreOffice</button>}
        />
      ) : null}
    </Modal>
  )
}
