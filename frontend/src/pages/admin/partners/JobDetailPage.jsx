import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Spin,
  Grid,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Space,
  App,
  Input,
  message,
  Table,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  DownloadOutlined,
  UserAddOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { jobApi, seafarerApi, lookupApi, deploymentApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR = { OPEN: 'green', FILLED: 'blue', CANCELLED: 'default' }
const STATUS_LABEL = { OPEN: 'Còn trống', FILLED: 'Đã có người', CANCELLED: 'Hủy' }
const PAYMENT_CYCLE_LABEL = {
  WEEKLY: 'Hàng tuần',
  BIWEEKLY: '2 tuần / kỳ',
  MONTHLY: 'Hàng tháng',
  YEARLY: 'Theo năm',
  PER_VOYAGE: 'Theo chuyến',
}
const PAYMENT_METHOD_LABEL = {
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  CASH: 'Tiền mặt',
  OTHER: 'Khác',
}
const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

const sectionStyle = {
  background: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: 2,
  marginBottom: 16,
}
const sectionHeaderStyle = {
  padding: '10px 16px',
  borderBottom: '1px solid #D9D9D9',
  fontWeight: 600,
  fontSize: 13,
  color: '#003366',
  background: '#FAFAFA',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
const sectionBodyStyle = { padding: 16 }

function Section({ title, extra, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span>{title}</span>
        {extra}
      </div>
      <div style={sectionBodyStyle}>{children}</div>
    </div>
  )
}

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const isReadOnly = !['admin', 'operator', 'accountant'].includes(user?.role)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [editOpen, setEditOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [paymentFileList, setPaymentFileList] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [editAssignOpen, setEditAssignOpen] = useState(false)
  const [editingDeployment, setEditingDeployment] = useState(null)
  const [seafarerSearch, setSeafarerSearch] = useState('')
  const [form] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const [assignForm] = Form.useForm()
  const [editAssignForm] = Form.useForm()

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobApi.getById(id).then((r) => r.data),
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks-lookup'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
    enabled: editOpen,
  })

  const { data: vessels } = useQuery({
    queryKey: ['vessels-lookup'],
    queryFn: () => lookupApi.vessels().then((r) => r.data),
    enabled: editOpen,
  })

  const [partnerSearch, setPartnerSearch] = useState('')
  const { data: partnerResults } = useQuery({
    queryKey: ['partners-edit-search', partnerSearch],
    queryFn: () => lookupApi.shipOwners(partnerSearch || undefined).then((r) => r.data),
    enabled: editOpen,
  })
  const partnerOptions = useMemo(() => {
    const results = (partnerResults || []).map((s) => ({ value: s.id, label: s.company_name }))
    if (job?.ship_owner_id && !results.find((o) => o.value === job.ship_owner_id)) {
      results.unshift({
        value: job.ship_owner_id,
        label: job.ship_owner_name || String(job.ship_owner_id),
      })
    }
    return results
  }, [partnerResults, job])

  const { data: seafarerResults } = useQuery({
    queryKey: ['seafarers-search', seafarerSearch],
    queryFn: () =>
      seafarerApi.list({ search: seafarerSearch || '', limit: 20 }).then((r) => r.data),
    enabled: assignOpen,
  })

  const { data: paymentData, isLoading: isPaymentLoading } = useQuery({
    queryKey: ['job-payments', id],
    queryFn: () => jobApi.listPayments(id).then((r) => r.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (values) =>
      jobApi.update(id, {
        ...values,
        start_date: values.start_date?.format?.('YYYY-MM-DD') || undefined,
        contract_date: values.contract_date?.format?.('YYYY-MM-DD') || undefined,
        end_date: values.end_date?.format?.('YYYY-MM-DD') || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setEditOpen(false)
      form.resetFields()
      message.success('Cập nhật thành công')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const paymentMutation = useMutation({
    mutationFn: async (values) => {
      const formData = new FormData()
      formData.append('payment_cycle_text', values.payment_cycle_text || '')
      formData.append('amount', values.amount || '')
      formData.append('paid_at', values.paid_at?.format?.('YYYY-MM-DD HH:mm:ss') || '')
      formData.append('notes', values.notes || '')
      if (paymentFileList[0]?.originFileObj) {
        formData.append('attachment', paymentFileList[0].originFileObj)
      }
      if (editingPayment?.id) {
        return jobApi.updatePaymentRecord(id, editingPayment.id, formData)
      }
      return jobApi.createPayment(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job-payments', id] })
      setPaymentModalOpen(false)
      setEditingPayment(null)
      setPaymentFileList([])
      paymentForm.resetFields()
      message.success('Đã lưu bản ghi thanh toán')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lưu thanh toán thất bại'),
  })

  const assignMutation = useMutation({
    mutationFn: (values) =>
      jobApi.assign(id, {
        seafarer_id: values.seafarer_id,
        join_date: values.join_date?.format?.('YYYY-MM-DD') || null,
        sign_off_date: values.sign_off_date?.format?.('YYYY-MM-DD') || null,
        contract_start_date: values.contract_start_date?.format?.('YYYY-MM-DD') || null,
        contract_end_date: values.contract_end_date?.format?.('YYYY-MM-DD') || null,
        salary: values.salary || null,
        salary_currency: values.salary_currency || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setAssignOpen(false)
      assignForm.resetFields()
      setSeafarerSearch('')
      message.success('Đã gán thuyền viên')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Gán thất bại'),
  })

  const editAssignMutation = useMutation({
    mutationFn: (values) =>
      deploymentApi.update(editingDeployment.id, {
        join_date: values.join_date?.format?.('YYYY-MM-DD') || null,
        sign_off_date: values.sign_off_date?.format?.('YYYY-MM-DD') || null,
        salary: values.salary || null,
        salary_actual: values.salary_actual || null,
        salary_currency: values.salary_currency || null,
        contract_start_date: values.contract_start_date?.format?.('YYYY-MM-DD') || null,
        contract_end_date: values.contract_end_date?.format?.('YYYY-MM-DD') || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      setEditAssignOpen(false)
      setEditingDeployment(null)
      message.success('Đã cập nhật thông tin gán')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => jobApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate('/jobs')
      message.success('Đã xóa job')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function openEdit() {
    form.setFieldsValue({
      ship_owner_id: job.ship_owner_id,
      vessel_id: job.vessel_id,
      rank_id: job.rank_id,
      payment_cycle: job.payment_cycle,
      start_date: job.start_date ? dayjs(job.start_date) : null,
      contract_date: job.contract_date ? dayjs(job.contract_date) : null,
      end_date: job.end_date ? dayjs(job.end_date) : null,
      amount: job.amount,
      currency: job.currency || 'VND',
      notes: job.notes,
      status: job.status,
    })
    setEditOpen(true)
  }

  function openCreatePayment() {
    setEditingPayment(null)
    paymentForm.resetFields()
    paymentForm.setFieldsValue({ paid_at: dayjs() })
    setPaymentFileList([])
    setPaymentModalOpen(true)
  }

  function openEditPayment(row) {
    setEditingPayment(row)
    paymentForm.setFieldsValue({
      payment_cycle_text: row.payment_cycle_text || '',
      amount: row.amount,
      paid_at: row.paid_at ? dayjs(row.paid_at) : null,
      notes: row.notes || '',
    })
    setPaymentFileList([])
    setPaymentModalOpen(true)
  }

  function handleDelete() {
    modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa job "${job.rank_code || ''}" trên tàu "${job.vessel_name || '-'}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(),
    })
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!job)
    return (
      <div style={{ marginTop: 80, textAlign: 'center', color: '#999' }}>Không tìm thấy job.</div>
    )

  const seafarerOptions = (seafarerResults?.data || []).map((s) => ({
    value: s.id,
    label: `${s.full_name}${s.seafarer_code ? ` (${s.seafarer_code})` : ''}${s.rank_code ? ` - ${s.rank_code}` : ''}`,
  }))
  const paymentRows = paymentData?.data || []
  const paymentColumns = [
    {
      title: 'Kỳ thanh toán',
      dataIndex: 'payment_cycle_text',
      render: (v) => v || '-',
    },
    {
      title: 'Số tiền thanh toán',
      dataIndex: 'amount',
      width: 170,
      render: (v) =>
        v != null ? `${Number(v).toLocaleString('vi-VN')} ${job.currency || 'VND'}` : '-',
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paid_at',
      width: 140,
      render: (v) => fmt(v),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      render: (v) => v || '-',
    },
    {
      title: 'Đính kèm',
      width: 140,
      render: (_, r) =>
        r.attachment_url ? (
          <Button
            size="small"
            type="link"
            icon={<DownloadOutlined />}
            href={r.attachment_url}
            target="_blank"
          >
            {r.attachment_original_name || 'Tải file'}
          </Button>
        ) : (
          '-'
        ),
    },
    {
      title: '',
      width: 90,
      render: (_, r) =>
        isReadOnly ? null : (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditPayment(r)}>
            Sửa
          </Button>
        ),
    },
  ]

  return (
    <div style={{ padding: isMobile ? '0 4px' : 0 }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#fff',
          borderBottom: '1px solid #E8E8E8',
          padding: isMobile ? '8px 12px' : '10px 0',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/jobs')} />
        <span
          style={{
            fontSize: isMobile ? 15 : 18,
            fontWeight: 600,
            color: '#262626',
            flex: 1,
            minWidth: 80,
            width: isMobile ? '100%' : 'auto',
            order: isMobile ? 2 : 'unset',
          }}
        >
          {job.rank_code || 'Job'} - {job.vessel_name || '-'}
        </span>
        <Tag
          color={STATUS_COLOR[job.status] || 'default'}
          style={{ margin: 0, order: isMobile ? 1 : 'unset' }}
        >
          {STATUS_LABEL[job.status] || job.status}
        </Tag>
        {!isReadOnly && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginLeft: isMobile ? 0 : 'auto',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 3 : 'unset',
            }}
          >
            <Button icon={<EditOutlined />} size={isMobile ? 'small' : 'middle'} onClick={openEdit}>
              {isMobile ? '' : 'Chỉnh sửa'}
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              size={isMobile ? 'small' : 'middle'}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {isMobile ? '' : 'Xóa'}
            </Button>
          </div>
        )}
      </div>

      <Section title="Thông tin công việc">
        <Descriptions
          column={isMobile ? 1 : 2}
          bordered
          size="small"
          styles={{ label: { width: 160, background: '#fafafa' } }}
        >
          <Descriptions.Item label="Tàu">{job.vessel_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Rank">{job.rank_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ngày ký HĐ">{fmt(job.contract_date)}</Descriptions.Item>
          <Descriptions.Item label="Ngày bắt đầu">{fmt(job.start_date)}</Descriptions.Item>
          <Descriptions.Item label="Ngày kết thúc">{fmt(job.end_date)}</Descriptions.Item>
          <Descriptions.Item label="Giá trị HĐ">
            {job.amount != null
              ? `${Number(job.amount).toLocaleString('vi-VN')} ${job.currency || 'VND'}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ghi chú" span={2}>
            {job.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Section>

      {job.vessel_id && (
        <Section title="Thông tin tàu">
          <Descriptions
            column={isMobile ? 1 : 2}
            bordered
            size="small"
            styles={{ label: { width: 160, background: '#fafafa' } }}
          >
            <Descriptions.Item label="Loại tàu">{job.vessel_type_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Loại máy">
              {[job.vessel_engine_maker, job.vessel_engine_model].filter(Boolean).join(' ') ||
                job.vessel_engine_type ||
                '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Công suất (kW)">
              {job.vessel_main_engine_kw != null
                ? Number(job.vessel_main_engine_kw).toLocaleString('vi-VN')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Cờ tàu">{job.vessel_flag || '-'}</Descriptions.Item>
            <Descriptions.Item label="Vùng hoạt động">
              {job.vessel_operating_area || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="GRT">
              {job.vessel_grt != null ? Number(job.vessel_grt).toLocaleString('vi-VN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="DWT">
              {job.vessel_dwt != null ? Number(job.vessel_dwt).toLocaleString('vi-VN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Section>
      )}

      <Section title="Thông tin đối tác">
        <Descriptions
          column={isMobile ? 1 : 2}
          bordered
          size="small"
          styles={{ label: { width: 160, background: '#fafafa' } }}
        >
          <Descriptions.Item label="Tên công ty">{job.ship_owner_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Người liên hệ">
            {job.partner_contact_person || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="SĐT liên hệ">
            {job.partner_contact_phone || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Email liên hệ">
            {job.partner_contact_email || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Section>

      {/* Lịch sử thuyền viên */}
      <Section
        title="Lịch sử thuyền viên"
        extra={
          !isReadOnly && (
            <Button
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => {
                assignForm.setFieldsValue({
                  join_date: job.start_date ? dayjs(job.start_date) : null,
                  sign_off_date: job.end_date ? dayjs(job.end_date) : null,
                  salary_currency: job.currency || 'USD',
                })
                setAssignOpen(true)
              }}
            >
              Gán thuyền viên
            </Button>
          )
        }
      >
        {job.seafarer_id && (
          <div style={{ marginBottom: 12, color: '#faad14', fontSize: 13 }}>
            Đang có thuyền viên đã nhận job này
          </div>
        )}
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={job.deployment_history || []}
          columns={[
            {
              title: 'Thuyền viên',
              dataIndex: 'seafarer_name',
              render: (v, r) => (
                <span
                  style={{ color: '#003366', cursor: 'pointer' }}
                  onClick={() => navigate(`/seafarers/${r.seafarer_id}`)}
                >
                  {v || '-'}
                </span>
              ),
            },
            { title: 'Mã TV', dataIndex: 'seafarer_code', render: (v) => v || '-' },
            { title: 'Rank', dataIndex: 'rank_code', render: (v) => v || '-' },
            { title: 'Ngày sign on', dataIndex: 'join_date', render: (v) => fmt(v) },
            { title: 'Ngày sign off', dataIndex: 'sign_off_date', render: (v) => fmt(v) },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (v) => {
                const map = {
                  collecting_docs: { color: 'default', label: 'Thu giấy tờ' },
                  confirmed: { color: 'blue', label: 'Đã chốt tàu' },
                  pre_boarding: { color: 'cyan', label: 'Chuẩn bị nhập tàu' },
                  onboard: { color: 'green', label: 'Đang tàu' },
                  signed_off: { color: 'orange', label: 'Đã rời tàu' },
                  cancelled: { color: 'red', label: 'Đã hủy' },
                }
                const item = map[v] || { color: 'default', label: v }
                return <Tag color={item.color}>{item.label}</Tag>
              },
            },
            {
              title: 'Lương',
              dataIndex: 'salary',
              render: (v, r) =>
                v != null ? `${Number(v).toLocaleString('vi-VN')} ${r.salary_currency || ''}` : '-',
            },
            {
              title: 'Thực nhận',
              dataIndex: 'salary_actual',
              render: (v, r) =>
                v != null ? `${Number(v).toLocaleString('vi-VN')} ${r.salary_currency || ''}` : '-',
            },
            {
              title: '',
              render: (_, r) => (
                <Space size={4}>
                  {!isReadOnly && (
                    <Button
                      size="small"
                      icon={<FormOutlined />}
                      title="Sửa thông tin gán"
                      onClick={() => {
                        setEditingDeployment(r)
                        editAssignForm.setFieldsValue({
                          contract_start_date: r.contract_start_date
                            ? dayjs(r.contract_start_date)
                            : null,
                          contract_end_date: r.contract_end_date
                            ? dayjs(r.contract_end_date)
                            : null,
                          join_date: r.join_date ? dayjs(r.join_date) : null,
                          sign_off_date: r.sign_off_date ? dayjs(r.sign_off_date) : null,
                          salary: r.salary ?? null,
                          salary_actual: r.salary_actual ?? null,
                          salary_currency: r.salary_currency || job.currency || 'USD',
                        })
                        setEditAssignOpen(true)
                      }}
                    />
                  )}
                  <a href={`/deployments/${r.id}`} style={{ fontSize: 13 }}>
                    Chi tiết
                  </a>
                </Space>
              ),
            },
          ]}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Chưa có lịch sử' }}
        />
      </Section>

      <Section title="Thông tin thanh toán">
        <Descriptions
          column={isMobile ? 1 : 2}
          bordered
          size="small"
          styles={{ label: { width: 160, background: '#fafafa' } }}
        >
          <Descriptions.Item label="Hoa hồng (%)">
            {job.commission_rate != null ? `${job.commission_rate}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Phương thức thanh toán">
            {PAYMENT_METHOD_LABEL[job.partner_payment_method] || job.partner_payment_method || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Tên tài khoản thanh toán">
            {job.partner_payment_account_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Số tài khoản thanh toán">
            {job.partner_payment_account_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngân hàng">
            {job.partner_payment_bank_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Chi nhánh">
            {job.partner_payment_bank_branch || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Điều khoản thanh toán" span={isMobile ? 1 : 2}>
            {job.partner_payment_terms || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Section>

      {/* Thanh toán */}
      <Section
        title="Thanh toán"
        extra={
          !isReadOnly && (
            <Button size="small" icon={<PlusOutlined />} onClick={openCreatePayment}>
              Thêm kỳ
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          columns={paymentColumns}
          dataSource={paymentRows}
          loading={isPaymentLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={false}
          locale={{ emptyText: 'Chưa có bản ghi thanh toán' }}
        />
      </Section>

      {/* Modal chỉnh sửa job */}
      <Modal
        title="Chỉnh sửa job"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setPartnerSearch('')
          form.resetFields()
        }}
        footer={null}
        width={isMobile ? '95vw' : 520}
      >
        <Form form={form} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="ship_owner_id" label="Tên công ty" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={setPartnerSearch}
              placeholder="Tìm tên công ty..."
              options={partnerOptions}
              notFoundContent="Không tìm thấy công ty"
            />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 16px',
            }}
          >
            <Form.Item name="vessel_id" label="Tàu">
              <Select
                showSearch
                allowClear
                placeholder="Chọn tàu"
                options={(vessels || []).map((v) => ({ value: v.id, label: v.vessel_name }))}
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name="rank_id" label="Rank" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Chọn Rank"
                options={(ranks || []).map((r) => ({ value: r.id, label: r.code }))}
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name="contract_date" label="Ngày ký HĐ">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="start_date" label="Ngày bắt đầu">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="end_date" label="Ngày kết thúc">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="amount" label="Giá trị HĐ">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
                parser={(v) => v?.replace(/[^\d]/g, '')}
              />
            </Form.Item>
            <Form.Item name="currency" label="Đơn vị tiền">
              <Select
                options={[
                  { value: 'VND', label: 'VND' },
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                ]}
              />
            </Form.Item>
            <Form.Item name="payment_cycle" label="Kỳ thanh toán">
              <Select
                options={Object.entries(PAYMENT_CYCLE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Trạng thái HĐ">
            <Select
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setEditOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal thêm/sửa thanh toán */}
      <Modal
        title={editingPayment ? 'Sửa kỳ thanh toán' : 'Thêm kỳ thanh toán'}
        open={paymentModalOpen}
        onCancel={() => {
          setPaymentModalOpen(false)
          setEditingPayment(null)
          setPaymentFileList([])
          paymentForm.resetFields()
        }}
        footer={null}
        width={isMobile ? '95vw' : 520}
      >
        <Form form={paymentForm} layout="vertical" onFinish={(v) => paymentMutation.mutate(v)}>
          <Form.Item
            name="payment_cycle_text"
            label="Kỳ thanh toán"
            rules={[{ required: true, message: 'Nhập kỳ thanh toán' }]}
          >
            <Input placeholder="VD: Kỳ 1 tháng 04/2026 hoặc Theo chuyến tháng 4" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Số tiền thanh toán"
            rules={[{ required: true, message: 'Nhập số tiền thanh toán' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
              parser={(v) => v?.replace(/[^\d]/g, '')}
            />
          </Form.Item>
          <Form.Item name="paid_at" label="Ngày thanh toán">
            <DatePicker format={{ format: 'DD/MM/YYYY', type: 'mask' }} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Đính kèm file (nếu có)">
            <Upload
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              beforeUpload={() => false}
              maxCount={1}
              fileList={paymentFileList}
              onChange={({ fileList }) => setPaymentFileList(fileList)}
            >
              <Button>Chọn file</Button>
            </Upload>
            {editingPayment?.attachment_url && (
              <div style={{ marginTop: 8 }}>
                <Button
                  size="small"
                  type="link"
                  icon={<DownloadOutlined />}
                  href={editingPayment.attachment_url}
                  target="_blank"
                >
                  {editingPayment.attachment_original_name || 'Xem file hiện tại'}
                </Button>
              </div>
            )}
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setPaymentModalOpen(false)
                  setEditingPayment(null)
                  setPaymentFileList([])
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={paymentMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal gán thuyền viên */}
      <Modal
        title="Gán thuyền viên vào job"
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false)
          assignForm.resetFields()
          setSeafarerSearch('')
        }}
        footer={null}
        width={isMobile ? '95vw' : 420}
      >
        <Form form={assignForm} layout="vertical" onFinish={(v) => assignMutation.mutate(v)}>
          <Form.Item
            name="seafarer_id"
            label="Tìm thuyền viên"
            rules={[{ required: true, message: 'Chọn thuyền viên' }]}
          >
            <Select
              showSearch
              placeholder="Tìm theo tên hoặc mã thuyền viên..."
              filterOption={false}
              onSearch={setSeafarerSearch}
              options={seafarerOptions}
              notFoundContent="Không có kết quả"
            />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 12px',
            }}
          >
            <Form.Item name="join_date" label="Ngày sign on">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="sign_off_date" label="Ngày sign off">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 12px',
            }}
          >
            <Form.Item name="salary" label="Lương HĐ">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
                parser={(v) => v?.replace(/[^\d]/g, '')}
                placeholder="0"
              />
            </Form.Item>
            <Form.Item name="salary_currency" label="Đơn vị tiền tệ" initialValue="USD">
              <Select
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'VND', label: 'VND' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item>
            <Space>
              <Button onClick={() => setAssignOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={assignMutation.isPending}>
                Gán
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal sửa thông tin gán thuyền viên */}
      <Modal
        title="Sửa thông tin gán thuyền viên"
        open={editAssignOpen}
        onCancel={() => {
          setEditAssignOpen(false)
          setEditingDeployment(null)
        }}
        footer={null}
        width={isMobile ? '95vw' : 420}
      >
        <Form
          form={editAssignForm}
          layout="vertical"
          onFinish={(v) => editAssignMutation.mutate(v)}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 12px',
            }}
          >
            <Form.Item name="join_date" label="Ngày sign on">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="sign_off_date" label="Ngày sign off">
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 12px',
            }}
          >
            <Form.Item name="salary" label="Lương HĐ">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
                parser={(v) => v?.replace(/[^\d]/g, '')}
                placeholder="0"
              />
            </Form.Item>
            <Form.Item name="salary_currency" label="Đơn vị tiền tệ" initialValue="USD">
              <Select
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'VND', label: 'VND' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setEditAssignOpen(false)
                  setEditingDeployment(null)
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={editAssignMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
