import { chatHref } from '../../utils/chatQr'
import { Tooltip } from 'antd'
import '../ds/ds.css'

export default function ZaloButton({ phone, size = 22 }) {
  if (!phone) return null
  return (
    <Tooltip title={`Nhắn Zalo: ${phone}`}>
      <a
        href={chatHref('zalo', phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="ds-copy"
        aria-label={`Nhắn Zalo: ${phone}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="/images/contact/zalo.svg"
          alt="Zalo"
          style={{ width: size, height: size, borderRadius: 4 }}
        />
      </a>
    </Tooltip>
  )
}
