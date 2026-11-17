// Khung của trang design system ở khu nội bộ (design-system-main.jsx): cùng theme / antd App / react-query như App.jsx.
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp } from 'antd'
import viVN from 'antd/es/locale/vi_VN'
import { antTheme, antThemePhone } from './theme/tokens'
import useViewport from './hooks/useViewport'
import ToastHost from './components/ds/ToastHost'
import DesignSystemPage from './pages/DesignSystemPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const router = createBrowserRouter([{ path: '*', element: <DesignSystemPage /> }])

export default function DesignSystemApp() {
  const { isPhone } = useViewport()
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={isPhone ? antThemePhone : antTheme}>
        <AntApp notification={{ bottom: 96, maxCount: 3, stack: false }}>
          <ToastHost router={router} />
          <RouterProvider router={router} />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
