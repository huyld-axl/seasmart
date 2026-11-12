import { useEffect, useState } from 'react'
import { Button } from 'antd'
import dayjs from 'dayjs'
import { desktop, isDesktop } from '../../lib/desktop'

const DAY = 86400000

// Wireframe 7 (docs/design/wireframes/desktop-gd2.html): còn ≤ 2 ngày tới mốc offline thì nhắc kết nối internet.
// Có mạng thì app tự làm mới mỗi giờ nên mốc luôn còn ~7 ngày và dải không hiện. Không chặn thao tác.
export default function OfflineRibbon() {
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isDesktop()) return undefined
    const load = () => desktop.session().then(setInfo).catch(() => {})
    load()
    const timer = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  if (!info?.loggedIn) return null
  const left = new Date(info.offlineUntil) - new Date(info.now)
  if (left > 2 * DAY) return null
  const offlineDays = Math.max(1, 7 - Math.ceil(left / DAY))

  async function retry() {
    setBusy(true)
    try {
      setInfo(await desktop.refreshSession())
    } catch {
      // Vẫn chưa có mạng: giữ dải.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 20px', background: 'var(--warning-bg)', borderBottom: '1px solid var(--warning-border)', color: 'var(--warning)', fontSize: 13 }}>
      <span>Máy chưa kết nối internet {offlineDays} ngày. Kết nối trước {dayjs(info.offlineUntil).format('HH:mm DD/MM')} để giữ đăng nhập.</span>
      <Button type="link" size="small" loading={busy} style={{ marginLeft: 'auto' }} onClick={retry}>Thử lại</Button>
    </div>
  )
}
