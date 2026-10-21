import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'

const ICONS = {
  success: <CheckCircleOutlined />,
  info: <InfoCircleOutlined />,
  warning: <ExclamationCircleOutlined />,
  error: <CloseCircleOutlined />,
}

// Nội dung một toast: [icon] [tiêu đề, mô tả] [hành động] [✕]. useToast đặt nó vào notification của antd;
// /design-system bày dạng tĩnh bằng `static` (khung giống hệt toast thật).
export default function ToastContent({ kind, title, description, actionLabel, onAction, onClose, static: isStatic }) {
  const row = (
    <span className="ds-toast__row">
      <span className="ds-toast__icon" aria-hidden>
        {ICONS[kind]}
      </span>
      <span className="ds-toast__body">
        <span className="ds-toast__title">{title}</span>
        {description ? <span className="ds-toast__desc">{description}</span> : null}
      </span>
      {onAction || onClose ? (
        <span className="ds-toast__acts">
          {onAction ? (
            <button type="button" className="ds-toast__action" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="ds-toast__close" aria-label="Đóng thông báo" onClick={onClose}>
              <CloseOutlined />
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
  if (!isStatic) return row
  return <div className={`ds-toast ds-toast--static ds-toast--${kind}`}>{row}</div>
}
