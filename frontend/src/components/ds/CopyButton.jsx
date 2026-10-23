import { useEffect, useRef, useState } from 'react'
import { Tooltip } from 'antd'
import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import './ds.css'

// Nút sao chép giá trị vào clipboard, đặt ngay sau các trường mã số (số hộ chiếu, CCCD, số điện thoại, số tài khoản...). Kiểu duy nhất của MCAH.
// Bấm xong đổi sang dấu tích ~1,5 giây.
export default function CopyButton({ value, label = 'Sao chép' }) {
  const [done, setDone] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  if (value === undefined || value === null || value === '') return null

  const copy = async (event) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(String(value))
    } catch {
      const area = document.createElement('textarea')
      area.value = String(value)
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setDone(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), 1500)
  }

  return (
    <Tooltip title={done ? 'Đã sao chép' : label}>
      <button type="button" className={done ? 'ds-copy is-done' : 'ds-copy'} onClick={copy} aria-label={`${label}: ${value}`}>
        {done ? <CheckOutlined /> : <CopyOutlined />}
      </button>
    </Tooltip>
  )
}
