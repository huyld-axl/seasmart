import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'

// Một báo cáo tháng. Chưa chọn tháng thì không gọi máy chủ.
export function useReport(key, month) {
  return useQuery({
    queryKey: ['reports', key, month],
    queryFn: () => reportApi.get(key, month),
    enabled: Boolean(month),
  })
}
