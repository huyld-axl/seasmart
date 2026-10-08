import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../../api/client'
import { EmptyState } from '../../../components/ds/Controls'
import { FIELD_LABELS } from './fieldLabels'

const show = (value) => (value === null || value === undefined || value === '' ? 'trống' : String(value))

// Tab Lịch sử của hồ sơ: mỗi lần sửa có lý do, ai sửa, trường nào đổi từ gì sang gì.
export default function ProfileHistory({ seafarerId }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['revisions', seafarerId],
    queryFn: () => api.get(`/seafarers/${seafarerId}/revisions`).then((r) => r.data),
  })
  if (isLoading) return <div className="crew-panel crew-panel__body"><Skeleton active /></div>
  if (isError) return <EmptyState isError title="Không tải được lịch sử" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  if (!data.length) return <EmptyState title="Chưa có lần sửa nào" description="Mỗi lần sửa hồ sơ sẽ ghi lại ở đây, kèm lý do." />
  return (
    <section className="crew-panel">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử chỉnh sửa</h2></div>
      <ol className="ds-timeline crew-panel__body">
        {data.map((rev) => (
          <li key={rev.id} className="ds-timeline__item">
            <span className="ds-timeline__line" aria-hidden />
            <span className="ds-timeline__icon ds-timeline__icon--neutral"><EditOutlined /></span>
            <div className="ds-timeline__body">
              <p className="ds-timeline__title">{rev.reason}</p>
              <p className="ds-timeline__meta">{rev.changed_by_email || 'Không rõ người sửa'} · {dayjs(rev.created_at).format('HH:mm DD/MM/YYYY')}</p>
              <ul className="rev-changes">
                {Object.entries(rev.changes).map(([field, [from, to]]) => (
                  <li key={field}><b>{FIELD_LABELS[field] || field}</b>: {show(from)} → {show(to)}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
