import { Navigate } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import { canOf } from '../../hooks/usePermission'

// `perm`: một mã quyền hoặc mảng (cần đủ hết). Chưa có vai trò → /no-role; thiếu quyền → /403.
// `allowNoRole`: chỉ để trang /no-role tự dùng.
export default function ProtectedRoute({ children, perm, allowNoRole = false }) {
  const { user, token, ready } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!ready) return null
  if (!allowNoRole && !user.role) return <Navigate to="/no-role" replace />
  if (perm && !canOf(user, ...[].concat(perm))) return <Navigate to="/403" replace />
  return children
}
