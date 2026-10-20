import { Button, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'

// Cột thao tác cuối dòng bảng danh sách: nút Xem và Sửa rõ ràng thay cho mũi tên.
// Bấm nút không kích hoạt onClick của dòng. `onEdit` bỏ trống thì không hiện nút Sửa (vd. hợp đồng đã duyệt).
// `onView` bỏ trống khi mục không có trang chi tiết (danh mục). `onDelete` (tuỳ chọn): nút Xoá màu đỏ ở cuối; trang tự hỏi xác nhận.
export default function RowActions({ name, onView, onEdit, onDelete }) {
  const stop = (fn) => (event) => {
    event.stopPropagation()
    fn()
  }
  return (
    <span className="ds-row-actions" onKeyDown={(event) => event.stopPropagation()}>
      {onView ? (
        <Tooltip title="Xem chi tiết">
          <Button size="small" icon={<EyeOutlined />} aria-label={`Xem ${name}`} onClick={stop(onView)} />
        </Tooltip>
      ) : null}
      {onEdit ? (
        <Tooltip title="Sửa">
          <Button size="small" icon={<EditOutlined />} aria-label={`Sửa ${name}`} onClick={stop(onEdit)} />
        </Tooltip>
      ) : (
        <span className="ds-row-actions__slot" aria-hidden />
      )}
      {onDelete ? (
        <Tooltip title="Xoá">
          <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Xoá ${name}`} onClick={stop(onDelete)} />
        </Tooltip>
      ) : null}
    </span>
  )
}

