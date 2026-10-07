import { useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Table,
  Spin,
  Grid,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  App,
  Dropdown,
  Skeleton,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  MoreOutlined,
  RightOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  seafarerApi,
  enrollmentApi,
  certificateApi,
  contractApi,
  lookupApi,
  courseApi,
} from '../../api'
import ZaloButton from '../../components/common/ZaloButton'
import FormExportTab from '../../components/seafarer/FormExportTab'
import dayjs from 'dayjs'
import StatusBadge from '../../components/ds/StatusBadge'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import CrewDropzone from './seafarers/CrewDropzone'
import { attentionItems, activeContract, headLine, openFilePicker } from './seafarers/profileView'
import { nameInitials } from './seafarers/crewView'
import './seafarers/SeafarerListPage.css'
import './seafarers/SeafarerProfile.css'

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




const PROFILE_TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'docs', label: 'Giấy tờ' },
  { value: 'service', label: 'Đi tàu' },
  { value: 'training', label: 'Đào tạo' },
  { value: 'exports', label: 'Đã xuất' },
]

function AttentionSection({ items }) {
  return (
    <Section title="Cần chú ý">
      {items.length ? (
        <ul className="crew-attention">
          {items.map((item) => (
            <li key={item.text}>
              {item.kind === 'review' ? (
                <span className="crew-pending"><EllipsisOutlined aria-hidden />Chờ duyệt</span>
              ) : (
                <StatusBadge group="cert" value={item.state} />
              )}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="crew-muted">Giấy tờ còn hạn, không có gì chờ duyệt.</p>
      )}
    </Section>
  )
}

export default function SeafarerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const [tab, setTab] = useState('overview')
  const pageRef = useRef(null)

  const { data: seafarer, isLoading, isError, refetch } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })
  const { data: certificates } = useQuery({
    queryKey: ['certificates', id],
    queryFn: () => certificateApi.list(id).then((r) => r.data),
    enabled: !!seafarer,
  })
  const { data: contracts } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => contractApi.list(id).then((r) => r.data),
    enabled: !!seafarer,
  })

  const deleteMutation = useMutation({
    mutationFn: () => seafarerApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa thuyền viên')
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      navigate('/seafarers')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete() {
    modal.confirm({
      title: `Xoá thuyền viên ${seafarer?.full_name}?`,
      content: 'Hồ sơ, giấy tờ và lịch sử đi tàu của người này sẽ bị ẩn khỏi danh sách.',
      okText: 'Xoá thuyền viên',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: () => deleteMutation.mutateAsync(),
    })
  }

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton.Avatar active size={64} /><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !seafarer) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được hồ sơ' : 'Không tìm thấy thuyền viên'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Hồ sơ có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/seafarers')}>Về danh sách</Button>}
      />
    )
  }

  const certList = Array.isArray(certificates) ? certificates : certificates?.data || []
  const contractList = contracts?.data || []
  const attention = attentionItems(seafarer, certList)
  const expired = attention.filter((item) => item.state === 'EXPIRED').length
  const expiring = attention.filter((item) => item.state === 'EXPIRING').length
  const firstName = seafarer.full_name.trim().split(/\s+/).slice(-1)[0]
  const dropFiles = () => {
    if (tab !== 'overview' && tab !== 'docs') setTab('docs')
    setTimeout(() => openFilePicker(pageRef.current), 0)
  }
  const moreMenu = {
    items: [
      { key: 'edit', icon: <EditOutlined />, label: 'Sửa thông tin' },
      { type: 'divider' },
      { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá thuyền viên', danger: true },
    ],
    onClick: ({ key }) => (key === 'edit' ? navigate(`/seafarers/${id}/edit`) : handleDelete()),
  }
  const tabs = PROFILE_TABS.map((item) => ({
    ...item,
    count: item.value === 'docs' ? certList.length : item.value === 'service' ? contractList.length : null,
  }))

  const bodies = {
    overview: (
      <>
        <CrewDropzone firstName={firstName} />
        <div className="crew-two-col">
          <ProfileSection s={seafarer} />
          <AttentionSection items={attention} />
        </div>
        <WorkSection s={seafarer} />
        <ContactsSection seafarerId={id} />
        <FinanceSection s={seafarer} />
        <PhysicalSection s={seafarer} />
      </>
    ),
    docs: (
      <>
        <CrewDropzone firstName={firstName} />
        <CertificatesSection seafarerId={id} />
      </>
    ),
    service: <ContractsSection seafarerId={id} />,
    training: <EnrollmentsSection seafarerId={id} />,
    exports: (
      <Section title="Xuất biểu mẫu">
        <FormExportTab seafarerId={parseInt(id)} seafarerName={seafarer.full_name} />
      </Section>
    ),
  }

  return (
    <div className="ds-page crew-profile" ref={pageRef}>
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/seafarers">Thuyền viên</Link>
        <RightOutlined aria-hidden />
        <span aria-current="page">{seafarer.full_name}</span>
      </nav>

      <div className="crew-head">
        <div className="crew-head__person">
          <span className="crew-avatar crew-avatar--xl" aria-hidden>{nameInitials(seafarer.full_name)}</span>
          <div className="crew-head__text">
            <h1 className="crew-head__title">{seafarer.full_name}</h1>
            <p className="crew-head__desc">{headLine(seafarer, activeContract(contractList)) || seafarer.seafarer_code}</p>
            <div className="crew-head__badges">
              <StatusBadge group="crew" value={seafarer.status} />
              {expired > 0 && <span className="crew-docs crew-docs--error">{expired} giấy tờ hết hạn</span>}
              {!expired && expiring > 0 && <span className="crew-docs crew-docs--warning">{expiring} sắp hết hạn</span>}
            </div>
          </div>
        </div>
        <div className="crew-head__actions">
          <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={deleteMutation.isPending} />
          </Dropdown>
          <Button icon={<SendOutlined />} onClick={() => setTab('exports')}>Xuất hồ sơ</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={dropFiles}>Thả giấy tờ</Button>
        </div>
      </div>

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      {bodies[tab]}
    </div>
  )
}

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

