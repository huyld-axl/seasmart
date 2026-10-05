import { Result } from 'antd'
import { useParams } from 'react-router-dom'

export default function QREnrollPage() {
  const { token } = useParams()
  return (
    <div style={{ maxWidth: 680, margin: '80px auto', padding: '0 16px' }}>
      <Result
        status="warning"
        title="Tính năng đăng ký khóa học đã bị tắt"
        subTitle={`Mã link: ${token || '-'}. Hiện hệ thống chỉ hỗ trợ CRUD chứng chỉ thuyền viên.`}
      />
    </div>
  )
}
