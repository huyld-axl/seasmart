import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from 'antd'
import Banner from '../../components/ds/Banner'
import ProductBrand from '../../components/common/ProductBrand'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop } from '../../lib/desktop'
import PairPanel from './PairPanel'
import '../admin/LoginPage.css'

// Wireframe 3 + 4 (docs/design/wireframes/desktop-gd2.html): máy chưa có dữ liệu văn phòng sau lần đăng nhập đầu.
// Tạo văn phòng: chỉ đặt tên (Q14, docs/mcah-ke-hoach-desktop-gd4.md 3.6: không còn mật khẩu sao lưu / mã khôi phục).
// Tài khoản đã thuộc văn phòng (được mời): máy này là máy nhân viên, tìm và nối máy chính (PairPanel, giai đoạn 3).
export default function FirstRunPage() {
  const navigate = useNavigate()
  const setDesktopUser = useAuthStore((state) => state.setDesktopUser)
  const [info, setInfo] = useState(null)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    desktop.session().then((s) => {
      if (s.loggedIn) navigate('/', { replace: true })
      else if (!s.needsOffice) navigate('/login', { replace: true })
      else setInfo(s.account)
    })
  }, [navigate])

  if (!info) return null

  async function create() {
    setError('')
    if (!name.trim()) return setError('Nhập tên văn phòng')
    setBusy(true)
    try {
      const result = await desktop.createOffice(name)
      setDesktopUser(result.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  const err = error ? <Banner tone="error">{error}</Banner> : null
  const head = (title, sub) => (
    <div>
      <ProductBrand />
      {sub ? <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>{sub}</div> : null}
      <h1 className="login__title" style={sub ? { marginTop: 4 } : undefined}>{title}</h1>
    </div>
  )
  const logout = (
    <Button type="link" onClick={() => desktop.logout().then(() => navigate('/login', { replace: true }))}>Đăng xuất</Button>
  )

  let body
  if (info.office) {
    body = <PairPanel info={info} head={head} logout={logout} />
  } else if (step === 0) {
    body = (
      <>
        {head(`Chào ${info.name}`)}
        <p className="muted" style={{ margin: 0 }}>Máy này chưa có dữ liệu văn phòng.</p>
        <p style={{ margin: 0 }}><b>Tạo văn phòng mới</b>: máy này giữ dữ liệu của văn phòng, bạn là quản trị. Nhân viên cài MCAH trên máy mình sẽ nối vào máy này.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{logout}<Button type="primary" onClick={() => setStep(1)}>Tiếp tục</Button></div>
      </>
    )
  } else if (step === 1) {
    body = (
      <>
        {head('Tên văn phòng')}
        {err}
        <label style={{ display: 'grid', gap: 4 }}>Tên hiện cho mọi người<Input size="large" maxLength={200} value={name} autoFocus onChange={(e) => setName(e.target.value)} onPressEnter={create} /></label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Button onClick={() => setStep(0)}>Quay lại</Button><Button type="primary" loading={busy} onClick={create}>Tạo văn phòng</Button></div>
      </>
    )
  }

  return (
    <main className="login">
      <div className="login__card">{body}</div>
    </main>
  )
}
