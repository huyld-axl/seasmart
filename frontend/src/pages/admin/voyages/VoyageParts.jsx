import { ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { dueLabel } from './voyageView'
import './voyages.css'

// Nhãn cảnh báo trễ ngày: vàng "Còn N ngày", đỏ "Quá N ngày chưa bắt đầu". Không có cảnh báo thì không vẽ gì.
export function DueTag({ due }) {
  const label = dueLabel(due)
  if (!label) return null
  const Icon = label.tone === 'error' ? ExclamationCircleOutlined : ClockCircleOutlined
  return (
    <span className={`vy-due vy-due--${label.tone}`}>
      <Icon aria-hidden />
      {label.text}
    </span>
  )
}

// Thanh tiến độ nhỏ "4/7" của cột Vị trí.
export function FillBar({ done, total, caption = 'có hợp đồng' }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <span className="vy-fill">
      <span className="vy-fill__row">
        <span className="ds-progress ds-progress--thin vy-fill__bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Vị trí đã có hợp đồng">
          <span className="ds-progress__bar" style={{ width: `${percent}%` }} />
        </span>
        <span className="ds-num vy-fill__num">{done}/{total}</span>
      </span>
      <span className="ds-cell2__sub">{caption}</span>
    </span>
  )
}
