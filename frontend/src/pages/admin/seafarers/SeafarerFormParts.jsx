import { useState } from 'react'
import { Button } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'


// Hình người mặc định khi chưa có ảnh, khung đứng 4x6.
export function PhotoFrame({ src, onClick }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`sf-photo${onClick ? ' sf-photo--btn' : ''}`}
      {...(onClick ? { type: 'button', onClick, 'aria-label': src ? 'Đổi ảnh chân dung' : 'Chọn ảnh chân dung', title: 'Bấm để chọn ảnh chân dung' } : {})}
    >
      {src ? (
        <img src={src} alt="Ảnh chân dung" />
      ) : (
        <svg viewBox="0 0 40 60" aria-hidden="true">
          <circle cx="20" cy="22" r="9" />
          <path d="M2 60c0-13 8-21 18-21s18 8 18 21z" />
        </svg>
      )}
    </Tag>
  )
}

// Chọn một trong vài giá trị; bấm lại nút đang chọn để bỏ chọn. Dùng làm control của Form.Item.
export function ChoiceGroup({ value, onChange, options, label, id }) {
  return (
    <div className="sf-seg" role="group" aria-label={label} id={id}>
      {options.map((opt) => {
        const pressed = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange?.(pressed ? null : opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// Bật tắt nhiều lựa chọn cùng lúc (người thân vừa là liên lạc vừa là bảo lãnh). value là mảng.
export function ToggleGroup({ value = [], onChange, options, label }) {
  const toggle = (key) => onChange?.(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])
  return (
    <div className="sf-toggles" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="sf-toggle"
          aria-pressed={value.includes(opt.value)}
          onClick={() => toggle(opt.value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Ô ảnh chân dung: kéo thả hoặc bấm "Chọn ảnh" (hộp chọn tệp nằm ở trang, dùng chung với ảnh bên trái).
export function PhotoField({ src, error, onChoose, onDropFile, onRemove }) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      className={`sf-drop${dragging ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onDropFile(file)
      }}
    >
      <PhotoFrame src={src} />
      <div className="sf-drop__text">
        <b>{src ? 'Đã có ảnh chân dung' : 'Kéo ảnh vào đây'}</b>
        <span>JPG hoặc PNG, tối đa 10 MB. Nên dùng ảnh thẻ 4×6.</span>
        {error ? <span className="sf-drop__error" role="alert">{error}</span> : null}
      </div>
      <div className="sf-drop__actions">
        {src ? (
          <Button icon={<DeleteOutlined />} onClick={onRemove}>
            Gỡ ảnh
          </Button>
        ) : null}
        <Button icon={<UploadOutlined />} onClick={onChoose}>
          {src ? 'Đổi ảnh' : 'Chọn ảnh'}
        </Button>
      </div>
    </div>
  )
}
