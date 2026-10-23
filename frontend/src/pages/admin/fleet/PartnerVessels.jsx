import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { Grid as ReadGrid } from '../seafarers/ReadSections'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useCan } from '../../../hooks/usePermission'
import StatusBadge from '../../../components/ds/StatusBadge'
import { withFlag } from '../../../utils/flag'

const date = (value) => value ? dayjs(value).format('DD/MM/YYYY') : 'Chưa rõ'

export default function PartnerVessels({ owner }) {
  const can = useCan()
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['fleet', 'owner-vessels', owner.id], queryFn: () => shipOwnerApi.vessels(owner.id), enabled: can('vessel.view') })
  if (!can('vessel.view')) return <p className="crew-muted">Bạn chưa có quyền xem tàu.</p>
  const rows = data?.data || []
  return <section className="pv-section">
    {isPending ? <Skeleton active /> : isError ? <Alert type="error" message="Không tải được danh sách tàu" action={<Button onClick={() => refetch()}>Thử lại</Button>} /> : !rows.length ? <div className="ds-ctable pv-empty">Chưa có tàu sở hữu.</div> : <div className="sf-items">
      {rows.map((vessel) => <div className="sf-item" key={vessel.id}>
        <div className="sf-item__head">
          <h4 className="sf-item__title"><Link to={`/vessels/${vessel.id}`}>{vessel.vessel_name}</Link></h4>
          <StatusBadge group="vessel" value={vessel.status} />
          <StatusBadge group="ownership" value={vessel.is_current ? 'CURRENT' : 'ENDED'} />
        </div>
        <div className="sf-item__body">
          <ReadGrid fields={[
            ['Tên tàu', <Link to={`/vessels/${vessel.id}`}>{vessel.vessel_name}</Link>, 4],
            ['Loại tàu', vessel.vessel_type_name, 4],
            ['IMO', vessel.imo_number, 4],
            ['Cờ tàu', vessel.flag_name ? withFlag(vessel.flag_code, vessel.flag_name, vessel.flag_emoji) : null, 4],
            ['Sở hữu từ ngày', date(vessel.started_at), 4],
            ['Đến ngày', vessel.is_current ? 'Đang sở hữu' : date(vessel.ended_at), 4],
            ...(!vessel.is_current ? [['Chủ hiện tại', vessel.current_owner_name, 4]] : []),
          ]} />
        </div>
      </div>)}
    </div>}

  </section>
}
