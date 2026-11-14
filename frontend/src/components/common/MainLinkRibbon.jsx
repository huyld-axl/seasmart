import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { desktop, isDesktop } from '../../lib/desktop'

// Máy nhân viên mất nối máy chính (wireframe docs/design/wireframes/desktop-gd3.html màn 3): dải đỏ, trang và nội dung
// đang gõ giữ nguyên (lưu sẽ báo lỗi, form còn nguyên); app tự thử lại mỗi 5 giây. Nối lại: dải xanh 3 giây.
export default function MainLinkRibbon() {
  const [state, setState] = useState('ok') // ok | down | back
  const [main, setMain] = useState(null)

  useEffect(() => {
    if (!isDesktop()) return undefined
    desktop.lanInfo().then((s) => setMain(s.main)).catch(() => {})
    let timer = null
    const off = desktop.onLanOnline((online) => {
      clearTimeout(timer)
      if (!online) return setState('down')
      setState('back')
      timer = setTimeout(() => setState('ok'), 3000)
    })
    return () => {
      clearTimeout(timer)
      off()
    }
  }, [])

  if (state === 'ok') return null
  const down = state === 'down'
  return (
    <div
      role={down ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '8px 20px',
        fontSize: 13,
        background: down ? 'var(--error-bg)' : 'var(--success-bg)',
        color: down ? 'var(--error-strong)' : 'var(--success)',
        borderBottom: `1px solid ${down ? 'var(--error-border, var(--border))' : 'var(--success-border, var(--border))'}`,
      }}
    >
      {down ? (
        <>
          <span>Không nối được máy chính{main?.name ? ` "${main.name}"` : ''}. Đang thử lại… Kiểm máy chính còn bật và cùng mạng. Nội dung đang nhập vẫn còn.</span>
          <Button type="link" size="small" style={{ marginLeft: 'auto' }} onClick={() => desktop.lanRetry()}>Thử ngay</Button>
        </>
      ) : (
        <span>Đã nối lại máy chính.</span>
      )}
    </div>
  )
}
