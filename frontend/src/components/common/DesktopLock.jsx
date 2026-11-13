import { useEffect, useState } from 'react'
import { Button, Input, Modal } from 'antd'
import ProductBrand from './ProductBrand'
import Banner from '../ds/Banner'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop, isDesktop } from '../../lib/desktop'

// Wireframe 5 (docs/design/wireframes/desktop-gd2.html), chỉ trong app máy tính:
// - chưa có PIN trên máy này (lần đăng nhập đầu): hộp đặt PIN 6 số, bắt buộc;
// - app tự khoá (rỗi quá ngưỡng / máy khoá màn hình): màn khoá phủ cả cửa sổ, mở bằng PIN. Sai 5 lần → về đăng nhập.
export default function DesktopLock() {
  const user = useAuthStore((state) => state.user)
  const [state, setState] = useState(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isDesktop()) return undefined
    desktop.lockState().then(setState)
    return desktop.onLockChanged((locked) => {
      setValue('')
      setError('')
      setState((s) => ({ ...s, locked }))
    })
  }, [])

  if (!state) return null

  async function savePin() {
    if (!/^\d{6}$/.test(value)) return setError('Mã PIN gồm đúng 6 chữ số')
    setBusy(true)
    try {
      await desktop.setPin(value)
      setState({ locked: false, hasPin: true })
      setValue('')
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function unlock() {
    setBusy(true)
    try {
      const result = await desktop.unlock(value)
      setValue('')
      if (result.ok) setError('')
      else if (result.exhausted) window.location.href = '/login'
      else setError(`Sai mã PIN. Còn ${result.left} lần thử.`)
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  const pinInput = (onEnter) => (
    <Input.Password
      size="large"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      placeholder="6 chữ số"
      aria-label="Mã PIN"
      style={{ maxWidth: 220, textAlign: 'center' }}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onPressEnter={onEnter}
    />
  )

  if (!state.hasPin) {
    return (
      <Modal open title="Đặt mã PIN cho máy này" closable={false} maskClosable={false} keyboard={false}
        footer={<Button type="primary" loading={busy} onClick={savePin}>Lưu</Button>}>
        <p>Dùng để mở khoá MCAH khi để máy một lúc. Không cần internet.</p>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>{pinInput(savePin)}</div>
      </Modal>
    )
  }

  if (!state.locked) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="MCAH đã khoá" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--background)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: 'min(400px, 100%)', background: 'var(--surface)', borderRadius: 16, padding: 32, display: 'grid', gap: 16, justifyItems: 'center', textAlign: 'center' }}>
        <ProductBrand />
        <div><b>{user?.full_name || user?.email}</b><div className="muted">MCAH đã khoá</div></div>
        {pinInput(unlock)}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="primary" block loading={busy} disabled={value.length !== 6} onClick={unlock}>Mở khoá</Button>
        <Button type="link" onClick={() => desktop.logout().then(() => (window.location.href = '/login'))}>Quên mã PIN? Đăng nhập lại</Button>
      </div>
    </div>
  )
}
