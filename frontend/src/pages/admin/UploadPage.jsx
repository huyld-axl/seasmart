import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { seafarerApi } from '../../api'
import CrewDropzone from './seafarers/CrewDropzone'
import './seafarers/SeafarerProfile.css'

// Màn "Tải giấy tờ lên" (T1), mở từ nút "Tải giấy tờ lên" ở hồ sơ thuyền viên.
export default function UploadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: seafarer, isLoading } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })
  const name = seafarer?.full_name || ''
  const firstName = name.trim().split(/\s+/).slice(-1)[0] || 'thuyền viên'

  return (
    <div className="ds-page crew-profile">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/seafarers">Thuyền viên</Link>
        <RightOutlined aria-hidden />
        {isLoading ? <span>…</span> : <Link to={`/seafarers/${id}`}>{name}</Link>}
        <RightOutlined aria-hidden />
        <span aria-current="page">Tải giấy tờ lên</span>
      </nav>

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">Tải giấy tờ lên</h1>
          {isLoading ? <Skeleton.Input active size="small" /> : <p className="crew-head__desc">Hồ sơ của {name}</p>}
        </div>
        <div className="crew-head__actions">
          <Button icon={<LeftOutlined />} onClick={() => navigate(`/seafarers/${id}`)}>Về hồ sơ</Button>
        </div>
      </div>

      <CrewDropzone seafarerId={id} firstName={firstName} onReview={() => navigate(`/seafarers/${id}/review`)} />
    </div>
  )
}
