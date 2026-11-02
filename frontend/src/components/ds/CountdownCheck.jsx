import { useEffect, useState } from 'react'
import { Checkbox } from 'antd'
import './ds.css'

// Ô tích có đếm ngược: trong `seconds` giây đầu ô tắt (không tích được) và nhãn thêm "(chờ n giây…)", hết giờ mới tích được.
// Dùng để buộc người dùng đọc bảng thay đổi trước khi bấm nút xác nhận (hộp duyệt lại hợp đồng). Khác ConfirmGate: ô không tích trước được.
// Điều khiển từ ngoài (checked, onChange). `resetKey` đổi thì đếm lại từ đầu; bên giữ state nên bỏ tích khi đổi resetKey.
export default function CountdownCheck({ seconds = 5, label, checked = false, onChange, resetKey }) {
  const [left, setLeft] = useState(seconds)
  const [lastKey, setLastKey] = useState(resetKey)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setLeft(seconds)
  }

  useEffect(() => {
    if (left <= 0) return undefined
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const waiting = left > 0
  return (
    <div className="ds-countdown-check">
      <Checkbox checked={checked && !waiting} disabled={waiting} onChange={(event) => onChange?.(event.target.checked)}>
        {label}
        {waiting ? <span className="ds-countdown-check__wait ds-num"> (chờ {left} giây…)</span> : null}
      </Checkbox>
    </div>
  )
}
