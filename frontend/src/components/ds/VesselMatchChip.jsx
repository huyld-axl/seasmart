import { CheckCircleOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import './ds.css'

// Chip đối chiếu tàu nằm ngay cạnh ô Tên tàu (T2). status dùng khoá của statusMap.vessel:
// VERIFIED (khớp danh mục, chỉ để xem), NOT_FOUND (không thấy, bấm để đối chiếu), còn lại bấm để đối chiếu.
export default function VesselMatchChip({ status = 'NOT_CHECKED', title, disabled = false, onClick }) {
  if (status === 'VERIFIED') {
    return <span className="ds-vchip ds-vchip--ok" title={title}><CheckCircleOutlined aria-hidden />Khớp danh mục</span>
  }
  const notFound = status === 'NOT_FOUND'
  return (
    <button type="button" className={`ds-vchip${notFound ? ' ds-vchip--warn' : ''}`} disabled={disabled} onClick={onClick}>
      {notFound ? <QuestionCircleOutlined aria-hidden /> : <SearchOutlined aria-hidden />}
      {notFound ? 'Không thấy tàu · Đối chiếu' : 'Đối chiếu tàu'}
    </button>
  )
}
