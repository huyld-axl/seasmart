import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Table,
  Spin,
  Tabs,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Grid,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { courseApi, enrollmentApi, trainingCenterApi, lookupApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR = { PLANNED: 'blue', ONGOING: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const STATUS_LABEL = {
  PLANNED: 'Kế hoạch',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getById(id).then((r) => r.data),
  })

  const { data: enrollments, isLoading: enrollLoading } = useQuery({
    queryKey: ['enrollments', { course_id: id }],
    queryFn: () => enrollmentApi.list({ course_id: id, limit: 200 }).then((r) => r.data),
  })

  const { data: centers } = useQuery({
    queryKey: ['training-centers-all'],
    queryFn: () => trainingCenterApi.list({ limit: 200 }).then((r) => r.data),
  })

  const { data: courseTypes } = useQuery({
    queryKey: ['course-types'],
    queryFn: () => lookupApi.courseTypes().then((r) => r.data),
  })

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />

  const handleEdit = () => {
    form.setFieldsValue({
      ...course,
      start_date: course.start_date ? dayjs(course.start_date) : null,
      end_date: course.end_date ? dayjs(course.end_date) : null,
    })
    setEditOpen(true)
  }

  const handleSave = async (values) => {
    setSaving(true)
    try {
      await courseApi.update(id, {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      })
      message.success('Cập nhật thành công')
      queryClient.invalidateQueries({ queryKey: ['course', id] })
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      setEditOpen(false)
    } catch (err) {
      message.error(err.response?.data?.error || 'Cập nhật thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await courseApi.remove(id)
      message.success('Đã xóa khóa học')
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      navigate('/courses')
    } catch (err) {
      message.error(err.response?.data?.error || 'Xóa thất bại')
    }
  }

  const studentColumns = [
    { title: 'Mã TV', dataIndex: 'seafarer_code', width: 110 },
    { title: 'Họ và tên', dataIndex: 'seafarer_name' },
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

  const infoSection = (
    <Descriptions
      column={isMobile ? 1 : 2}
      bordered
      size="small"
      labelStyle={{ width: 180, background: '#fafafa' }}
    >
      <Descriptions.Item label="Mã khóa">{course.course_code || '-'}</Descriptions.Item>
      <Descriptions.Item label="Tên khóa học">{course.name}</Descriptions.Item>
      <Descriptions.Item label="Trung tâm">{course.training_center_name || '-'}</Descriptions.Item>
      <Descriptions.Item label="Loại khóa học">{course.course_type_name || '-'}</Descriptions.Item>
      <Descriptions.Item label="Bắt đầu">
        {course.start_date ? dayjs(course.start_date).format('DD/MM/YYYY') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Kết thúc">
        {course.end_date ? dayjs(course.end_date).format('DD/MM/YYYY') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Địa điểm">{course.location || '-'}</Descriptions.Item>
      <Descriptions.Item label="Giảng viên">{course.instructor || '-'}</Descriptions.Item>
      <Descriptions.Item label="Học viên tối đa">{course.max_students || '-'}</Descriptions.Item>
      <Descriptions.Item label="Đã đăng ký">{course.enrolled_count || 0}</Descriptions.Item>
      <Descriptions.Item label="Học phí (VND)">
        {course.fee_vnd ? Number(course.fee_vnd).toLocaleString('vi-VN') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Trạng thái">
        <Tag color={STATUS_COLOR[course.status]}>
          {STATUS_LABEL[course.status] || course.status}
        </Tag>
      </Descriptions.Item>
    </Descriptions>
  )

  const studentsSection = (
    <Table
      rowKey="id"
      columns={studentColumns}
      dataSource={enrollments?.data || []}
      loading={enrollLoading}
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')} />
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
            {course.name}
          </span>
          <Tag color={STATUS_COLOR[course.status]}>
            {STATUS_LABEL[course.status] || course.status}
          </Tag>
          <Button icon={<EditOutlined />} onClick={handleEdit} />
          <Popconfirm
            title="Xóa khóa học này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={handleDelete}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </div>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Thông tin</div>
          <div style={{ padding: 16 }}>{infoSection}</div>
        </div>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Học viên ({enrollments?.data?.length || 0})</div>
          <div style={{ padding: 16 }}>{studentsSection}</div>
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
      key: 'students',
      label: `Học viên (${enrollments?.data?.length || 0})`,
      children: <div style={{ padding: '16px 0' }}>{studentsSection}</div>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')} />
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>{course.name}</span>
        <Tag color={STATUS_COLOR[course.status]}>
          {STATUS_LABEL[course.status] || course.status}
        </Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={handleEdit}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa khóa học này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={handleDelete}
          >
            <Button icon={<DeleteOutlined />} danger>
              Xóa
            </Button>
          </Popconfirm>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Tabs items={tabs} style={{ padding: '0 24px' }} />
      </div>

      <Modal
        title="Chỉnh sửa khóa học"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item
            name="training_center_id"
            label="Trung tâm đào tạo"
            rules={[{ required: true, message: 'Chọn trung tâm' }]}
          >
            <Select
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
          <Form.Item name="status" label="Trạng thái">
            <Select
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
