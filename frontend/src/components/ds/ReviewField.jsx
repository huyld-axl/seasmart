import { Button } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
import StatusBadge from './StatusBadge'
import './ds.css'

// Ô trường dữ liệu ở màn duyệt (FR-REV). Chưa có mẫu đã duyệt trong skill: mượn khuôn ô nhập
// (components/input.md) cho khung và inline-edit.md cho chuyển xem ↔ sửa.
// Logic (chấp nhận, sửa, từ chối, nhảy trang) để handler rỗng cho người dùng nối.
export default function ReviewField({
  label,
  value,
  state = 'PROPOSED',
  page,
  isCritical = false,
  reason,
  vesselStatus,
  isActive = false,
  onAccept,
  onEdit,
  onReject,
  onJumpToPage,
}) {
  const isUnknown = state === 'UNKNOWN' || state === 'UNKNOWN_KEPT'
  const isDecided = state !== 'PROPOSED' && state !== 'UNKNOWN' && state !== 'DATE_AMBIGUOUS'

  return (
    <div className={`ds-field${isActive ? ' ds-field--active' : ''}`}>
      <div className="ds-field__head">
        <span className="ds-field__label">
          {label}
          {isCritical ? <span className="ds-field__required" aria-label="trường trọng yếu">*</span> : null}
        </span>
        {page ? (
          <button type="button" className="ds-chip-page" onClick={onJumpToPage}>
            <FileTextOutlined aria-hidden />
            Trang {page}
          </button>
        ) : null}
      </div>

      <p className={`ds-field__value${isUnknown ? ' ds-field__value--unknown' : ''}`}>
        {isUnknown ? 'Không đọc được trên tài liệu' : value}
      </p>

      <div className="ds-field__foot">
        <span className="ds-field__badges">
          <StatusBadge group="field" value={state} />
          {vesselStatus ? <StatusBadge group="vessel" value={vesselStatus} /> : null}
        </span>
        {isDecided ? null : (
          <span className="ds-field__actions">
            <Button size="small" type="text" icon={<CheckOutlined />} onClick={onAccept}>
              {state === 'UNKNOWN' ? 'Giữ UNKNOWN' : 'Chấp nhận'}
            </Button>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit}>
              Sửa
            </Button>
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={onReject}>
              Từ chối
            </Button>
          </span>
        )}
      </div>

      {reason ? <p className="ds-field__reason">Lý do: {reason}</p> : null}
    </div>
  )
}
