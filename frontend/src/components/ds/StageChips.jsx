import { Tooltip } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import './ds.css'

// Chặng nhỏ trong một dòng bảng: vài mũi tên nối liền, cùng ngôn ngữ với StageTrack.
// steps: [{ key, label, state, hint, onClick, disabled }]
//   state: done (xong, xanh lá, có tích) · next (việc kế tiếp, xanh navy nhạt) · todo (chưa tới, xám) · complete (xong cả chuỗi, navy đặc).
//   onClick có thì chặng là nút (bấm không kích hoạt onClick của dòng); disabled làm mờ và khoá.
// `note`: dòng chữ nhỏ bên dưới (ngày của từng chặng).
export default function StageChips({ steps, note, label = 'Tiến trình' }) {
  return (
    <span className="ds-chips-stage">
      <span className="ds-chips-stage__list" role="group" aria-label={label}>
        {steps.map((step) => {
          const className = `ds-chips-stage__step ds-chips-stage__step--${step.state}`
          const body = <>{step.state === 'done' || step.state === 'complete' ? <CheckOutlined aria-hidden /> : null}{step.label}</>
          if (!step.onClick) return <span key={step.key} className={className}>{body}</span>
          return (
            <Tooltip key={step.key} title={step.hint}>
              <button type="button" className={className} disabled={step.disabled} onClick={(e) => { e.stopPropagation(); step.onClick() }}>{body}</button>
            </Tooltip>
          )
        })}
      </span>
      {note ? <span className="ds-chips-stage__note">{note}</span> : null}
    </span>
  )
}
