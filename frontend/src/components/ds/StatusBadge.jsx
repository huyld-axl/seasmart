import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EllipsisOutlined,
  LockOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  SwapOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { STATUS } from './statusMap'
import './ds.css'

const MARK_ICONS = {
  check: CheckCircleOutlined,
  cross: CloseCircleOutlined,
  clock: ClockCircleOutlined,
  ellipsis: EllipsisOutlined,
  edit: EditOutlined,
  question: QuestionCircleOutlined,
  lock: LockOutlined,
  calendar: CalendarOutlined,
  minus: MinusCircleOutlined,
  overlap: SwapOutlined,
  refresh: SyncOutlined,
}

// Badge trạng thái (M7): pill nền nhạt, dấu đầu + chữ cùng tông. Một hình cho mọi bề mặt (D2).
export default function StatusBadge({ group, value, title }) {
  const status = STATUS[group]?.[value]
  if (!status) return null

  const Icon = MARK_ICONS[status.mark]
  return (
    <span className={`ds-badge ds-badge--${status.tone}`} title={title}>
      {Icon ? (
        <Icon className="ds-badge__icon" aria-hidden />
      ) : (
        <span className={`ds-badge__dot ds-badge__dot--${status.mark}`} aria-hidden />
      )}
      {status.label}
    </span>
  )
}
