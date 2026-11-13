import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Spin } from 'antd'
import Banner from '../../components/ds/Banner'
import ChoiceCardGroup from '../../components/ds/ChoiceCardGroup'
import useAuthStore from '../../stores/authStore'
import { bridgeError, desktop } from '../../lib/desktop'

// Máy nhân viên tìm và nối máy chính (wireframe docs/design/wireframes/desktop-gd3.html màn 1, 7).
// Tìm trong mạng văn phòng; không thấy thì gõ tên / IP. Máy đã bị Gỡ xin vào lại thì chờ quản trị duyệt.
export default function PairPanel({ info, head, logout }) {
  const navigate = useNavigate()
  const setDesktopUser = useAuthStore((state) => state.setDesktopUser)
  const [mode, setMode] = useState('finding') // finding | pick | manual | pending | wrong
  const [found, setFound] = useState([])
  const [host, setHost] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const find = async () => {
    setMode('finding')
    setError('')
    try {
      const list = await desktop.lanFind()
      setFound(list)
      setHost(list[0]?.host || '')
      setMode(list.length ? 'pick' : 'manual')
    } catch (err) {
      setError(bridgeError(err))
      setMode('manual')
    }
  }

  useEffect(() => {
    let alive = true
    desktop.lanInfo().then((s) => {
      if (!alive) return
      if (s.pending) setMode('pending')
      else find()
    })
    return () => {
      alive = false
    }
  }, [])

  // Đang chờ duyệt: hỏi lại máy chính mỗi 5 giây.
  useEffect(() => {
    if (mode !== 'pending') return undefined
    const timer = setInterval(async () => {
      try {
        const r = await desktop.lanPairStatus()
        if (r.status === 'active') done()
        else if (r.status === 'rejected') {
          setMode('manual')
          setError('Quản trị đã từ chối máy này. Liên hệ quản trị văn phòng.')
        }
      } catch {
        // Máy chính tạm không trả lời: lần sau hỏi lại.
      }
    }, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function done() {
    const s = await desktop.session()
    if (s.loggedIn) {
      setDesktopUser(s.user)
      navigate('/', { replace: true })
    }
  }

  async function connect() {
    setError('')
    if (!host.trim()) return setError('Chọn máy chính hoặc gõ tên / địa chỉ máy')
    setBusy(true)
    try {
      const r = await desktop.lanPair(host.trim())
      if (r.status === 'active') return done()
      if (r.status === 'pending') return setMode('pending')
      if (r.code === 'WRONG_MACHINE') return setMode('wrong')
      setError(r.message)
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  const err = error ? <Banner tone="error">{error}</Banner> : null
  const office = info.office_name

  if (mode === 'wrong') {
    return (
      <>
        {head('Không nối máy này')}
        <Banner tone="error">Máy {host} không phải máy chính của {office}.</Banner>
        <p className="muted" style={{ margin: 0 }}>Có thể có máy lạ trong mạng đang giả tên máy chính. Báo quản trị văn phòng. Không nhập thông tin gì vào máy này.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{logout}<Button type="primary" onClick={find}>Tìm lại</Button></div>
      </>
    )
  }
  if (mode === 'pending') {
    return (
      <>
        {head('Đang chờ quản trị duyệt')}
        <p style={{ margin: 0 }}>Máy này vừa xin vào lại {office}. Quản trị duyệt ở Quản trị → Máy trong văn phòng là bạn vào được.</p>
        <Spin />
        <div>{logout}</div>
      </>
    )
  }
  return (
    <>
      {head(`Nối máy chính của ${office}`)}
      {mode === 'finding' ? (
        <p className="muted" style={{ margin: 0 }}>Đang tìm trong mạng văn phòng… <Spin size="small" /></p>
      ) : null}
      {mode === 'pick' ? (
        <ChoiceCardGroup
          name="main-machine"
          legend="Máy chính tìm thấy"
          value={host}
          onChange={setHost}
          options={found.map((m) => ({ value: m.host, title: m.name, description: `${m.host} · máy chính của ${office}` }))}
        />
      ) : null}
      {mode === 'manual' ? (
        <>
          <p className="muted" style={{ margin: 0 }}>Không tìm thấy máy chính trong mạng. Gõ tên máy chính (xem ở Cài đặt trên máy này của máy chính) hoặc địa chỉ IP.</p>
          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="MAY-KE-TOAN hoặc 192.168.1.20" onPressEnter={connect} autoFocus />
        </>
      ) : null}
      {err}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {logout}
        <span style={{ display: 'flex', gap: 8 }}>
          {mode === 'pick' ? <Button type="link" onClick={() => setMode('manual')}>Nhập tên / địa chỉ máy</Button> : null}
          {mode === 'manual' ? <Button type="link" onClick={find}>Tìm lại</Button> : null}
          <Button type="primary" loading={busy} disabled={mode === 'finding'} onClick={connect}>Nối</Button>
        </span>
      </div>
    </>
  )
}
