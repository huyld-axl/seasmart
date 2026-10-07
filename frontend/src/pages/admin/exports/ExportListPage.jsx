import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { EmptyState } from '../../../components/ds/Controls'

// Bản xuất (C1): danh sách bộ giấy đã tạo. Chưa có API, tạm để trạng thái rỗng.
export default function ExportListPage() {
  const navigate = useNavigate()
  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Bản xuất</h1>
          <p className="ds-page__desc">Các bộ giấy đã tạo cho thuyền viên, kèm trạng thái duyệt và ký.</p>
        </div>
      </div>
      <div className="ds-card">
        <EmptyState
          title="Chưa có bộ giấy nào"
          description="Bộ giấy được tạo từ hồ sơ một thuyền viên."
          action={<Button onClick={() => navigate('/seafarers')}>Mở danh sách thuyền viên</Button>}
        />
      </div>
    </div>
  )
}
