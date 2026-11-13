import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Radio } from 'antd'
import Banner from '../../components/ds/Banner'
import ProductBrand from '../../components/common/ProductBrand'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop } from '../../lib/desktop'
import PairPanel from './PairPanel'
import '../admin/LoginPage.css'

const CHECK_GROUPS = [1, 4] // nhóm thứ 2 và thứ 5 (đếm từ 0)

// Wireframe 3 + 4 (docs/design/wireframes/desktop-gd2.html): máy chưa có dữ liệu văn phòng sau lần đăng nhập đầu.
// Tạo văn phòng: tên → mật khẩu sao lưu → mã khôi phục (chỉ hiện một lần) → kiểm nhóm 2 và 5 → tạo.
// Tài khoản đã thuộc văn phòng (được mời): máy này là máy nhân viên, tìm và nối máy chính (PairPanel, giai đoạn 3).
export default function FirstRunPage() {
  const navigate = useNavigate()
  const setDesktopUser = useAuthStore((state) => state.setDesktopUser)
  const [info, setInfo] = useState(null)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [checks, setChecks] = useState(['', ''])
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
  const groups = code.split('-')

  async function toCode() {
    setError('')
    if (password.length < 10) return setError('Mật khẩu sao lưu cần ít nhất 10 ký tự')
    if (password !== password2) return setError('Hai lần nhập mật khẩu chưa khớp')
    setBusy(true)
    try {
      setCode(await desktop.prepareOffice(password))
      setStep(3)
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    setError('')
    if (CHECK_GROUPS.some((g, i) => checks[i].trim().toUpperCase() !== groups[g])) return setError('Nhóm mã chưa đúng. Bấm Xem lại mã để kiểm.')
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
        <Radio.Group value="create" style={{ display: 'grid', gap: 12 }}>
          <Radio value="create"><b>Tạo văn phòng mới</b><div className="muted">Máy này giữ dữ liệu của văn phòng. Bạn là quản trị.</div></Radio>
          <Radio value="restore" disabled><b>Khôi phục từ bản sao lưu</b><div className="muted">Chuyển văn phòng sang máy này (sắp có).</div></Radio>
        </Radio.Group>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{logout}<Button type="primary" onClick={() => setStep(1)}>Tiếp tục</Button></div>
      </>
    )
  } else if (step === 1) {
    body = (
      <>
        {head('Tên văn phòng', 'Bước 1/3')}
        {err}
        <label style={{ display: 'grid', gap: 4 }}>Tên hiện cho mọi người<Input size="large" maxLength={200} value={name} autoFocus onChange={(e) => setName(e.target.value)} onPressEnter={() => name.trim() && setStep(2)} /></label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Button onClick={() => setStep(0)}>Quay lại</Button><Button type="primary" disabled={!name.trim()} onClick={() => setStep(2)}>Tiếp</Button></div>
      </>
    )
  } else if (step === 2) {
    body = (
      <>
        {head('Mật khẩu sao lưu', 'Bước 2/3')}
        <p className="muted" style={{ margin: 0 }}>Dùng để mở bản sao lưu khi chuyển sang máy khác. Khác mật khẩu đăng nhập.</p>
        {err}
        <label style={{ display: 'grid', gap: 4 }}>Mật khẩu (ít nhất 10 ký tự)<Input.Password size="large" autoComplete="new-password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} /></label>
        <label style={{ display: 'grid', gap: 4 }}>Nhập lại<Input.Password size="large" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} onPressEnter={toCode} /></label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Button onClick={() => setStep(1)}>Quay lại</Button><Button type="primary" loading={busy} onClick={toCode}>Tiếp</Button></div>
      </>
    )
  } else if (step === 3) {
    body = (
      <>
        {head('Mã khôi phục dữ liệu', 'Bước 3/3')}
        <Banner tone="warning">Chỉ hiện một lần. In hoặc chép ra giấy, cất nơi an toàn. Mất cả mật khẩu sao lưu lẫn mã này thì không mở được tài liệu, bên MCAH cũng không mở được.</Banner>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontFamily: 'ui-monospace, monospace', fontSize: 16, textAlign: 'center' }} aria-label="Mã khôi phục dữ liệu">
          {groups.map((g, i) => <span key={i} style={{ padding: 8, background: 'var(--secondary)', borderRadius: 8 }}>{g}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => window.print()}>In</Button>
          <Button onClick={() => navigator.clipboard.writeText(code)}>Chép</Button>
          <Button type="primary" style={{ marginLeft: 'auto' }} onClick={() => setStep(4)}>Đã chép mã</Button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        {head('Kiểm tra mã')}
        <p className="muted" style={{ margin: 0 }}>Nhập nhóm thứ 2 và thứ 5 của mã vừa chép.</p>
        {err}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['Nhóm 2', 'Nhóm 5'].map((label, i) => (
            <label key={label} style={{ display: 'grid', gap: 4 }}>{label}
              <Input size="large" maxLength={4} value={checks[i]} autoFocus={i === 0} onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.value : v)))} onPressEnter={create} />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Button onClick={() => setStep(3)}>Xem lại mã</Button><Button type="primary" loading={busy} onClick={create}>Tạo văn phòng</Button></div>
      </>
    )
  }

  return (
    <main className="login">
      <div className="login__card">{body}</div>
    </main>
  )
}
