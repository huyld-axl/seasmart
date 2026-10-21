import useAuthStore from '../stores/authStore'
import { canOf } from './usePermission'

// Việc người đăng nhập được làm với từng tài khoản (khớp các chặn ở backend, mục 1.5): chỉ Quản trị viên đụng tới
// tài khoản Quản trị viên; không ai tự khoá hay tự xoá chính mình.
export default function useAccountRights() {
  const me = useAuthStore((state) => state.user)
  const iAmAdmin = Boolean(me?.role?.is_system)
  const canUpdate = canOf(me, 'account.update')
  const canDelete = canOf(me, 'account.delete')
  const touchable = (user) => !user.is_admin || iAmAdmin
  const isSelf = (user) => user.id === me?.id
  return {
    canCreate: canUpdate,
    canEdit: (user) => canUpdate && touchable(user),
    canToggle: (user) => canUpdate && touchable(user) && !isSelf(user),
    canRemove: (user) => canDelete && touchable(user) && !isSelf(user),
  }
}
