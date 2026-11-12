import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Input } from 'antd'
import Banner from '../../components/ds/Banner'
import HelpLink, { GUIDE_HOME_URL } from '../../components/ds/HelpLink'
import ProductBrand from '../../components/common/ProductBrand'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop } from '../../lib/desktop'
import '../admin/LoginPage.css'

const REASONS = {
  offline: 'Đã 7 ngày không kết nối internet. Kết nối rồi đăng nhập lại.',
  clock: 'Giờ của máy bị chỉnh lùi. Chỉnh lại giờ đúng rồi đăng nhập lại.',
  pin: 'Nhập sai mã PIN quá 5 lần. Đăng nhập lại để tiếp tục.',
}

// Wireframe 1 (docs/design/wireframes/desktop-gd2.html): app không nhận mật khẩu; đăng ký / đăng nhập / quên mật khẩu
// làm trên trang web. Đang chờ: mở lại trình duyệt, nhập mã thủ công (khi trình duyệt không chuyển về được), huỷ.
// state.reauth: sau khi sai PIN 5 lần, trang web bắt nhập lại mật khẩu thật.
export default function DesktopLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setDesktopUser = useAuthStore((state) => state.setDesktopUser)
  const [waiting, setWaiting] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(location.state?.message || '')
  const [online, setOnline] = useState(navigator.onLine)
  const [reason, setReason] = useState(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    // Đã đăng nhập nhưng máy chưa có văn phòng (vd. mở lại app giữa chừng) → màn Lần đầu.
    desktop.session().then((info) => {
      if (info.needsOffice) navigate('/bat-dau', { replace: true })
      else if (info.reason) {
        setReason(info.reason)
        setError(REASONS[info.reason] || '')
      }
    })
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [navigate])

  async function start() {
    setError('')
    setWaiting(true)
    try {
      const result = await desktop.login({ reauth: Boolean(location.state?.reauth) || reason === 'pin' })
      if (result.needsOffice) navigate('/bat-dau', { replace: true })
      else {
        setDesktopUser(result.user)
        navigate('/', { replace: true })
      }
    } catch (err) {
      const message = bridgeError(err)
      if (!/Đã huỷ đăng nhập/.test(message)) setError(message)
      setWaiting(false)
      setCodeOpen(false)
    }
  }

  async function submitCode() {
    setError('')
    try {
      await desktop.loginWithCode(code)
    } catch (err) {
      setError(bridgeError(err))
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <div>
          <ProductBrand />
          <h1 className="login__title">Đăng nhập MCAH</h1>
        </div>
        <p style={{ margin: 0 }} className="muted">Trình duyệt sẽ mở trang đăng nhập. Xong bạn quay lại đây, app tự vào.</p>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="primary" size="large" block loading={waiting} disabled={!online && !waiting} onClick={start}>
          {waiting ? 'Đang chờ trình duyệt…' : 'Đăng nhập qua trình duyệt'}
        </Button>
        {!online ? <p className="muted" style={{ margin: 0 }}>Cần kết nối internet để đăng nhập.</p> : null}
        {waiting ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button type="link" size="small" onClick={() => desktop.reopenBrowser()}>Mở lại trình duyệt</Button>
            <Button type="link" size="small" onClick={() => setCodeOpen(true)}>Nhập mã thủ công</Button>
            <Button type="link" size="small" onClick={() => desktop.cancelLogin()}>Huỷ</Button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, textAlign: 'center' }}>Chưa có tài khoản? Bấm nút trên rồi chọn Đăng ký.</p>
        )}
        {waiting && codeOpen ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="login-code">Mã trên trang "Đã đăng nhập"</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input id="login-code" size="large" placeholder="K7P2-9QXM" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} onPressEnter={submitCode} autoFocus />
              <Button size="large" onClick={submitCode} disabled={code.trim().length < 8}>Vào</Button>
            </div>
          </div>
        ) : null}
      </div>
      <HelpLink href={GUIDE_HOME_URL}>Hướng dẫn sử dụng</HelpLink>
    </main>
  )
}
