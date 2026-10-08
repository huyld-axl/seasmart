import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { exportApi } from '../../../api/exportApi'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import { template } from '../exports/packModel'

// Tab Đã xuất của hồ sơ: các bộ giấy đã tạo cho người này.
export default function ProfileExports({ seafarerId, canCreate, blockedReason }) {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exports', { seafarer_id: seafarerId }],
    queryFn: () => exportApi.list({ seafarer_id: seafarerId, limit: 50 }),
  })
  const create = <Button type="primary" size="small" icon={<PlusOutlined />} disabled={!canCreate} title={blockedReason} onClick={() => navigate(`/exports/new?seafarer=${seafarerId}`)}>Tạo bộ giấy</Button>
  let body
  if (isLoading) body = <Skeleton active />
  else if (isError) body = <EmptyState isError title="Không tải được bộ giấy" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  else if (!data.data.length) body = <EmptyState title="Chưa xuất bộ giấy nào" description="Tạo bộ giấy theo giai đoạn: tuyển dụng, lên tàu, rời tàu." />
  else {
    body = (
      <ul className="signers">
        {data.data.map((p) => (
          <li key={p.id}>
            <span className="ds-cell2" style={{ flex: '1 1 240px' }}>
              <span className="ds-cell2__main" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{p.docs.map((key) => template(key).name).join(', ')}</span>
              <span className="ds-cell2__sub">#{p.code} · {dayjs(p.created_at).format('DD/MM/YYYY')} · {p.created_by_email}</span>
            </span>
            <StatusBadge group="export" value={p.status} />
            <Button size="small" type="text" icon={<RightOutlined />} iconPosition="end" onClick={() => navigate(`/exports/${p.id}`)}>Mở</Button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <h2 className="crew-panel__title">Bộ giấy đã xuất</h2>
        {create}
      </div>
      <div className="crew-panel__body">{body}</div>
    </section>
  )
}
