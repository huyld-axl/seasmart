import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import {
  SafetyCertificateOutlined,
  AimOutlined,
  SolutionOutlined,
  GlobalOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'

const { Title } = Typography

const ITEMS = [
  {
    key: '/master-data/cert',
    label: 'Chứng chỉ',
    description: 'Loại chứng chỉ thuyền viên',
    icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#003366' }} />,
  },
  {
    key: '/master-data/rank',
    label: 'Chức danh',
    description: 'Rank / chức danh thuyền viên',
    icon: <SolutionOutlined style={{ fontSize: 28, color: '#003366' }} />,
  },
  {
    key: '/master-data/port',
    label: 'Cảng biển',
    description: 'Danh sách cảng biển',
    icon: <AimOutlined style={{ fontSize: 28, color: '#003366' }} />,
  },
  {
    key: '/master-data/country',
    label: 'Quốc gia',
    description: 'Danh sách quốc gia',
    icon: <GlobalOutlined style={{ fontSize: 28, color: '#003366' }} />,
  },
  {
    key: '/master-data/admin/form-templates',
    label: 'Biểu mẫu',
    description: 'Upload và quản lý file mẫu Excel',
    icon: <FileExcelOutlined style={{ fontSize: 28, color: '#217346' }} />,
  },
]

export default function MasterDataHubPage() {
  const navigate = useNavigate()

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Danh mục
      </Title>
      <Row gutter={[16, 16]}>
        {ITEMS.map((item) => (
          <Col key={item.key} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ borderRadius: 6, border: '1px solid #D9D9D9', height: '100%' }}
              styles={{ body: { padding: '20px 20px' } }}
              onClick={() => navigate(item.key)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ paddingTop: 2 }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#595959' }}>{item.description}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
