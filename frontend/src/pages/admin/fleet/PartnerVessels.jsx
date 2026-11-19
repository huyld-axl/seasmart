import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { InfoList } from '../../../components/ds/InfoTable'
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
    {isPending ? <Skeleton active /> : isError ? <Alert type="error" message="Không tải được danh sách tàu" action={<Button onClick={() => refetch()}>Thử lại</Button>} /> : !rows.length ? <div className="ds-ctable pv-empty">Chưa có tàu sở hữu.</div> : <InfoList items={rows.map((vessel) => ({
      id: vessel.id,
      title: <Link to={`/vessels/${vessel.id}`}>{vessel.vessel_name}</Link>,
      fields: [
        ['Tên tàu', <Link to={`/vessels/${vessel.id}`}>{vessel.vessel_name}</Link>],
        ['Loại tàu', vessel.vessel_type_name],
        ['IMO', vessel.imo_number],
        ['Cờ tàu', vessel.flag_name ? withFlag(vessel.flag_code, vessel.flag_name, vessel.flag_emoji) : null],
        ['Sở hữu từ ngày', date(vessel.started_at)],
        ['Đến ngày', vessel.is_current ? 'Đang sở hữu' : date(vessel.ended_at)],
        ['Chủ hiện tại', vessel.is_current ? null : vessel.current_owner_name],
        ['Trạng thái', <span className="pv-badges"><StatusBadge group="vessel" value={vessel.status} /><StatusBadge group="ownership" value={vessel.is_current ? 'CURRENT' : 'ENDED'} /></span>],
      ],
    }))} />}

  </section>
}
