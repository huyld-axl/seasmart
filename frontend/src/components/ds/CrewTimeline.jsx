import { useState } from 'react'
import { Tooltip } from 'antd'
import { timelineLayout } from './crewTimeline.js'
import { EmptyState } from './Controls'
import './ds.css'

// Biểu đồ thời gian theo hàng: mỗi hàng một chuyến (thẻ Đội ngũ trên trang tàu).
// rows: [{ id, title, subtitle, warn?, onClick, bars: [{ kind, start, end, label, tip? }] }]
// tip: nội dung đầy đủ khi rê chuột (nhiều dòng); nhãn trên thanh bị cắt khi thanh hẹp. warn: hàng quá hạn (tên hàng đổi màu cảnh báo).
// kind: onboard (đang trên tàu) · left (đã rời) · planned (dự kiến ban đầu, nét đứt) · moved (ngày rời đã dời) · opening (cơ hội đang mở).
// Cột tên đứng yên bên trái (nằm ngoài khung cuộn), chỉ phần biểu đồ cuộn ngang. Mở chuyến: bấm vào cột tên hoặc vào thanh (Enter khi thanh đang được chọn); bấm khoảng trống không làm gì.
// Rê chuột vào tên hoặc vào hàng: cả hai bên cùng sáng lên để biết đang trỏ vào chuyến nào.
// Thanh hẹp hơn nhãn thì giãn ra vừa đủ chữ (min-width theo nội dung) thay vì cắt chữ; thanh dự kiến nét đứt không giãn.
// keepWhenEmpty: không có hàng vẫn vẽ trục và ghi `emptyText` trong biểu đồ (để còn bấm mũi tên quay lại).
export default function CrewTimeline({ from, to, today, rows = [], cornerLabel = 'Thuyền viên · chuyến', keepWhenEmpty = false, emptyText = 'Chưa có chuyến nào trong khoảng này' }) {
  const [hover, setHover] = useState(null)
  if (!rows.length && !keepWhenEmpty) return <EmptyState title={emptyText} />
  const layout = timelineLayout({ from, to, today, rows })
  const minWidth = Math.max(layout.months.length * 56, 480, layout.ticks.length ? layout.days * 30 : 0)
  return (
    <div className={layout.ticks.length ? 'ds-ct ds-ct--days' : 'ds-ct'} role="list">
      <div className="ds-ct__names">
        <div className="ds-ct__corner">{cornerLabel}</div>
        {layout.ticks.length ? <div className="ds-ct__days" /> : null}
        <div className="ds-ct__strip" />
        {layout.rows.map((row) => (
          <button key={row.id} type="button" role="listitem" className={`ds-ct__name${row.warn ? ' ds-ct__name--warn' : ''}${hover === row.id ? ' is-hover' : ''}`} onMouseEnter={() => setHover(row.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(row.id)} onBlur={() => setHover(null)} onClick={row.onClick} disabled={!row.onClick}>
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
          {layout.ticks.length ? (
            <div className="ds-ct__days" aria-hidden>
              {layout.ticks.map((t) => (
                <span key={t.key} className={[t.weekend && 'is-weekend', t.today && 'is-today', t.major && 'is-major', t.monthStart && 'is-month'].filter(Boolean).join(' ') || undefined} style={{ left: `${t.left}%`, width: `${t.width}%` }}>
                  <small>{t.dow}</small>
                  <b>{t.label}</b>
                </span>
              ))}
            </div>
          ) : null}
          <div className="ds-ct__strip">
            {layout.todayLeft !== null ? <span style={{ left: `${layout.todayLeft}%` }}>Hôm nay {today.slice(8, 10)}/{today.slice(5, 7)}</span> : null}
          </div>
          <div className="ds-ct__grid" aria-hidden>
            {layout.ticks.length
              ? layout.ticks.map((t) => <span key={t.key} className={[t.weekend && 'is-weekend', t.today && 'is-today', t.major && 'is-major', t.monthStart && 'is-month'].filter(Boolean).join(' ') || undefined} style={{ left: `${t.left}%`, width: `${t.width}%` }} />)
              : layout.months.map((m) => <span key={m.key} style={{ left: `${m.left}%` }} />)}
          </div>
          {layout.rows.map((row) => (
            <div key={row.id} className={hover === row.id ? 'ds-ct__row is-hover' : 'ds-ct__row'} onMouseEnter={() => setHover(row.id)} onMouseLeave={() => setHover(null)}>
              {row.bars.map((bar, index) => (
                <Tooltip key={index} title={bar.tip || bar.label} styles={{ root: { whiteSpace: 'pre-line' } }}>
                  <span
                    className={`ds-ct__bar ds-ct__bar--${bar.kind}${row.onClick ? ' is-link' : ''}`}
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                    role={row.onClick ? 'button' : undefined}
                    tabIndex={row.onClick ? 0 : undefined}
                    onClick={row.onClick}
                    onKeyDown={(e) => { if (e.key === 'Enter' && row.onClick) row.onClick() }}
                  >
                    {bar.label}
                  </span>
                </Tooltip>
              ))}
            </div>
          ))}
          {!rows.length ? <div className="ds-ct__empty">{emptyText}</div> : null}
          {layout.todayLeft !== null ? (
            <div className="ds-ct__today" style={{ left: `${layout.todayLeft}%` }} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CrewTimelineLegend() {
  const items = [['onboard', 'Đang trên tàu'], ['left', 'Đã rời tàu'], ['opening', 'Cơ hội đang mở'], ['planned', 'Dự kiến rời ban đầu (nét đứt, ghi ngày)'], ['moved', 'Ngày rời đã dời'], ['overdue', 'Quá hạn, chưa cập nhật']]
  return (
    <ul className="ds-ct-legend">
      {items.map(([kind, label]) => <li key={kind}><i className={`ds-ct__bar ds-ct__bar--${kind}`} />{label}</li>)}
    </ul>
  )
}
