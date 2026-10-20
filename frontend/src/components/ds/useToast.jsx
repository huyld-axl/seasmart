import { App, Button, Grid } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'

// Toast: góc dưới phải, dưới giữa ở màn hẹp. Không đặt ở trên vì che các nút đầu trang (Duyệt, Bắt đầu chuyến…);
// chừa chỗ cho thanh lưu dính đáy (App.jsx đặt bottom, ds.css chỉnh màn hẹp). Có hành động thì nút nằm cuối dòng.
export default function useToast() {
  const { notification } = App.useApp()
  const screens = Grid.useBreakpoint()
  const placement = screens.sm ? 'bottomRight' : 'bottom'

  function show(kind, text, { actionLabel, onAction, duration = 5 } = {}) {
    const key = `${Date.now()}-${Math.random()}`
    notification.open({
      key,
      placement,
      duration: onAction ? 8 : duration,
      className: `ds-toast ds-toast--${kind}`,
      closeIcon: kind === 'error',
      icon: kind === 'error' ? <CloseCircleOutlined /> : kind === 'info' ? <InfoCircleOutlined /> : <CheckCircleOutlined />,
      title: (
        <span className="ds-toast__row">
          <span className="ds-toast__text">{text}</span>
          {onAction ? (
            <Button
              size="small"
              className="ds-toast__action"
              onClick={() => {
                notification.destroy(key)
                onAction()
              }}
            >
              {actionLabel}
            </Button>
          ) : null}
        </span>
      ),
    })
  }

  return {
    success: (text, options) => show('success', text, options),
    error: (text, options) => show('error', text, options),
    info: (text, options) => show('info', text, options),
  }
}
