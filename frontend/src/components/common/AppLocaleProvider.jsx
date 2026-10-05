import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'

dayjs.locale('vi')

export default function AppLocaleProvider({ theme, children }) {
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      {children}
    </ConfigProvider>
  )
}
