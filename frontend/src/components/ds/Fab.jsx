import { PlusOutlined } from '@ant-design/icons'
import useViewport from '../../hooks/useViewport'
import './ds.css'

// Nút nổi góc phải dưới cho "Thêm …" của trang danh sách, chỉ ở điện thoại (< 640px; kế hoạch responsive mục 4.3).
// Desktop không render: trang vẫn có nút trong thanh công cụ. `label` là tên nút cho trình đọc màn hình và tooltip.
// `inline`: đứng tại chỗ, luôn hiện (chỉ để minh hoạ ở /design-system).
export default function Fab({ label, icon = <PlusOutlined />, onClick, inline = false }) {
  const { isPhone } = useViewport()
  if (!isPhone && !inline) return null
  return (
    <button type="button" className={inline ? 'ds-fab ds-fab--inline' : 'ds-fab'} aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  )
}
