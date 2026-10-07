import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Select,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Input,
  message,
  Grid,
  Spin,
  Pagination,
} from 'antd'
import { PlusOutlined, SearchOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

import { courseApi, trainingCenterApi, lookupApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR = { PLANNED: 'blue', ONGOING: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const STATUS_LABEL = {
  PLANNED: 'Kế hoạch',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
}

export default function CourseListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    training_center_id: '',
    page: 1,
    limit: 20,
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const { data, isFetching } = useQuery({
    queryKey: ['courses', filters],
    queryFn: () => courseApi.list(filters).then((r) => r.data),
  })

  const { data: centers } = useQuery({
    queryKey: ['training-centers-all'],
    queryFn: () => trainingCenterApi.list({ limit: 200 }).then((r) => r.data),
  })

  const { data: courseTypes } = useQuery({
    queryKey: ['course-types'],
    queryFn: () => lookupApi.courseTypes().then((r) => r.data),
  })

  const handleCreate = async (values) => {
    setSaving(true)
    try {
      await courseApi.create({
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      })
      message.success('Tạo khóa học thành công')
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      closeModal()
    } catch (err) {
      message.error(err.response?.data?.error || 'Tạo thất bại')
    } finally {
      setSaving(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    form.resetFields()
  }

  const columns = [
    { title: 'Mã khóa', dataIndex: 'course_code', width: 120 },
    {
      title: 'Tên khóa học',
      dataIndex: 'name',
      render: (v, r) => (
        <a onClick={() => navigate(`/courses/${r.id}`)} style={{ color: 'var(--primary)' }}>
          {v}
        </a>
      ),
    },
    { title: 'Trung tâm', dataIndex: 'training_center_name' },
    {
      title: 'Bắt đầu',
      dataIndex: 'start_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Kết thúc',
      dataIndex: 'end_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Học viên tối đa', dataIndex: 'max_students', width: 130 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>,
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
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>Khóa học</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm mới
        </Button>
      </div>

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
            placeholder="Tìm tên, mã khóa học..."
            prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
            style={{ flex: 1, minWidth: 140, height: 32, borderRadius: 6 }}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            allowClear
          />
          <Select
            placeholder="Trung tâm đào tạo"
            style={{ minWidth: 180, height: 32 }}
            value={filters.training_center_id || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, training_center_id: v ?? '', page: 1 }))}
            allowClear
            options={(centers?.data || []).map((c) => ({ value: c.id, label: c.name_vi }))}
          />
          <Select
            placeholder="Trạng thái"
            style={{ minWidth: 140, height: 32 }}
            value={filters.status || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, status: v || '', page: 1 }))}
            allowClear
            options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Space>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
        {isMobile ? (
          <div>
            {isFetching ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin />
              </div>
            ) : (
              (data?.data || []).map((r) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/courses/${r.id}`)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-strong)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--primary)', flex: 1, marginRight: 8 }}>
                      {r.name}
                    </span>
                    <Tag color={STATUS_COLOR[r.status]} style={{ marginRight: 4 }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </Tag>
                    <RightOutlined style={{ color: 'var(--border-strong)', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                    {[r.course_code, r.training_center_name].filter(Boolean).join(' · ')}
                  </div>
                  {(r.start_date || r.end_date) && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {r.start_date ? dayjs(r.start_date).format('DD/MM/YYYY') : '?'}
                      {' → '}
                      {r.end_date ? dayjs(r.end_date).format('DD/MM/YYYY') : '?'}
                    </div>
                  )}
                </div>
              ))
            )}
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <Pagination
                simple
                current={filters.page}
                pageSize={filters.limit}
                total={data?.total || 0}
                onChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            </div>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data?.data || []}
            loading={isFetching}
            scroll={{ x: 800 }}
            onRow={(r) => ({
              onClick: () => navigate(`/courses/${r.id}`),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: filters.page,
              pageSize: filters.limit,
              total: data?.total || 0,
              showSizeChanger: true,
              showTotal: (t) => `Tổng ${t} khóa học`,
              onChange: (page, limit) => setFilters((f) => ({ ...f, page, limit })),
            }}
            size="middle"
          />
        )}
      </div>

      <Modal
        title="Tạo khóa học mới"
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="training_center_id"
            label="Trung tâm đào tạo"
            rules={[{ required: true, message: 'Chọn trung tâm' }]}
          >
            <Select
              placeholder="Chọn trung tâm"
              options={(centers?.data || []).map((c) => ({ value: c.id, label: c.name_vi }))}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên khóa học"
            rules={[{ required: true, message: 'Nhập tên khóa học' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="course_code" label="Mã khóa">
            <Input />
          </Form.Item>
          <Form.Item name="course_type_id" label="Loại khóa học">
            <Select
              placeholder="Chọn loại"
              allowClear
              options={(courseTypes || []).map((t) => ({ value: t.id, label: t.name_vi }))}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="start_date" label="Ngày bắt đầu" style={{ flex: 1, marginBottom: 0 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="end_date" label="Ngày kết thúc" style={{ flex: 1, marginBottom: 0 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%', marginTop: 16 }} size={16}>
            <Form.Item
              name="max_students"
              label="Học viên tối đa"
              style={{ flex: 1, marginBottom: 0 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fee_vnd" label="Học phí (VND)" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={(v) => (v ? Number(v).toLocaleString('vi-VN') : '')}
              />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="Địa điểm" style={{ marginTop: 16 }}>
            <Input />
          </Form.Item>
          <Form.Item name="instructor" label="Giảng viên">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" initialValue="PLANNED">
            <Select
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
