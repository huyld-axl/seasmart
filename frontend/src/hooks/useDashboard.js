import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api'

// Hai khối tải riêng: một khối lỗi thì khối kia vẫn hiện.
export function useKpi(month, options = {}) {
  return useQuery({ queryKey: ['dashboard', 'kpi', month || 'now'], queryFn: () => dashboardApi.kpi(month), ...options })
}

export function useAttention(options = {}) {
  return useQuery({ queryKey: ['dashboard', 'attention'], queryFn: dashboardApi.attention, ...options })
}
