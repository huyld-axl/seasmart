import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import HeadActions from '../../components/ds/HeadActions'
import { LeftOutlined } from '@ant-design/icons'
import { Crumb } from './fleet/FleetParts'
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
      <Crumb back={false} items={[{ label: 'Thuyền viên', to: '/seafarers' }, isLoading ? { label: '…' } : { label: name, to: `/seafarers/${id}` }, { label: 'Tải giấy tờ lên' }]} />

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">Tải giấy tờ lên</h1>
          {isLoading ? <Skeleton.Input active size="small" /> : <p className="crew-head__desc">Hồ sơ của {name}</p>}
        </div>
        <HeadActions>
          <Button icon={<LeftOutlined />} onClick={() => navigate(`/seafarers/${id}`)}>Về hồ sơ</Button>
        </HeadActions>
      </div>

      <CrewDropzone seafarerId={id} firstName={firstName} onReview={() => navigate(`/seafarers/${id}/review`)} />
    </div>
  )
}
