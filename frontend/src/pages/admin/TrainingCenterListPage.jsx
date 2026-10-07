import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Grid,
  Spin,
  Pagination,
  Modal,
  Form,
  message,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  RightOutlined,
  PhoneOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { trainingCenterApi } from '../../api'

const { useBreakpoint } = Grid

export default function TrainingCenterListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, limit: 20 })
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { data, isFetching } = useQuery({
    queryKey: ['training-centers', filters],
    // Bỏ tham số rỗng: backend chỉ nhận is_active = 'true' | 'false'.
    queryFn: () => trainingCenterApi.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values) => trainingCenterApi.create(values).then((r) => r.data),
    onSuccess: () => {
      message.success('Tạo trung tâm thành công')
      setCreateOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['training-centers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Tạo thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => trainingCenterApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa trung tâm')
      queryClient.invalidateQueries({ queryKey: ['training-centers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete(r) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa "${r.name_vi}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutate(r.id),
    })
  }

  const columns = [
    { title: 'Mã', dataIndex: 'code', width: 100 },
    {
      title: 'Tên trung tâm',
      dataIndex: 'name_vi',
      render: (v, r) => (
        <a onClick={() => navigate(`/training-centers/${r.id}`)} style={{ color: 'var(--primary)' }}>
          {v}
        </a>
      ),
    },
    { title: 'Số giấy phép', dataIndex: 'license_number', width: 160 },
    {
      title: 'Hết hạn GP',
      dataIndex: 'license_expiry',
      width: 130,
      render: (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : '-'),
    },
    { title: 'SĐT', dataIndex: 'phone', width: 130 },
    { title: 'Người liên hệ', dataIndex: 'contact_person', width: 160 },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      width: 110,
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Hoạt động' : 'Tạm dừng'}</Tag>,
    },
    {
      title: '',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => navigate(`/training-centers/${r.id}`)}>
            Chi tiết
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/training-centers/${r.id}`)}
          />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
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
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>Trung tâm đào tạo</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Thêm mới
        </Button>
      </div>

      <Modal
        title="Thêm trung tâm đào tạo"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item
            name="name_vi"
            label="Tên (VI)"
            rules={[{ required: true, message: 'Nhập tên trung tâm' }]}
          >
            <Input placeholder="Tên tiếng Việt" />
          </Form.Item>
          <Form.Item name="code" label="Mã">
            <Input />
          </Form.Item>
          <Form.Item name="license_number" label="Số giấy phép">
            <Input />
          </Form.Item>
          <Form.Item name="license_expiry" label="Hết hạn GP">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="phone" label="SĐT">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="contact_person" label="Người liên hệ">
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" initialValue={true}>
            <Select
              options={[
                { value: true, label: 'Hoạt động' },
                { value: false, label: 'Tạm dừng' },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Tạo
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: '1px solid var(--border-strong)',
        }}
      >
        <Space wrap>
          <Input
            placeholder="Tìm tên, mã, số giấy phép..."
            prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
            style={{ flex: 1, minWidth: 140, height: 32, borderRadius: 6 }}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            allowClear
          />
          <Select
            placeholder="Trạng thái"
            style={{ minWidth: 140, height: 32 }}
            value={filters.is_active || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, is_active: v ?? '', page: 1 }))}
            allowClear
            options={[
              { value: 'true', label: 'Hoạt động' },
              { value: 'false', label: 'Tạm dừng' },
            ]}
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
              onClick={() => navigate(`/training-centers/${r.id}`)}
              style={{
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
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
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--primary)' }}>{r.name_vi}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {r.code}
                    {r.license_number ? ` · GP: ${r.license_number}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={r.is_active ? 'green' : 'default'} style={{ margin: 0 }}>
                    {r.is_active ? 'Hoạt động' : 'Tạm dừng'}
                  </Tag>
                  <RightOutlined style={{ color: 'var(--border-strong)', fontSize: 12 }} />
                </div>
              </div>
              {(r.phone || r.contact_person) && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {r.phone && (
                    <>
                      <PhoneOutlined />
                      <span>{r.phone}</span>
                    </>
                  )}
                  {r.contact_person && (
                    <span style={{ color: 'var(--muted)' }}>
                      {r.phone ? ' · ' : ''}
                      {r.contact_person}
                    </span>
                  )}
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
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data?.data || []}
            loading={isFetching}
            scroll={{ x: 800 }}
            pagination={{
              current: filters.page,
              pageSize: filters.limit,
              total: data?.total || 0,
              showSizeChanger: true,
              showTotal: (t) => `Tổng ${t} trung tâm`,
              onChange: (page, limit) => setFilters((f) => ({ ...f, page, limit })),
            }}
            size="middle"
          />
        </div>
      )}
    </div>
  )
}
