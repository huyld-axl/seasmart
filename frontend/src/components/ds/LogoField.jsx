import { useRef, useState } from 'react'
import { Button } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import './ds.css'

// Ô logo công ty: kéo thả hoặc bấm "Chọn logo". `src` là ảnh đang hiện (đã có hoặc vừa chọn).
// Chỉ báo lên trang qua onPick / onRemove; việc tải lên làm khi lưu form.
export default function LogoField({ src, error, onPick, onRemove }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const pick = (file) => file && onPick(file)
  return (
    <div
      className={`ds-logo${dragging ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pick(e.dataTransfer.files?.[0])
      }}
    >
      <span className="ds-logo__frame">{src ? <img src={src} alt="Logo công ty" /> : <span aria-hidden>Logo</span>}</span>
      <div className="ds-logo__text">
        <b>{src ? 'Đã có logo' : 'Kéo logo vào đây'}</b>
        <span>JPG hoặc PNG, tối đa 2 MB. Nên dùng ảnh vuông hoặc nền trong.</span>
        {error ? <span className="ds-logo__error" role="alert">{error}</span> : null}
      </div>
      <div className="ds-logo__actions">
        {src ? <Button icon={<DeleteOutlined />} onClick={onRemove}>Gỡ logo</Button> : null}
        <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>{src ? 'Đổi logo' : 'Chọn logo'}</Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="ds-sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
