import { timelineRows, durationText, totalDays, ashoreNow } from './voyageTimeline.js'
import { EmptyState } from './Controls'
import './ds.css'

const fmt = (iso) => iso.split('-').reverse().join('/')

// Dòng thời gian dọc các chuyến của một thuyền viên, mới nhất trước (tab Đi tàu).
// items: [{ id, start, end|null, vessel (node), owner, rank, code, action (node) }]; today = YYYY-MM-DD.
// Mỗi chuyến một thẻ cùng kiểu ô bảng danh sách chuyến (tên đậm, dòng phụ nhạt, mã dạng mono); năm hiện ở mép trái,
// khoảng ở bờ giữa hai chuyến hiện bằng nét đứt. Chuyến đang đi có chấm xanh.
export default function VoyageTimeline({ items = [], today, empty = null }) {
  if (!items.length) return empty || <EmptyState title="Chưa có chuyến tàu nào" />
  const rows = timelineRows(items, today)
  const total = totalDays(rows)
  const ashore = ashoreNow(rows, today)
  const gap = (key, from, to, days, now) => (
    <li key={key} className="ds-vt__ashore" data-now={!!now}>
      <span className="ds-vt__ashore-dot" aria-hidden />
      <div className="ds-vt__ashore-box">
        <b>{now ? 'Đang ở bờ' : 'Ở bờ'} {durationText(days)}</b>
        <span>{fmt(from)} → {to ? fmt(to) : 'nay'}</span>
      </div>
    </li>
  )
  return (
    <div className="ds-vt">
      <p className="ds-vt__sum">
        <b>{rows.length}</b> chuyến · <b>{durationText(total)}</b> trên tàu · chuyến đầu {fmt(rows[rows.length - 1].start)}
      </p>
      <ol className="ds-vt__list">
        {ashore ? gap('now', ashore.from, null, ashore.days, true) : null}
        {rows.map((row, index) => [
          row.ashoreDays ? gap(`g${row.id}`, row.ashoreFrom, row.ashoreTo, row.ashoreDays) : null,
          <li key={row.id} className="ds-vt__item" data-now={row.ongoing}>
            {index === 0 || rows[index - 1].year !== row.year ? <span className="ds-vt__year">{row.year}</span> : null}
            <span className="ds-vt__dot" aria-hidden />
            <div className="ds-vt__card">
              <div className="ds-vt__top">
                <b>{row.vessel}</b>
                {row.ongoing ? <span className="ds-vt__live">Đang trên tàu</span> : null}
              </div>
              <span className="ds-vt__sub">{[row.rank, row.owner].filter(Boolean).join(' · ') || '—'}</span>
              <div className="ds-vt__meta">
                <span className="ds-vt__dates">{fmt(row.start)} → {row.ongoing ? 'nay' : fmt(row.end)}</span>
                <span>{durationText(row.days)}</span>
              </div>
              <div className="ds-vt__foot">
                {row.code ? <span className="ds-vt__code">{row.code}</span> : null}
                {row.action}
              </div>
            </div>
          </li>,
        ])}
      </ol>
    </div>
  )
}
