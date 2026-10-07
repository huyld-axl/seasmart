import { ROLE_LABELS } from '../../../constants/roles'

// Vai trò không phải trạng thái: một tông trung tính cho mọi vai (M7), chữ nói vai gì.
export default function RoleBadge({ role }) {
  return <span className="ds-role">{ROLE_LABELS[role] || role}</span>
}
