import { Card, Row, Col, Statistic } from 'antd'
import {
  TeamOutlined,
  BankOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

const stats = [
  { title: 'Thuyền viên', value: 0, icon: <TeamOutlined />, color: 'var(--primary)' },
  { title: 'Trung tâm đào tạo', value: 0, icon: <BankOutlined />, color: 'var(--success)' },
  { title: 'Khóa học', value: 0, icon: <BookOutlined />, color: 'var(--warning)' },
  {
    title: 'Chứng chỉ sắp hết hạn',
    value: 0,
    icon: <SafetyCertificateOutlined />,
    color: 'var(--danger)',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Tổng quan</h2>
      <Row gutter={16}>
        {stats.map((s) => (
          <Col span={6} key={s.title}>
            <Card style={{ borderRadius: 2, border: '1px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: `color-mix(in srgb, ${s.color} 9%, transparent)`,
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
