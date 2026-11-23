import { useUserOptions } from './useUsers'
import useAuthStore from '../stores/authStore'

// Người phụ trách (docs/mcah-ke-hoach-nguoi-phu-trach.md): lựa chọn cho ô chọn người và bộ lọc danh sách.
const userLabel = (user) => user.full_name || user.email

// Lựa chọn cho ô chọn người. `current` ({ id, name }) là người đang phụ trách: đã khoá thì vẫn hiện để không mất tên.
export function usePicOptions(current) {
  const users = useUserOptions()
  const options = (users.data || []).map((user) => ({ value: user.id, label: userLabel(user), email: user.email }))
  if (current?.id && !options.some((o) => o.value === current.id)) options.unshift({ value: current.id, label: current.name || `#${current.id}` })
  return { options, loading: users.isLoading }
}

// Lựa chọn của bộ lọc "Người phụ trách": Tôi, Chưa giao, rồi từng người. Giá trị gửi API: id hoặc 'none'.
export function usePicFilterOptions() {
  const me = useAuthStore((state) => state.user)
  const users = useUserOptions()
  const others = (users.data || []).filter((user) => user.id !== me?.id).map((user) => ({ value: String(user.id), label: userLabel(user) }))
  return [
    ...(me ? [{ value: String(me.id), label: 'Tôi' }] : []),
    { value: 'none', label: 'Chưa giao' },
    ...others,
  ]
}
