import { useEffect } from 'react'
import { App, Grid } from 'antd'
import { bindToastHost, clearStaleToasts } from './useToast'

// Đặt một lần trong <AntApp> (App.jsx): cho toast dùng notification của antd, kể cả khi gọi ở ngoài component.
export default function ToastHost({ router }) {
  const { notification } = App.useApp()
  const screens = Grid.useBreakpoint()
  useEffect(() => {
    bindToastHost(notification, screens.sm === false ? 'bottom' : 'bottomRight')
  }, [notification, screens.sm])
  // Đổi trang (đường dẫn khác) thì đóng toast cũ. Nằm ngoài RouterProvider nên nghe qua router.
  useEffect(() => {
    let last = router.state.location.pathname
    return router.subscribe((state) => {
      if (state.location.pathname === last) return
      last = state.location.pathname
      clearStaleToasts()
    })
  }, [router])
  return null
}
