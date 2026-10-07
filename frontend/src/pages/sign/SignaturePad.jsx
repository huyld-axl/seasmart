import { useEffect, useRef, useState } from 'react'
import { Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

// Ô ký bằng ngón tay hoặc chuột. `onChange(hasInk)` báo đã có nét ký hay chưa.
export default function SignaturePad({ disabled = false, onChange, resetKey }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const inked = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1d3f91'
    inked.current = false
  }, [resetKey])

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  function down(event) {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(...point(event))
  }

  function move(event) {
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(...point(event))
    ctx.stroke()
    if (!inked.current) { inked.current = true; setHasInk(true); onChange?.(true) }
  }

  function clear() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    inked.current = false
    setHasInk(false)
    onChange?.(false)
  }

  return (
    <div className={disabled ? 'rs-pad rs-pad--disabled' : 'rs-pad'}>
      <canvas
        ref={canvasRef}
        aria-label="Ô ký tên"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false }}
        onPointerLeave={() => { drawing.current = false }}
      />
      {!hasInk && <span className="rs-pad__hint">{disabled ? 'Tick đồng ý ở trên rồi ký' : 'Ký bằng ngón tay vào đây'}</span>}
      <span className="rs-pad__line" aria-hidden />
      <Button className="rs-pad__clear" size="small" type="text" icon={<ReloadOutlined />} onClick={clear} disabled={disabled}>Ký lại</Button>
    </div>
  )
}
