import { Card, Row, Col, Statistic } from 'antd'
import {
  TeamOutlined,
  BankOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  DollarCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { seafarerApi, salaryApi } from '../../api'

const fmtRevenue = (v) => {
  if (!v) return '0'
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} tỷ`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} tr`
  return new Intl.NumberFormat('vi-VN').format(Math.round(v))
}

export default function DashboardPage() {
  const currentMonth = dayjs().format('YYYY-MM')

  const { data: statsData } = useQuery({
    queryKey: ['seafarer-stats'],
    queryFn: () => seafarerApi.stats().then((r) => r.data),
  })

  const { data: salaryStats } = useQuery({
    queryKey: ['salary-stats', currentMonth],
    queryFn: () => salaryApi.stats(currentMonth).then((r) => r.data),
  })

  const totalSeafarers = statsData
    ? Object.entries(statsData)
        .filter(([k]) => k !== 'certificates_expiring_soon')
        .reduce((sum, [, v]) => sum + v, 0)
    : 0

  const totalPayroll = (salaryStats?.paid || 0) + (salaryStats?.unpaid || 0)
  const expectedRevenue = fmtRevenue(salaryStats?.total_gross_vnd || 0)

  const stats = [
    { title: 'Thuyền viên', value: totalSeafarers, icon: <TeamOutlined />, color: '#1677ff' },
    {
      title: 'Thuyền viên trả lương',
      value: totalPayroll,
      icon: <DollarCircleOutlined />,
      color: '#722ed1',
    },
    {
      title: 'Doanh thu dự kiến',
      value: expectedRevenue,
      icon: <RiseOutlined />,
      color: '#13c2c2',
      suffix: 'VNĐ',
    },
    { title: 'Trung tâm đào tạo', value: 0, icon: <BankOutlined />, color: '#52c41a' },
    { title: 'Khóa học', value: 0, icon: <BookOutlined />, color: '#faad14' },
    {
      title: 'Chứng chỉ sắp hết hạn (90 ngày)',
      value: statsData?.certificates_expiring_soon ?? 0,
      icon: <SafetyCertificateOutlined />,
      color: '#ff4d4f',
    },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Tổng quan</h2>
      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={12} md={8} key={s.title}>
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
                  suffix={s.suffix}
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
