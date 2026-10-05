import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Input,
  Select,
  Button,
  Tag,
  Space,
  message,
  Grid,
  Spin,
  Pagination,
  Modal,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  PhoneOutlined,
  RightOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { seafarerApi, lookupApi } from '../../api'
import api from '../../api/client'
import ZaloButton from '../../components/common/ZaloButton'

const { useBreakpoint } = Grid

const STATUS_COLOR = {
  AVAILABLE: 'green',
  ON_VESSEL: 'blue',
  ON_LEAVE: 'orange',
  TRAINING: 'purple',
  BLACKLISTED: 'red',
  RETIRED: 'default',
  INACTIVE: 'default',
}
const STATUS_LABEL = {
  AVAILABLE: 'Sẵn sàng',
  ON_VESSEL: 'Đang tàu',
  ON_LEAVE: 'Nghỉ phép',
  TRAINING: 'Đang đào tạo',
  BLACKLISTED: 'Blacklist',
  RETIRED: 'Đã nghỉ hưu',
  INACTIVE: 'Không hoạt động',
}

export default function SeafarerListPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    rank_id: '',
    page: 1,
    limit: 20,
  })
  const [exporting, setExporting] = useState(false)
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const deleteMutation = useMutation({
    mutationFn: (seafarerId) => api.delete(`/seafarers/${seafarerId}`),
    onSuccess: () => {
      message.success('Đã xóa thuyền viên')
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDeleteSeafarer(r) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa "${r.full_name}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutate(r.id),
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)
      if (filters.rank_id) params.set('rank_id', filters.rank_id)

      const res = await api.get(`/seafarers/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Export thất bại')
    } finally {
      setExporting(false)
    }
  }

  const { data, isFetching } = useQuery({
    queryKey: ['seafarers', filters],
    queryFn: () => seafarerApi.list(filters).then((r) => r.data),
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const columns = [
    { title: 'Mã TV', dataIndex: 'seafarer_code', width: 110 },
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      render: (v, r) => (
        <a onClick={() => navigate(`/seafarers/${r.id}`)} style={{ color: '#1677ff' }}>
          {v}
        </a>
      ),
    },
    { title: 'CCCD', dataIndex: 'national_id', width: 140 },
    { title: 'Chức danh', dataIndex: 'rank_name', width: 140 },
    {
      title: 'SĐT',
      dataIndex: 'phone_primary',
      width: 150,
      render: (v) =>
        v ? (
          <span>
            {v}
            <ZaloButton phone={v} />
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={STATUS_COLOR[v] || 'default'}>{STATUS_LABEL[v] || v}</Tag>,
    },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => navigate(`/seafarers/${r.id}`)}>
            Chi tiết
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteSeafarer(r)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>Thuyền viên</span>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            Export Excel
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate('/seafarers/import')}>
            Import Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seafarers/new')}>
            Thêm mới
          </Button>
        </Space>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: '1px solid #f0f0f0',
        }}
      >
        <Space wrap>
          <Input
            placeholder="Tìm tên, mã TV, CCCD..."
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            style={{ flex: 1, minWidth: 140, height: 32, borderRadius: 6 }}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            allowClear
          />
          <Select
            placeholder="Trạng thái"
            style={{ minWidth: 140, height: 32 }}
            value={filters.status || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, status: v || '', page: 1 }))}
            allowClear
            options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Select
            placeholder="Chức danh"
            style={{ minWidth: 160, height: 32 }}
            value={filters.rank_id || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, rank_id: v || '', page: 1 }))}
            allowClear
            options={(ranks || []).map((r) => ({ value: r.id, label: r.name_vi }))}
          />
        </Space>
      </div>

      {isMobile ? (
        <div>
          {isFetching && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {(data?.data || []).map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/seafarers/${r.id}`)}
              style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: '12px 16px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#1677ff' }}>
                    {r.full_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    {r.seafarer_code} · {r.rank_name || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={STATUS_COLOR[r.status] || 'default'} style={{ margin: 0 }}>
                    {STATUS_LABEL[r.status] || r.status}
                  </Tag>
                  <RightOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                </div>
              </div>
              {r.phone_primary && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: '#595959',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <PhoneOutlined />
                  <span>{r.phone_primary}</span>
                  <ZaloButton phone={r.phone_primary} />
                </div>
              )}
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination
              current={filters.page}
              pageSize={filters.limit}
              total={data?.total || 0}
              simple
              onChange={(page, limit) => setFilters((f) => ({ ...f, page, limit }))}
            />
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data?.data || []}
            loading={isFetching}
            scroll={{ x: 700 }}
            pagination={{
              current: filters.page,
              pageSize: filters.limit,
              total: data?.total || 0,
              showSizeChanger: true,
              showTotal: (t) => `Tổng ${t} thuyền viên`,
              onChange: (page, limit) => setFilters((f) => ({ ...f, page, limit })),
            }}
            size="middle"
          />
        </div>
      )}
    </div>
  )
}
