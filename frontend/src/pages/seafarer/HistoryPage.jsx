import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Tabs, Empty, Grid } from 'antd'
import { seafarerPortalApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

export default function SeafarerHistoryPage() {
  const { data: enrollments, isLoading: loadingEnroll } = useQuery({
    queryKey: ['portal-enrollments'],
    queryFn: () => seafarerPortalApi.getEnrollments().then((r) => r.data),
  })

  const { data: contracts, isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts'],
    queryFn: () => seafarerPortalApi.getContracts().then((r) => r.data),
  })

  const screens = useBreakpoint()
  const isMobile = !screens.md

  const enrollColumns = [
    { title: 'Khóa học', dataIndex: 'course_name' },
    { title: 'Trung tâm', dataIndex: 'training_center_name' },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'enrollment_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Điểm', dataIndex: 'total_score', width: 80 },
    { title: 'Xếp loại', dataIndex: 'grade', width: 90 },
    {
      title: 'Kết quả',
      dataIndex: 'result',
      width: 100,
      render: (v) => (v ? <Tag color={v === 'PASS' ? 'green' : 'red'}>{v}</Tag> : '-'),
    },
    {
      title: 'Chứng chỉ',
      dataIndex: 'certificate_issued',
      width: 100,
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đã cấp' : 'Chưa cấp'}</Tag>,
    },
  ]

  const contractColumns = [
    { title: 'Tàu', dataIndex: 'vessel_name' },
    { title: 'Loại tàu', dataIndex: 'vessel_type_name' },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'start_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'end_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 110, render: (v) => <Tag>{v}</Tag> },
  ]

  const enrollContent = isMobile ? (
    enrollments?.length ? (
      (enrollments || []).map((r) => (
        <div
          key={r.id}
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border-strong)',
            padding: '12px 16px',
            marginBottom: 8,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div style={{ flex: 1, marginRight: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.course_name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {r.training_center_name}
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
            >
              {r.result && <Tag color={r.result === 'PASS' ? 'green' : 'red'}>{r.result}</Tag>}
              <Tag color={r.certificate_issued ? 'green' : 'default'}>
                {r.certificate_issued ? 'Đã cấp' : 'Chưa cấp'}
              </Tag>
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12 }}>
            {r.enrollment_date && <span>{dayjs(r.enrollment_date).format('DD/MM/YYYY')}</span>}
            {r.total_score != null && (
              <span>
                Điểm: {r.total_score}
                {r.grade ? ` (${r.grade})` : ''}
              </span>
            )}
          </div>
        </div>
      ))
    ) : (
      <Empty description="Chưa có lịch sử đào tạo" style={{ padding: 40 }} />
    )
  ) : enrollments?.length ? (
    <Table
      rowKey="id"
      columns={enrollColumns}
      dataSource={enrollments}
      loading={loadingEnroll}
      size="small"
      pagination={false}
      scroll={{ x: 600 }}
    />
  ) : (
    <Empty description="Chưa có lịch sử đào tạo" style={{ padding: 40 }} />
  )

  const contractContent = isMobile ? (
    contracts?.length ? (
      (contracts || []).map((r) => (
        <div
          key={r.id}
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border-strong)',
            padding: '12px 16px',
            marginBottom: 8,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.vessel_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {r.vessel_type_name}
              </div>
            </div>
            <Tag>{r.status}</Tag>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
            {r.start_date ? dayjs(r.start_date).format('DD/MM/YYYY') : '?'}
            {' → '}
            {r.end_date ? dayjs(r.end_date).format('DD/MM/YYYY') : '?'}
          </div>
        </div>
      ))
    ) : (
      <Empty description="Chưa có lịch sử hợp đồng" style={{ padding: 40 }} />
    )
  ) : contracts?.length ? (
    <Table
      rowKey="id"
      columns={contractColumns}
      dataSource={contracts}
      loading={loadingContracts}
      size="small"
      pagination={false}
      scroll={{ x: 500 }}
    />
  ) : (
    <Empty description="Chưa có lịch sử hợp đồng" style={{ padding: 40 }} />
  )

  const tabs = [
    {
      key: 'enrollments',
      label: `Đào tạo (${enrollments?.length || 0})`,
      children: <div style={{ paddingTop: isMobile ? 12 : 0 }}>{enrollContent}</div>,
    },
    {
      key: 'contracts',
      label: `Hợp đồng (${contracts?.length || 0})`,
      children: <div style={{ paddingTop: isMobile ? 12 : 0 }}>{contractContent}</div>,
    },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', marginBottom: 24 }}>
        Lịch sử
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
        <Tabs items={tabs} style={{ padding: '0 16px' }} />
      </div>
    </div>
  )
}
