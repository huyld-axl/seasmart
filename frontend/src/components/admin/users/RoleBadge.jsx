import { Tag } from 'antd'

const ROLE_CONFIG = {
  admin: { color: 'red', label: 'Admin' },
  operator: { color: 'blue', label: 'Chuyên viên' },
  accountant: { color: 'orange', label: 'Kế toán' },
  seafarer: { color: 'default', label: 'Thuyền viên' },
}

export default function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || { color: 'default', label: role }
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}
