import { useParams, Navigate } from 'react-router-dom'
import { VesselTab, ShipOwnerTab } from './FleetTabs'

const TAB_MAP = {
  vessels: { component: VesselTab, title: 'Tàu', description: 'Danh sách tàu dùng khi đối chiếu sea service. IMO được kiểm số kiểm tra.' },
  'ship-owners': { component: ShipOwnerTab, title: 'Đối tác', description: 'Chủ tàu đối tác và người liên hệ của từng đơn vị.' },
}

export default function FleetPage() {
  const { tab } = useParams()
  const entry = TAB_MAP[tab]
  if (!entry) return <Navigate to="/fleet/vessels" replace />

  const Component = entry.component
  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">{entry.title}</h1>
          <p className="ds-page__desc">{entry.description}</p>
        </div>
      </div>
      <Component key={tab} />
    </div>
  )
}
