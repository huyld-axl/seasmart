import { useEffect } from 'react'
import { App, Grid } from 'antd'
import { bindToastHost } from './useToast'

// Đặt một lần trong <AntApp> (App.jsx): cho toast dùng notification của antd, kể cả khi gọi ở ngoài component.
export default function ToastHost() {
  const { notification } = App.useApp()
  const screens = Grid.useBreakpoint()
  useEffect(() => {
    bindToastHost(notification, screens.sm === false ? 'bottom' : 'bottomRight')
  }, [notification, screens.sm])
  return null
}
