import { timelineLayout } from './crewTimeline'
import { EmptyState } from './Controls'
import './ds.css'

// Biểu đồ thời gian theo hàng: mỗi hàng một chuyến (thẻ Đội ngũ trên trang tàu).
// rows: [{ id, title, subtitle, onClick, bars: [{ kind, start, end, label }] }]
// kind: onboard (đang trên tàu) · left (đã rời) · planned (dự kiến ban đầu, nét đứt) · moved (ngày rời đã dời) · opening (cơ hội đang mở).
// Cột tên dính trái, phần biểu đồ cuộn ngang trong khung riêng. Mỗi hàng là một nút: Enter mở như bấm chuột.
export default function CrewTimeline({ from, to, today, rows = [], emptyText = 'Chưa có chuyến nào trong khoảng này' }) {
  if (!rows.length) return <EmptyState title={emptyText} />
  const layout = timelineLayout({ from, to, today, rows })
  const minWidth = Math.max(layout.months.length * 56, 480)
  return (
    <div className="ds-ct" role="list">
      <div className="ds-ct__names">
        <div className="ds-ct__corner">Chuyến</div>
        <div className="ds-ct__strip" />
        {layout.rows.map((row) => (
          <button key={row.id} type="button" role="listitem" className="ds-ct__name" onClick={row.onClick} disabled={!row.onClick}>
            <b>{row.title}</b>
            {row.subtitle ? <small>{row.subtitle}</small> : null}
          </button>
        ))}
      </div>
      <div className="ds-ct__scroll">
        <div className="ds-ct__chart" style={{ minWidth }}>
          <div className="ds-ct__months">
            {layout.months.map((m) => <span key={m.key} style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</span>)}
          </div>
          <div className="ds-ct__strip">
            {layout.todayLeft !== null ? <span style={{ left: `${layout.todayLeft}%` }}>Hôm nay {today.slice(8, 10)}/{today.slice(5, 7)}</span> : null}
          </div>
          <div className="ds-ct__grid" aria-hidden>
            {layout.months.map((m) => <span key={m.key} style={{ left: `${m.left}%` }} />)}
          </div>
          {layout.rows.map((row) => (
            <div key={row.id} className="ds-ct__row" onClick={row.onClick}>
              {row.bars.map((bar, index) => (
                <span
                  key={index}
                  className={`ds-ct__bar ds-ct__bar--${bar.kind}`}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                  title={bar.label}
                >
                  {bar.kind === 'planned' ? null : bar.label}
                </span>
              ))}
            </div>
          ))}
          {layout.todayLeft !== null ? (
            <div className="ds-ct__today" style={{ left: `${layout.todayLeft}%` }} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CrewTimelineLegend() {
  const items = [['onboard', 'Đang trên tàu'], ['left', 'Đã rời tàu'], ['opening', 'Cơ hội đang mở'], ['planned', 'Dự kiến ban đầu'], ['moved', 'Ngày rời đã dời']]
  return (
    <ul className="ds-ct-legend">
      {items.map(([kind, label]) => <li key={kind}><i className={`ds-ct__bar ds-ct__bar--${kind}`} />{label}</li>)}
    </ul>
  )
}
