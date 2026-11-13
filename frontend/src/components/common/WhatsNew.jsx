import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { desktop, isDesktop } from '../../lib/desktop'

// Ghi chú thay đổi dạng gạch đầu dòng ("- …") → danh sách.
export function NotesList({ notes }) {
  const lines = String(notes || '').split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean)
  return <ul style={{ margin: 0, paddingLeft: 18 }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
}

// Lần đầu mở bản mới: dải "Đã cập nhật lên …" (docs/design/wireframes/desktop-gd6.html màn 2). Đóng là thôi.
export default function WhatsNewRibbon() {
  const [info, setInfo] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (isDesktop()) desktop.whatsNew().then((r) => r.unseen && setInfo(r)).catch(() => {})
  }, [])
  if (!info) return null
  const dismiss = () => {
    desktop.whatsNewSeen()
    setOpen(false)
    setInfo(null)
  }
  return (
    <>
      <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 20px', fontSize: 13, background: 'var(--success-bg)', color: 'var(--success)', borderBottom: '1px solid var(--border)' }}>
        <span>✓ Đã cập nhật lên MCAH {info.version}.</span>
        <Button type="link" size="small" style={{ marginLeft: 'auto' }} onClick={() => setOpen(true)}>Xem có gì mới</Button>
        <Button type="link" size="small" onClick={dismiss}>Đóng</Button>
      </div>
      <Modal open={open} title={`Có gì mới trong MCAH ${info.version}`} onCancel={dismiss} footer={<Button type="primary" onClick={dismiss}>Đã xem</Button>}>
        <NotesList notes={info.notes} />
      </Modal>
    </>
  )
}
