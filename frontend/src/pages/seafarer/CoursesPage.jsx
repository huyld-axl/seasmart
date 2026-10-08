import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Button, Select, message, Modal, Empty, Grid, Tooltip } from 'antd'
import { seafarerPortalApi, courseApi, trainingCenterApi } from '../../api'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid
const STATUS_COLOR = { PLANNED: 'blue', ONGOING: 'green', COMPLETED: 'default', CANCELLED: 'red' }
const STATUS_LABEL = {
  PLANNED: 'Kế hoạch',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
}
const ENROLL_STATUS = { pending: 'Chờ duyệt', approved: 'Đã duyệt', completed: 'Hoàn thành' }

export default function SeafarerCoursesPage() {
  const queryClient = useQueryClient()
  const [centerFilter, setCenterFilter] = useState(null)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['portal-enrollments'],
    queryFn: () => seafarerPortalApi.getEnrollments().then((r) => r.data),
  })
  const myEnrollments = enrollmentsData?.data || []

  const cancelMutation = useMutation({
    mutationFn: (id) => seafarerPortalApi.cancelEnrollment(id),
    onSuccess: () => {
      message.success('Đã hủy đăng ký')
      queryClient.invalidateQueries({ queryKey: ['portal-enrollments'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Hủy đăng ký thất bại'),
  })

  function handleCancelEnroll(enrollment) {
    const canCancel = enrollment.status === 'pending' || enrollment.status == null
    if (!canCancel) return
    Modal.confirm({
      title: 'Xác nhận hủy đăng ký',
      content: `Bạn có chắc muốn hủy đăng ký khóa "${enrollment.course_name}"?`,
      okText: 'Hủy đăng ký',
      okType: 'danger',
      onOk: () => cancelMutation.mutate(enrollment.id),
    })
  }

  const { data: courses, isLoading } = useQuery({
    queryKey: ['portal-courses', centerFilter],
    queryFn: () =>
      courseApi
        .list({
          training_center_id: centerFilter || '',
          status: 'PLANNED,ONGOING',
          limit: 100,
        })
        .then((r) => r.data),
  })

  const { data: centers } = useQuery({
    queryKey: ['training-centers-all'],
    queryFn: () => trainingCenterApi.list({ limit: 200 }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (course_id) => seafarerPortalApi.enroll(course_id),
    onSuccess: () => {
      message.success('Đăng ký khóa học thành công')
      queryClient.invalidateQueries({ queryKey: ['portal-enrollments'] })
    },
    onError: (err) => message.error(err.response?.data?.error || 'Đăng ký thất bại'),
  })

  const confirmEnroll = (r) =>
    Modal.confirm({
      title: 'Xác nhận đăng ký',
      content: `Đăng ký khóa học "${r.name}"?`,
      onOk: () => mutation.mutate(r.id),
    })

  const columns = [
    { title: 'Tên khóa học', dataIndex: 'name' },
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
    {
      title: 'Học phí',
      dataIndex: 'fee_vnd',
      width: 130,
      render: (v) => (v ? Number(v).toLocaleString('vi-VN') + 'đ' : 'Miễn phí'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>,
    },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          loading={mutation.isPending}
          onClick={() => confirmEnroll(r)}
        >
          Đăng ký
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', marginBottom: 24 }}>
        Đăng ký khóa học
      </div>

      {myEnrollments.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            border: '1px solid var(--border-strong)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Đăng ký của tôi</div>
          <Table
            rowKey="id"
            size="small"
            dataSource={myEnrollments}
            loading={enrollmentsLoading}
            pagination={false}
            columns={[
              { title: 'Khóa học', dataIndex: 'course_name' },
              { title: 'Trung tâm', dataIndex: 'training_center_name', width: 160 },
              {
                title: 'Ngày đăng ký',
                dataIndex: 'enrollment_date',
                width: 120,
                render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 120,
                render: (v) => <Tag>{ENROLL_STATUS[v] || v || 'Chờ duyệt'}</Tag>,
              },
              {
                title: '',
                width: 120,
                render: (_, r) => {
                  const canCancel = r.status === 'pending' || r.status == null
                  return canCancel ? (
                    <Button
                      size="small"
                      danger
                      onClick={() => handleCancelEnroll(r)}
                      loading={cancelMutation.isPending}
                    >
                      Hủy đăng ký
                    </Button>
                  ) : (
                    <Tooltip title="Chỉ được hủy khi trạng thái là chờ duyệt">
                      <span>
                        <Button size="small" disabled>
                          Hủy đăng ký
                        </Button>
                      </span>
                    </Tooltip>
                  )
                },
              },
            ]}
          />
        </div>
      )}

      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: '1px solid var(--border-strong)',
        }}
      >
        <Select
          placeholder="Lọc theo trung tâm đào tạo"
          style={{ width: '100%', maxWidth: 320 }}
          value={centerFilter}
          onChange={(v) => setCenterFilter(v || null)}
          allowClear
          options={(centers?.data || []).map((c) => ({ value: c.id, label: c.name_vi }))}
        />
      </div>

      {!courses?.data?.length && !isLoading ? (
        <Empty
          description="Không có khóa học nào"
          style={{ padding: 40, background: 'var(--surface)', borderRadius: 8 }}
        />
      ) : isMobile ? (
        <div>
          {(courses?.data || []).map((r) => (
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
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {r.training_center_name}
                  </div>
                </div>
                <Tag color={STATUS_COLOR[r.status]} style={{ margin: 0 }}>
                  {STATUS_LABEL[r.status] || r.status}
                </Tag>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--muted)',
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {r.start_date && (
                  <span>
                    {dayjs(r.start_date).format('DD/MM/YYYY')} →{' '}
                    {r.end_date ? dayjs(r.end_date).format('DD/MM/YYYY') : '?'}
                  </span>
                )}
                <span style={{ fontWeight: 500 }}>
                  {r.fee_vnd ? Number(r.fee_vnd).toLocaleString('vi-VN') + 'đ' : 'Miễn phí'}
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Button
                  type="primary"
                  size="small"
                  loading={mutation.isPending}
                  onClick={() => confirmEnroll(r)}
                >
                  Đăng ký
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={courses?.data || []}
            loading={isLoading}
            size="middle"
            pagination={false}
            scroll={{ x: 700 }}
          />
        </div>
      )}
    </div>
  )
}
