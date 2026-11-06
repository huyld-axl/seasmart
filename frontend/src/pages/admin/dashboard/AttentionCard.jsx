import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Skeleton } from 'antd'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import DueTag from '../../../components/ds/DueTag'
import useViewport from '../../../hooks/useViewport'
import { attentionTabs, defaultTab } from './attentionRows'

const MOBILE_ROWS = 5
const EMPTY = {
  opportunities: ['Không có cơ hội nào sắp đến hạn chốt', 'Cơ hội có hạn chốt trong 7 ngày tới sẽ hiện ở đây.'],
  certificates: ['Không có chứng chỉ nào cần chú ý', 'Chứng chỉ quá hạn hoặc hết hạn trong 60 ngày tới sẽ hiện ở đây.'],
  schedule: ['Không có lịch xuống / rời tàu', 'Thuyền viên xuống tàu hoặc rời tàu trong 30 ngày tới sẽ hiện ở đây.'],
  work: ['Không có việc nào đang chờ', 'Hợp đồng và yêu cầu thanh toán cần bấm sẽ hiện ở đây.'],
}

// Số dòng lọt chiều cao còn lại của danh sách (desktop). Dòng cao như nhau nên đo dòng đầu.
// ResizeObserver gọi callback ngay khi bắt đầu theo dõi, nên không cần đo tay lần đầu.
function useFitCount(ref, hasRows, enabled) {
  const [capacity, setCapacity] = useState(null)
  useLayoutEffect(() => {
    const box = ref.current
    if (!enabled || !hasRows || !box) return undefined
    const observer = new ResizeObserver(() => {
      const row = box.querySelector('li')
      if (row) setCapacity(Math.max(1, Math.floor(box.clientHeight / row.offsetHeight)))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [ref, hasRows, enabled])
  return enabled ? (capacity ?? Infinity) : MOBILE_ROWS
}

// Khối Cần chú ý: tab theo loại cảnh báo, quá hạn trước, đỏ chỉ cho quá hạn.
export default function AttentionCard({ query, own }) {
  const navigate = useNavigate()
  const fill = useViewport().isWide
  const listRef = useRef(null)
  const [picked, setPicked] = useState(null)
  const tabs = query.data ? attentionTabs(query.data.tabs, own) : []
  const current = tabs.find((t) => t.key === picked) || tabs.find((t) => t.key === defaultTab(tabs))
  const rows = current?.rows || []
  const fit = useFitCount(listRef, rows.length > 0, fill && !query.isLoading)
  const shown = rows.slice(0, fit)
  const hidden = rows.length - shown.length

  let body
  if (query.isLoading) body = <div className="dash-att__pad"><Skeleton active title={false} paragraph={{ rows: 4 }} /></div>
  else if (query.isError) body = <EmptyState isError title="Không tải được việc cần chú ý" description="Mất kết nối tới máy chủ." action={<Button onClick={() => query.refetch()}>Thử lại</Button>} />
  else if (!current) body = null
  else if (current.error) body = <EmptyState isError title={`Không tải được ${current.label.toLowerCase()}`} action={<Button onClick={() => query.refetch()}>Thử lại</Button>} />
  else if (!rows.length) body = <EmptyState title={EMPTY[current.key][0]} description={EMPTY[current.key][1]} />
  else {
    body = (
      <ul className="dash-list" ref={listRef}>
        {shown.map((r) => (
          <li key={r.key}>
            <button type="button" className="dash-row" onClick={() => navigate(r.to)}>
              <span className="dash-row__text">
                <span className="dash-row__main">{r.main}</span>
                <span className="dash-row__sub">{r.sub}</span>
              </span>
              <DueTag days={r.days} late={r.late} text={r.text} />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="ds-card dash-att">
      <div className="dash-att__head">
        <h2 className="dash-att__title">Cần chú ý</h2>
        {tabs.length ? (
          <StatusTabs
            mobileLabel="Mục:"
            value={current?.key}
            onChange={setPicked}
            tabs={tabs.map((t) => ({ value: t.key, label: t.label, count: t.error ? null : t.count, dot: t.late > 0 ? `${t.late} quá hạn` : false }))}
          />
        ) : null}
        {current && !current.error && rows.length ? (
          <Link className="dash-att__more" to={current.link}>{current.linkLabel} →{hidden > 0 ? <span> · còn {hidden} ẩn</span> : null}</Link>
        ) : null}
      </div>
      {body}
    </section>
  )
}
