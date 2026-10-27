import { Button } from 'antd'
import { ArrowRightOutlined, CompassOutlined, DeleteOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
import StatusBadge from './StatusBadge'
import './ds.css'

// Chuyến đi tàu của thuyền viên (T5, tab Đi tàu), xếp trên một đường dọc, mới nhất trên cùng.
// trip: { id, vessel, vesselSub, signOn, signOff, ongoing, rank, rankName, overlapNote, vesselStatus,
//         source: { type: 'document' | 'manual' | 'voyage', label } }
// source.type 'voyage': chuyến của hệ thống (bảng chuyến), label là mã chuyến; bấm "Mở chuyến" gọi onOpenSource.
// Nút Sửa / Xoá chỉ hiện khi truyền `onEdit` / `onDelete` (theo quyền), và không hiện ở chuyến hệ thống (sửa trên trang chuyến).
// Chỉ chuyến chưa khớp danh mục hay trùng thời gian mới có nhãn; chuyến bình thường không nhãn thừa.
export default function SeaServiceTimeline({ trips = [], onEdit, onDelete, onOpenSource }) {
  return (
    <ol className="ds-trips">
      {trips.map((trip) => {
        const flags = []
        if (trip.ongoing) flags.push(<StatusBadge key="on" group="seaService" value="ONGOING" />)
        if (trip.vesselStatus && trip.vesselStatus !== 'VERIFIED') flags.push(<StatusBadge key="vs" group="vessel" value={trip.vesselStatus} />)
        return (
          <li key={trip.id} className="ds-trip" data-now={trip.ongoing ? 'true' : 'false'}>
            <div className="ds-trip__head">
              <b className="ds-trip__vessel">{trip.vessel}</b>
              {trip.overlapNote ? <StatusBadge group="seaService" value="OVERLAP" /> : null}
              {onEdit && trip.source?.type !== 'voyage' ? <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Sửa chuyến ${trip.vessel}`} onClick={() => onEdit(trip)} /> : null}
              {onDelete && trip.source?.type !== 'voyage' ? <Button type="text" size="small" icon={<DeleteOutlined />} aria-label={`Xoá chuyến ${trip.vessel}`} onClick={() => onDelete(trip)} /> : null}
            </div>
            {trip.vesselSub ? <p className="ds-trip__sub">{trip.vesselSub}</p> : null}
            <p className="ds-trip__dates">
              <span className={trip.signOn ? 'ds-trip__date' : 'ds-trip__none'}>{trip.signOn || 'chưa có ngày xuống'}</span>
              <ArrowRightOutlined aria-hidden />
              <span className={trip.signOff ? 'ds-trip__date' : 'ds-trip__none'}>{trip.signOff || (trip.ongoing ? 'đang trên tàu' : 'chưa có ngày')}</span>
            </p>
            <p className="ds-trip__sub">{trip.rankName ? `${trip.rank} (${trip.rankName})` : trip.rank}</p>
            {flags.length > 0 ? <div className="ds-trip__flags">{flags}</div> : null}
            {trip.overlapNote ? <p className="ds-trip__overlap">{trip.overlapNote}</p> : null}
            <p className="ds-trip__source">
              {trip.source?.type === 'voyage' ? (
                <>
                  <CompassOutlined aria-hidden />
                  Chuyến {trip.source.label} ·{' '}
                  <button type="button" className="ds-link" onClick={() => onOpenSource?.(trip)}>Mở chuyến</button>
                </>
              ) : trip.source?.type === 'document' ? (
                <>
                  <FileTextOutlined aria-hidden />
                  {trip.source.label} ·{' '}
                  <button type="button" className="ds-link" onClick={() => onOpenSource?.(trip)}>Xem bản gốc</button>
                </>
              ) : (
                <>
                  <EditOutlined aria-hidden />Nhập tay
                </>
              )}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
