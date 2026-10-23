import { Tooltip } from 'antd'
import '../ds/ds.css'

export default function ZaloButton({ phone, size = 16 }) {
  if (!phone) return null
  const clean = phone.replace(/\D/g, '')
  return (
    <Tooltip title={`Nhắn Zalo: ${phone}`}>
      <a
        href={`https://zalo.me/${clean}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ds-copy"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="https://page.widget.zalo.me/static/images/2.0/Logo.svg"
          alt="Zalo"
          style={{ width: size, height: size, borderRadius: 4 }}
        />
      </a>
    </Tooltip>
  )
}
