import { Link, useNavigate } from 'react-router-dom'
import { Button, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import VoyageTimeline from '../../../components/ds/VoyageTimeline.jsx'
import { useCan } from '../../../hooks/usePermission'
import { useVoyageList } from '../../../hooks/useVoyages'
import { voyageTrips } from './seaServiceView'

// Tab "Đi tàu": các chuyến tàu của thuyền viên, mới nhất trước, dạng dòng thời gian dọc.
// Mở chuyến để xem nhật ký của chuyến.
export default function ProfileSeaService({ seafarerId }) {
  const navigate = useNavigate()
  const can = useCan()
  const voyages = useVoyageList({ seafarer_id: seafarerId, tab: 'all', limit: 100 }, { enabled: can('voyage.view') })
  const trips = voyageTrips(voyages.data?.data || [])
  const create = can('voyage.create')
    ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/voyages/new?seafarer=${seafarerId}`)}>Tạo chuyến</Button>
    : null

  const items = trips.map((t) => ({
    id: t.id,
    start: String(t.raw.join_date).slice(0, 10),
    end: t.raw.leave_date ? String(t.raw.leave_date).slice(0, 10) : null,
    vessel: can('vessel.view') && t.raw.vessel_id ? <Link to={`/vessels/${t.raw.vessel_id}`}>{t.vessel}</Link> : t.vessel,
    owner: t.vesselSub,
    rank: t.rank,
    code: t.source.label,
    action: <Link className="ds-link" to={`/voyages/${t.raw.id}`}>Mở chuyến</Link>,
  }))

  const empty = (
    <EmptyState
      title="Chưa có chuyến tàu nào"
      description="Chuyến sinh ra khi chốt người trên cơ hội, hoặc tạo tay khi không qua tuyển."
      action={create}
    />
  )

  return (
    <section className="ct-block crew-docs-sec" aria-label="Đi tàu">
      {trips.length ? <div className="ds-toolbar crew-docs-toolbar"><span /><span className="crew-docs-toolbar__acts">{create}</span></div> : null}
      {voyages.isLoading ? (
        <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : voyages.isError ? (
        <EmptyState isError title="Không tải được các chuyến tàu" description="Mất kết nối với máy chủ." action={<Button onClick={() => voyages.refetch()}>Thử lại</Button>} />
      ) : (
        <VoyageTimeline items={items} today={new Date().toISOString().slice(0, 10)} empty={empty} />
      )}
    </section>
  )
}
