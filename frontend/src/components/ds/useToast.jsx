import { App, Button, Grid } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

// Toast (layouts/overlay.md): góc trên phải, lên đỉnh giữa dưới sm. Có hành động thì nút nằm cuối dòng.
export default function useToast() {
  const { notification } = App.useApp()
  const screens = Grid.useBreakpoint()
  const placement = screens.sm ? 'topRight' : 'top'

  function show(kind, text, { actionLabel, onAction, duration = 5 } = {}) {
    const key = `${Date.now()}-${Math.random()}`
    notification.open({
      key,
      placement,
      duration: onAction ? 8 : duration,
      className: `ds-toast ds-toast--${kind}`,
      closeIcon: kind === 'error',
      icon: kind === 'error' ? <CloseCircleOutlined /> : <CheckCircleOutlined />,
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
  }
}
