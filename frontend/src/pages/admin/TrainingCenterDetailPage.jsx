import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Table,
  Spin,
  Tabs,
  Grid,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { trainingCenterApi, courseApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR = { PLANNED: 'blue', ONGOING: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const STATUS_LABEL = {
  PLANNED: 'Kế hoạch',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
}

export default function TrainingCenterDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { data: center, isLoading } = useQuery({
    queryKey: ['training-center', id],
    queryFn: () => trainingCenterApi.getById(id).then((r) => r.data),
  })

  useEffect(() => {
    if (center)
      form.setFieldsValue({
        ...center,
        license_expiry: center.license_expiry
          ? dayjs(center.license_expiry).format('YYYY-MM-DD')
          : undefined,
      })
  }, [center, form])

  const updateMutation = useMutation({
    mutationFn: (values) =>
      trainingCenterApi
        .update(id, {
          ...values,
          license_expiry: values.license_expiry || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      message.success('Cập nhật thành công')
      setEditOpen(false)
      queryClient.invalidateQueries({ queryKey: ['training-center', id] })
      queryClient.invalidateQueries({ queryKey: ['training-centers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => trainingCenterApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa trung tâm')
      navigate('/training-centers')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDeleteClick() {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa "${center?.name_vi}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutate(),
    })
  }

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', { training_center_id: id }],
    queryFn: () => courseApi.list({ training_center_id: id, limit: 100 }).then((r) => r.data),
  })

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />

  const courseColumns = [
    { title: 'Mã khóa', dataIndex: 'course_code', width: 120 },
    { title: 'Tên khóa học', dataIndex: 'name' },
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
    { title: 'Học viên', dataIndex: 'max_students', width: 100 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>,
    },
  ]

  const infoSection = (
    <Descriptions
      column={isMobile ? 1 : 2}
      bordered
      size="small"
      labelStyle={{ width: 180, background: '#fafafa' }}
    >
      <Descriptions.Item label="Mã">{center.code || '-'}</Descriptions.Item>
      <Descriptions.Item label="Tên (VI)">{center.name_vi}</Descriptions.Item>
      <Descriptions.Item label="Tên (EN)">{center.name_en || '-'}</Descriptions.Item>
      <Descriptions.Item label="Quốc gia">{center.country_name || '-'}</Descriptions.Item>
      <Descriptions.Item label="Số giấy phép">{center.license_number || '-'}</Descriptions.Item>
      <Descriptions.Item label="Hết hạn GP">
        {center.license_expiry ? dayjs(center.license_expiry).format('DD/MM/YYYY') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Được công nhận bởi">
        {center.accredited_by || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Địa chỉ">{center.address || '-'}</Descriptions.Item>
      <Descriptions.Item label="SĐT">{center.phone || '-'}</Descriptions.Item>
      <Descriptions.Item label="Email">{center.email || '-'}</Descriptions.Item>
      <Descriptions.Item label="Người liên hệ">{center.contact_person || '-'}</Descriptions.Item>
      <Descriptions.Item label="Trạng thái">
        <Tag color={center.is_active ? 'green' : 'default'}>
          {center.is_active ? 'Hoạt động' : 'Tạm dừng'}
        </Tag>
      </Descriptions.Item>
    </Descriptions>
  )

  const coursesSection = (
    <Table
      rowKey="id"
      columns={courseColumns}
      dataSource={courses?.data || []}
      loading={coursesLoading}
      size="small"
      pagination={false}
      scroll={{ x: 600 }}
    />
  )

  const sectionStyle = {
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  }

  const sectionHeaderStyle = {
    padding: '10px 16px',
    borderBottom: '1px solid #f0f0f0',
    fontWeight: 600,
    fontSize: 13,
    color: '#003366',
    background: '#fafafa',
    borderRadius: '8px 8px 0 0',
  }

  if (isMobile) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/training-centers')} />
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#262626',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {center.name_vi}
          </span>
          <Tag color={center.is_active ? 'green' : 'default'}>
            {center.is_active ? 'Hoạt động' : 'Tạm dừng'}
          </Tag>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Thông tin</div>
          <div style={{ padding: 16 }}>{infoSection}</div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Khóa học ({courses?.data?.length || 0})</div>
          <div style={{ padding: 16 }}>{coursesSection}</div>
        </div>
      </div>
    )
  }

  const tabs = [
    {
      key: 'info',
      label: 'Thông tin',
      children: <div style={{ padding: '16px 0' }}>{infoSection}</div>,
    },
    {
      key: 'courses',
      label: `Khóa học (${courses?.data?.length || 0})`,
      children: <div style={{ padding: '16px 0' }}>{coursesSection}</div>,
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/training-centers')} />
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>{center.name_vi}</span>
        <Tag color={center.is_active ? 'green' : 'default'}>
          {center.is_active ? 'Hoạt động' : 'Tạm dừng'}
        </Tag>
        <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
          Chỉnh sửa
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleDeleteClick}
          loading={deleteMutation.isPending}
        >
          Xóa
        </Button>
      </div>

      <Modal
        title="Chỉnh sửa trung tâm"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="name_vi" label="Tên (VI)" rules={[{ required: true }]}>
            <Input />
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
          <Form.Item name="is_active" label="Trạng thái">
            <Select
              options={[
                { value: true, label: 'Hoạt động' },
                { value: false, label: 'Tạm dừng' },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button onClick={() => setEditOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Tabs items={tabs} style={{ padding: '0 24px' }} />
      </div>
    </div>
  )
}
