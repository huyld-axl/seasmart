import { Link } from 'react-router-dom'
import StatusBadge from '../../../components/ds/StatusBadge'

// Chuyến của hợp đồng / yêu cầu thanh toán cũ: link sang chuyến mới nếu đã chuyển, không thì mã chuyến cũ dạng chữ.
// Trang chuyến cũ không còn, link theo id chuyến cũ sẽ mở nhầm chuyến mới trùng id.
export default function TripLink({ trip, legacyCode, withStatus = false }) {
  if (trip) {
    return (
      <>
        <Link to={`/voyages/${trip.id}`}>{trip.code}</Link>
        {withStatus && trip.status ? <> <StatusBadge group="voyage" value={trip.status} /></> : null}
      </>
    )
  }
  return legacyCode ? <span>{legacyCode} <span className="vd-muted">· chuyến cũ</span></span> : <span className="vd-muted">—</span>
}
