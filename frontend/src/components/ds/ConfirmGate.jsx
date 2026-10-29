import { useEffect, useState } from 'react'
import { Checkbox } from 'antd'
import './ds.css'

// Cổng xác nhận cho cảnh báo quan trọng, đặt trong hộp xác nhận: người dùng phải tích ô xác nhận VÀ chờ hết `seconds` giây mới bấm được nút đồng ý.
// Bên gọi giữ nút (modal.confirm) và nhận `onReadyChange(ready)` để khoá / mở nút đó.
export default function ConfirmGate({ label, seconds = 5, onReadyChange }) {
  const [checked, setChecked] = useState(false)
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (left <= 0) return undefined
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const ready = checked && left <= 0
  useEffect(() => { onReadyChange?.(ready) }, [ready, onReadyChange])

  return (
    <div className="ds-gate">
      <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)}>{label}</Checkbox>
      {left > 0 ? <span className="ds-gate__wait ds-num">Chờ {left} giây</span> : null}
    </div>
  )
}
