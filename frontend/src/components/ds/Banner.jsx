import { CloseCircleOutlined, CompassOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import './ds.css'

const TONE_ICONS = { warning: ExclamationCircleOutlined, error: CloseCircleOutlined, neutral: CompassOutlined }

// Thanh thông báo trong trang (components/banner.md). tone: warning | error | neutral.
// `children` là danh sách lý do (BLOCKED) hay đoạn phụ; `action` là nút viền bên phải.
export default function Banner({ tone = 'warning', title, description, children, action }) {
  const Icon = TONE_ICONS[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`ds-banner ds-banner--${tone}`}>
      <Icon className="ds-banner__icon" aria-hidden />
      <div className="ds-banner__body">
        <p className="ds-banner__title">{title}</p>
        {description ? <p className="ds-banner__text">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="ds-banner__action">{action}</div> : null}
    </div>
  )
}
