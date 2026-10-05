import { Tag } from 'antd'

const ROLE_CONFIG = {
  admin: { color: 'red', label: 'Admin' },
  operator: { color: 'blue', label: 'Operator' },
  training_center: { color: 'green', label: 'Training Center' },
  manning_agent: { color: 'orange', label: 'Manning Agent' },
  seafarer: { color: 'cyan', label: 'Seafarer' },
}

export default function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || { color: 'default', label: role }
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}