function Section({ title, children, noPad, extra }) {
  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <h2 className="crew-panel__title">{title}</h2>
        {extra}
      </div>
      <div className={noPad ? undefined : 'crew-panel__body'}>{children}</div>
    </section>
  )
}

function DescList({ fields, isMobile }) {
  return (
    <Descriptions
      column={isMobile ? 1 : 2}
      bordered
      size="small"
      styles={{ label: { width: 160, background: '#fafafa' } }}
    >
      {fields.map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {value ?? '-'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

function ProfileSection({ s }) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const fields = [
    ['Mã thuyền viên', s.seafarer_code],
    ['Họ và tên', s.full_name],
    ['Họ tên (EN)', s.full_name_en],
    ['Ngày sinh', fmt(s.date_of_birth)],
    ['Giới tính', s.gender === 'M' ? 'Nam' : s.gender === 'F' ? 'Nữ' : '-'],
    ['Tình trạng hôn nhân', s.marital_status],
    ['Số con', s.children_count != null ? s.children_count : '-'],
    ['Thông tin con', s.children_info],
    ['Tuổi con', s.children_ages],
    ['CCCD', s.national_id],
    ['Ngày cấp CCCD', fmt(s.national_id_issued_date)],
    ['Nơi cấp CCCD', s.national_id_issued_place],
    ['Hộ chiếu', s.passport_number],
    ['Ngày cấp HC', fmt(s.passport_issued_date)],
    ['Sổ thuyền viên', s.seaman_book_number],
    ['Chức danh', s.rank_name],
    ['Chức danh (VI)', s.rank_name_vi],
    ['Quốc tịch', s.nationality_name],
    [
      'SĐT',
      s.phone_primary ? (
        <span>
          {s.phone_primary}
          <ZaloButton phone={s.phone_primary} />
        </span>
      ) : (
        '-'
      ),
    ],
    ['Email', s.email],
    ['Quê quán - Xã', s.permanent_ward],
    ['Quê quán - Huyện', s.permanent_district],
    ['Quê quán - Tỉnh', s.permanent_province],
    ['Nơi thường trú', s.permanent_address],
  ]
  return (
    <Section title="Hồ sơ cá nhân">
      <DescList fields={fields} isMobile={isMobile} />
    </Section>
  )
}

function WorkSection({ s }) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const fields = [
    ['Khối', s.vessel_group],
    ['Tên tàu', s.vessel_name_raw],
    ['Ngày bay', fmt(s.contract_flight_date)],
    ['Ngày nhập tàu', fmt(s.contract_start_date)],
    ['Thời gian HĐ', s.contract_duration_raw],
    ['Lương HĐ', s.contract_salary_raw != null ? s.contract_salary_raw.toLocaleString() : '-'],
    ['Ngày rời tàu', fmt(s.contract_end_date)],
    ['Ngày về VN', fmt(s.contract_return_date)],
    [
      'BHXH',
      s.social_insurance_joined === 1 ? 'Có' : s.social_insurance_joined === 0 ? 'Không' : '-',
    ],
    ['Số sổ BHXH', s.social_insurance_number],
  ]
  return (
    <Section title="Công tác">
      <DescList fields={fields} isMobile={isMobile} />
    </Section>
  )
}

function FinanceSection({ s }) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const fields = [
    ['Số tài khoản', s.bank_account_number],
    ['Ngân hàng', s.bank_name],
    ['Chủ tài khoản', s.bank_account_holder],
  ]
  return (
    <Section title="Tài chính">
      <DescList fields={fields} isMobile={isMobile} />
    </Section>
  )
}

function PhysicalSection({ s }) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const fields = [
    ['Chiều cao (cm)', s.height_cm],
    ['Cân nặng (kg)', s.weight_kg],
    ['Size áo', s.shirt_size],
    ['Size quần', s.pants_size],
  ]
  return (
    <Section title="Thể chất">
      <DescList fields={fields} isMobile={isMobile} />
    </Section>
  )
}

function ContactsSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['seafarer-contacts', seafarerId],
    queryFn: () => seafarerApi.getContacts(seafarerId).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      seafarerApi.createContact(seafarerId, {
        ...values,
        date_of_birth: values.date_of_birth?.format?.('YYYY-MM-DD') || undefined,
        guarantor_id_issued_date:
          values.guarantor_id_issued_date?.format?.('YYYY-MM-DD') || undefined,
        is_guarantor: values.is_guarantor ? 1 : 0,
        is_emergency_contact: values.is_emergency_contact ? 1 : 0,
      }),
    onSuccess: () => {
      message.success('Thêm liên hệ thành công')
      setAddOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (contactId) => seafarerApi.deleteContact(seafarerId, contactId),
    onSuccess: () => {
      message.success('Đã xóa liên hệ')
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete(row) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa liên hệ "${row.full_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  const columns = [
    {
      title: 'Loại',
      render: (r) =>
        r.is_guarantor ? <Tag color="orange">Bảo lãnh</Tag> : <Tag color="blue">Liên lạc</Tag>,
    },
    { title: 'Họ tên', dataIndex: 'full_name' },
    { title: 'Quan hệ', dataIndex: 'relationship' },
    {
      title: 'SĐT',
      dataIndex: 'phone_primary',
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
    { title: 'CCCD', dataIndex: 'national_id' },
    { title: 'Ngày sinh', dataIndex: 'date_of_birth', render: (v) => fmt(v) },
    { title: 'Số CCCD bảo lãnh', dataIndex: 'guarantor_id_number' },
    { title: 'Ngày cấp', dataIndex: 'guarantor_id_issued_date', render: (v) => fmt(v) },
    {
      title: '',
      width: 60,
      render: (_, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
      ),
    },
  ]

  return (
    <Section title="Người thân / Bảo lãnh" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Thêm liên hệ
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Thêm người thân / Bảo lãnh"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="relationship" label="Quan hệ" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'Vợ', label: 'Vợ' },
                { value: 'Chồng', label: 'Chồng' },
                { value: 'Bố', label: 'Bố' },
                { value: 'Mẹ', label: 'Mẹ' },
                { value: 'Con', label: 'Con' },
                { value: 'Anh/Chị/Em', label: 'Anh/Chị/Em' },
                { value: 'Khác', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="phone_primary" label="SĐT">
            <Input />
          </Form.Item>
          <Form.Item name="national_id" label="CCCD">
            <Input />
          </Form.Item>
          <Form.Item name="date_of_birth" label="Ngày sinh">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_guarantor" label="Vai trò">
            <Select
              options={[
                { value: false, label: 'Liên lạc khẩn cấp' },
                { value: true, label: 'Người bảo lãnh' },
              ]}
            />
          </Form.Item>
          <Form.Item name="guarantor_id_number" label="Số CCCD bảo lãnh">
            <Input />
          </Form.Item>
          <Form.Item name="guarantor_id_issued_date" label="Ngày cấp CCCD bảo lãnh">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="guarantor_id_issued_place" label="Nơi cấp CCCD bảo lãnh">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setAddOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  )
}

function certExpiryStatus(expiryDate) {
  if (!expiryDate) return { color: 'default', label: '-' }
  const d = dayjs(expiryDate)
  if (d.isBefore(dayjs(), 'day')) return { color: 'red', label: 'Hết hạn' }
  if (d.diff(dayjs(), 'day') <= 30) return { color: 'orange', label: 'Sắp hết hạn' }
  return { color: 'green', label: 'Còn hiệu lực' }
}

function CertificatesSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [certFile, setCertFile] = useState(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', seafarerId],
    queryFn: () => certificateApi.list(seafarerId).then((r) => r.data),
  })

  const { data: certTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: () => lookupApi.certificateTypes().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        certificate_type_id: values.certificate_type_id,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD') || values.issued_date,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
      }
      const res = await certificateApi.create(seafarerId, payload)
      const cert = res.data
      if (certFile && cert?.id) {
        await certificateApi.upload(seafarerId, cert.id, certFile)
      }
      return cert
    },
    onSuccess: () => {
      message.success('Thêm chứng chỉ thành công')
      setAddOpen(false)
      form.resetFields()
      setCertFile(null)
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm chứng chỉ thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (certId) => certificateApi.remove(seafarerId, certId),
    onSuccess: () => {
      message.success('Đã xóa chứng chỉ')
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDeleteCert(row) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa chứng chỉ "${row.certificate_type_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  const columns = [
    { title: 'Loại chứng chỉ', dataIndex: 'certificate_type_name' },
    { title: 'Số chứng chỉ', dataIndex: 'certificate_number' },
    { title: 'Ngày cấp', dataIndex: 'issued_date', render: (v) => fmt(v) },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expiry_date',
      render: (v) => {
        const s = certExpiryStatus(v)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v) => (
        <Tag color={v === 'VALID' ? 'green' : v === 'EXPIRED' ? 'red' : 'default'}>{v}</Tag>
      ),
    },
    {
      title: 'File',
      dataIndex: 'document_url',
      render: (v) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer">
            Xem
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteCert(r)} />
      ),
    },
  ]

  return (
    <Section title="Chứng chỉ" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Thêm chứng chỉ
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Thêm chứng chỉ"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
          setCertFile(null)
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="certificate_type_id" label="Loại chứng chỉ" rules={[{ required: true }]}>
            <Select
              placeholder="Chọn loại"
              options={(certTypes?.data || certTypes || []).map((c) => ({
                value: c.id,
                label: c.name_vi || c.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="certificate_number" label="Số chứng chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Ngày hết hạn">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="File đính kèm">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setAddOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  )
}

function contractStatus(startDate, endDate) {
  const now = dayjs()
  const start = startDate ? dayjs(startDate) : null
  const end = endDate ? dayjs(endDate) : null
  if (!start && !end) return { color: 'default', label: '-' }
  if (end && now.isAfter(end)) return { color: 'default', label: 'Kết thúc' }
  if (start && now.isBefore(start)) return { color: 'blue', label: 'Sắp bắt đầu' }
  return { color: 'green', label: 'Đang hiệu lực' }
}

function ContractsSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [vesselSearch, setVesselSearch] = useState('')
  const [form] = Form.useForm()
  const [formEdit] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', seafarerId],
    queryFn: () => contractApi.list(seafarerId).then((r) => r.data),
  })

  const { data: vessels } = useQuery({
    queryKey: ['vessels-lookup', vesselSearch],
    queryFn: () => lookupApi.vessels(vesselSearch || undefined).then((r) => r.data),
    enabled: addOpen || editOpen,
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      contractApi
        .create({
          seafarer_id: Number(seafarerId),
          vessel_id: values.vessel_id || undefined,
          start_date: values.start_date?.format?.('YYYY-MM-DD') || values.start_date,
          end_date: values.end_date?.format?.('YYYY-MM-DD') || values.end_date,
          salary: values.salary ? Number(values.salary) : undefined,
          notes: values.notes,
        })
        .then((r) => r.data),
    onSuccess: () => {
      message.success('Thêm hợp đồng thành công')
      setAddOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['contracts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm hợp đồng thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) =>
      contractApi
        .update(id, {
          start_date: values.start_date?.format?.('YYYY-MM-DD') ?? values.start_date,
          end_date: values.end_date?.format?.('YYYY-MM-DD') ?? values.end_date,
          salary: values.salary ? Number(values.salary) : undefined,
          notes: values.notes,
        })
        .then((r) => r.data),
    onSuccess: () => {
      message.success('Cập nhật hợp đồng thành công')
      setEditOpen(false)
      setEditingContract(null)
      formEdit.resetFields()
      queryClient.invalidateQueries({ queryKey: ['contracts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (contractId) => contractApi.remove(contractId),
    onSuccess: () => {
      message.success('Đã xóa hợp đồng')
      queryClient.invalidateQueries({ queryKey: ['contracts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function openEdit(row) {
    setEditingContract(row)
    formEdit.setFieldsValue({
      start_date: row.start_date ? dayjs(row.start_date) : null,
      end_date: row.end_date ? dayjs(row.end_date) : null,
      salary: row.salary,
      notes: row.notes,
    })
    setEditOpen(true)
  }

  function handleDeleteContract(row) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa hợp đồng "${row.vessel_name || 'Hợp đồng'}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  const columns = [
    { title: 'Tên tàu', dataIndex: 'vessel_name', render: (v) => v || '-' },
    { title: 'Ngày lên tàu', dataIndex: 'start_date', render: (v) => fmt(v) },
    { title: 'Ngày rời tàu', dataIndex: 'end_date', render: (v) => fmt(v) },
    { title: 'Lương', dataIndex: 'salary', render: (v) => (v != null ? v.toLocaleString() : '-') },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, r) => {
        const s = contractStatus(r.start_date, r.end_date)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteContract(r)}
          />
        </Space>
      ),
    },
  ]

  const list = data?.data || []

  return (
    <Section title="Hợp đồng" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Thêm hợp đồng
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Thêm hợp đồng"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="vessel_id" label="Tàu">
            <Select
              showSearch
              allowClear
              placeholder="Tìm tên tàu..."
              filterOption={false}
              onSearch={setVesselSearch}
              options={(vessels || []).map((v) => ({ value: v.id, label: v.vessel_name }))}
            />
          </Form.Item>
          <Form.Item name="start_date" label="Ngày lên tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="Ngày rời tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="salary" label="Lương">
            <Input type="number" placeholder="Số" />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setAddOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Chỉnh sửa hợp đồng"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setEditingContract(null)
          formEdit.resetFields()
        }}
        footer={null}
        width={440}
      >
        <Form
          form={formEdit}
          layout="vertical"
          onFinish={(v) =>
            editingContract && updateMutation.mutate({ id: editingContract.id, values: v })
          }
        >
          <Form.Item name="start_date" label="Ngày lên tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="Ngày rời tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="salary" label="Lương">
            <Input type="number" />
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
    </Section>
  )
}

function EnrollmentsSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', { seafarer_id: seafarerId }],
    queryFn: () => enrollmentApi.list({ seafarer_id: seafarerId }).then((r) => r.data),
  })

  const { data: courses } = useQuery({
    queryKey: ['courses-all'],
    queryFn: () => courseApi.list({ limit: 200 }).then((r) => r.data),
    enabled: addOpen,
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      enrollmentApi.create({
        seafarer_id: Number(seafarerId),
        course_id: values.course_id,
        enrollment_date: values.enrollment_date?.format?.('YYYY-MM-DD') || undefined,
        notes: values.notes,
      }),
    onSuccess: () => {
      message.success('Đăng ký khóa học thành công')
      setAddOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['enrollments', { seafarer_id: seafarerId }] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Đăng ký thất bại'),
  })

  const columns = [
    { title: 'Khóa học', dataIndex: 'course_name' },
    { title: 'Mã khóa', dataIndex: 'course_code' },
    { title: 'Ngày đăng ký', dataIndex: 'enrollment_date', render: (v) => fmt(v) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v) =>
        v ? (
          <Tag color={v === 'APPROVED' ? 'green' : v === 'REJECTED' ? 'red' : 'blue'}>{v}</Tag>
        ) : (
          '-'
        ),
    },
    { title: 'Điểm', dataIndex: 'total_score' },
    { title: 'Xếp loại', dataIndex: 'grade' },
    {
      title: 'Kết quả',
      dataIndex: 'result',
      render: (v) => (v ? <Tag color={v === 'PASS' ? 'green' : 'red'}>{v}</Tag> : '-'),
    },
  ]

  return (
    <Section title="Đào tạo" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Thêm đăng ký
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Đăng ký khóa học"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item
            name="course_id"
            label="Khóa học"
            rules={[{ required: true, message: 'Chọn khóa học' }]}
          >
            <Select
              showSearch
              placeholder="Chọn khóa học"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={(courses?.data || []).map((c) => ({
                value: c.id,
                label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="enrollment_date" label="Ngày đăng ký">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setAddOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Đăng ký
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  )
}
