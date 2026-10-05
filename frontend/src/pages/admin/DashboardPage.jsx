import { Card, Row, Col, Statistic } from 'antd'
import {
  TeamOutlined,
  BankOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

const stats = [
  { title: 'Thuyền viên', value: 0, icon: <TeamOutlined />, color: '#1677ff' },
  { title: 'Trung tâm đào tạo', value: 0, icon: <BankOutlined />, color: '#52c41a' },
  { title: 'Khóa học', value: 0, icon: <BookOutlined />, color: '#faad14' },
  {
    title: 'Chứng chỉ sắp hết hạn',
    value: 0,
    icon: <SafetyCertificateOutlined />,
    color: '#ff4d4f',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Tổng quan</h2>
      <Row gutter={16}>
        {stats.map((s) => (
          <Col span={6} key={s.title}>
            <Card style={{ borderRadius: 2, border: '1px solid #D9D9D9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: `${s.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    color: s.color,
                  }}
                >
                  {s.icon}
                </div>
                <Statistic
                  title={s.title}
                  value={s.value}
                  valueStyle={{ fontSize: 28, fontWeight: 700 }}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
