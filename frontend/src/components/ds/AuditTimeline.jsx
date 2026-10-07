import { CheckOutlined, EditOutlined, FileAddOutlined, SendOutlined } from '@ant-design/icons'
import './ds.css'

const KIND_ICONS = { edit: EditOutlined, accept: CheckOutlined, upload: FileAddOutlined, export: SendOutlined }

// Dòng thời gian audit (components/timeline.md): mới nhất ở trên, mỗi việc một icon trong vòng tròn.
// item: { id, kind, tone, title, time, detail, before, after, reason, source, actor }
export default function AuditTimeline({ items }) {
  return (
    <ol className="ds-timeline">
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind] || EditOutlined
        return (
          <li key={item.id} className="ds-timeline__item">
            <span className="ds-timeline__line" aria-hidden />
            <span className={`ds-timeline__icon ds-timeline__icon--${item.tone || 'neutral'}`}>
              <Icon aria-hidden />
            </span>
            <div className="ds-timeline__body">
              <div className="ds-timeline__head">
                <p className="ds-timeline__title">{item.title}</p>
                <time className="ds-timeline__time">{item.time}</time>
              </div>
              {item.before || item.after ? (
                <p className="ds-timeline__change">
                  <span className="ds-timeline__before">{item.before || 'trống'}</span>
                  <span aria-hidden> → </span>
                  <span className="ds-timeline__after">{item.after}</span>
                </p>
              ) : null}
              {item.reason ? <p className="ds-timeline__detail">Lý do: {item.reason}</p> : null}
              <p className="ds-timeline__meta">{[item.actor, item.source].filter(Boolean).join(' · ')}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
