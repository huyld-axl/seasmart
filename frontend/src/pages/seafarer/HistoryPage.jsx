import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Tabs, Empty, Grid } from 'antd'
import { seafarerPortalApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

export default function SeafarerHistoryPage() {
  const { data: contracts, isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts'],
    queryFn: () => seafarerPortalApi.getContracts().then((r) => r.data),
  })

  const screens = useBreakpoint()
  const isMobile = !screens.md

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

  const contractContent = isMobile ? (
    contracts?.length ? (
      (contracts || []).map((r) => (
        <div
          key={r.id}
          style={{
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            padding: '12px 16px',
            marginBottom: 8,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.vessel_name || '-'}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                {r.vessel_type_name}
              </div>
            </div>
            <Tag>{r.status}</Tag>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
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
      key: 'contracts',
      label: `Hợp đồng (${contracts?.length || 0})`,
      children: <div style={{ paddingTop: isMobile ? 12 : 0 }}>{contractContent}</div>,
    },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#262626', marginBottom: 24 }}>
        Lịch sử
      </div>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Tabs items={tabs} style={{ padding: '0 16px' }} />
      </div>
    </div>
  )
}
