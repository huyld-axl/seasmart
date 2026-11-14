import { useEffect } from 'react'
import { App } from 'antd'
import { bindToastHost, clearToasts, clearErrorToasts, clearStaleToasts } from './useToast'
import useViewport from '../../hooks/useViewport'

// Đặt một lần trong <AntApp> (App.jsx): cho toast dùng notification của antd, kể cả khi gọi ở ngoài component.
export default function ToastHost({ router }) {
  const { notification } = App.useApp()
  const { isPhone } = useViewport()
  useEffect(() => {
    bindToastHost(notification, isPhone ? 'bottom' : 'bottomRight')
  }, [notification, isPhone])
  // Xóa mọi toast cũ trước thao tác mới, kể cả mở menu mà không đổi đường dẫn.
  // Chạy capture để thông báo mới do chính thao tác này phát sinh vẫn được hiển thị.
  useEffect(() => {
    if (!isPhone) return
    const dismiss = (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest('.ds-toast, .ant-notification')) return
      if (target.closest('button, a, input, textarea, select, [role="button"], [role="tab"], [role="checkbox"], [role="combobox"]')) clearToasts()
    }
    document.addEventListener('click', dismiss, true)
    return () => document.removeEventListener('click', dismiss, true)
  }, [isPhone])
  // Đổi trang (đường dẫn khác) thì đóng toast cũ. Nằm ngoài RouterProvider nên nghe qua router.
  useEffect(() => {
    let last = router.state.location.pathname
    return router.subscribe((state) => {
      if (state.location.pathname === last) return
      last = state.location.pathname
      if (isPhone) clearErrorToasts()
      clearStaleToasts()
    })
  }, [router, isPhone])
  return null
}
