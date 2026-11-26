import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import Banner from '../../components/ds/Banner'
import ProductBrand from '../../components/common/ProductBrand'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop } from '../../lib/desktop'
import PairPanel from './PairPanel'
import '../admin/LoginPage.css'

// Máy chưa có dữ liệu văn phòng sau lần đăng nhập đầu (wireframe 7, 8 của docs/design/wireframes/tai-khoan-tu-tren-xuong.html).
// Văn phòng do Axalize tạo sẵn, không tự tạo trong app:
// - quản trị văn phòng, văn phòng chưa có máy chính → cài máy này làm máy chính;
// - nhân viên, văn phòng chưa có máy chính → chờ quản trị cài, bấm Thử lại;
// - văn phòng đã có máy chính → máy này là máy nhân viên, tìm và nối máy chính (PairPanel, giai đoạn 3);
// - tài khoản chưa thuộc văn phòng nào → hỏi quản trị văn phòng.
export default function FirstRunPage() {
  const navigate = useNavigate()
  const setDesktopUser = useAuthStore((state) => state.setDesktopUser)
  const [info, setInfo] = useState(null)
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

  async function run(action) {
    setError('')
    setBusy(true)
    try {
      const result = await action()
      if (result?.user) {
        setDesktopUser(result.user)
        navigate('/', { replace: true })
      } else if (result?.needsOffice) setInfo(result.account)
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
  const who = `${info.name} · ${info.email}`

  let body
  if (info.office && info.office_has_machine) {
    body = <PairPanel info={info} head={head} logout={logout} />
  } else if (info.office && info.office_role === 'admin') {
    body = (
      <>
        {head(`Cài máy chính cho ${info.office_name}`, who)}
        {err}
        <p style={{ margin: 0 }}>Máy này sẽ giữ toàn bộ dữ liệu của văn phòng. Nhân viên cài Catoro trên máy mình sẽ nối vào máy này. Nên chọn máy bàn luôn bật.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{logout}<Button type="primary" loading={busy} onClick={() => run(() => desktop.setupMainMachine())}>Dùng máy này làm máy chính</Button></div>
      </>
    )
  } else if (info.office) {
    body = (
      <>
        {head('Văn phòng chưa có máy chính', who)}
        {err}
        <p style={{ margin: 0 }}>{info.office_name} chưa cài máy chính. Nhờ quản trị văn phòng cài Catoro trên máy chính và đăng nhập trước, rồi bấm Thử lại.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{logout}<Button type="primary" loading={busy} onClick={() => run(() => desktop.recheckOffice())}>Thử lại</Button></div>
      </>
    )
  } else {
    body = (
      <>
        {head('Tài khoản chưa thuộc văn phòng nào', who)}
        <p style={{ margin: 0 }}>Hỏi quản trị văn phòng của bạn thêm tài khoản này vào văn phòng, rồi đăng nhập lại.</p>
        <div>{logout}</div>
      </>
    )
  }

  return (
    <main className="login">
      <div className="login__card">{body}</div>
    </main>
  )
}
