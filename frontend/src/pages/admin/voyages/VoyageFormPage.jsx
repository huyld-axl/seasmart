import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../../components/ds/Controls'

// Tạm thời trong lúc dựng lại theo mô hình mỗi chuyến một thuyền viên (docs/mcah-ke-hoach-co-hoi-chuyen.md, Bước 16–18).
export default function VoyageFormPage() {
  const navigate = useNavigate()
  return (
    <EmptyState
      title="Màn chuyến tàu đang được dựng lại"
      description="Chuyến tàu giờ là mỗi chuyến một thuyền viên. Màn này sẽ có lại sau vài bước dựng."
      action={<Button onClick={() => navigate('/seafarers')}>Về danh sách thuyền viên</Button>}
    />
  )
}
