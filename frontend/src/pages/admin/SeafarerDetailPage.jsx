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
  Checkbox,
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
import useToast from '../../components/ds/useToast'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import ProfileSeaService from './seafarers/ProfileSeaService'
import CertificateTable from '../../components/ds/CertificateTable'
import { toTableCerts } from './seafarers/certificateView'
import { documentApi } from '../../api/documentApi'
import { attentionItems, activeContract, headLine } from './seafarers/profileView'
import { readinessLevel, readinessRules } from './exports/packModel'
import './exports/exports.css'
import ProfileOverview from './seafarers/ProfileOverview'
import ProfileHistory from './seafarers/ProfileHistory'
import ProfileExports from './seafarers/ProfileExports'
import CrewPhoto from './seafarers/CrewPhoto'
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
  AVAILABLE: 'Ở bờ',
  ON_VESSEL: 'Đang trên tàu',
  ON_LEAVE: 'Nghỉ phép',
  TRAINING: 'Đang đào tạo',
  BLACKLISTED: 'Blacklist',
  RETIRED: 'Đã nghỉ hưu',
  INACTIVE: 'Không hoạt động',
}




const PROFILE_TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'docs', label: 'Chứng chỉ' },
  { value: 'service', label: 'Đi tàu' },
  { value: 'training', label: 'Đào tạo' },
  { value: 'exports', label: 'Đã xuất' },
  { value: 'history', label: 'Lịch sử' },
]

function AttentionSection({ items, reviewTo }) {
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
              {item.kind === 'review' && <Link to={reviewTo}>Mở màn duyệt</Link>}
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
  const { data: photo } = useQuery({
    queryKey: ['seafarer-photo', id, seafarer?.updated_at],
    queryFn: () =>
      seafarerApi.getPhoto(id).then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          })
      ),
    enabled: Boolean(seafarer?.has_photo),
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
        <div className="crew-head"><Skeleton.Avatar active shape="square" style={{ width: 96, height: 128, borderRadius: 0 }} /><Skeleton active title paragraph={{ rows: 1 }} /></div>
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
  const rules = readinessRules({ seafarer, certificates: certList, contracts: contractList, pendingReview: certList.filter((c) => c.status === 'PENDING').length })
  const readiness = readinessLevel(rules)
  const failing = rules.filter((rule) => rule.result !== 'PASS')
  const RULE_ACTIONS = {
    edit: ['Sửa hồ sơ', () => navigate(`/seafarers/${id}/edit`)],
    service: ['Xem đi tàu', () => setTab('service')],
    review: ['Duyệt', () => navigate(`/seafarers/${id}/review`)],
    upload: ['Tải giấy tờ lên', () => dropFiles()],
  }
  const READINESS_TEXT = {
    BLOCKED: `Chưa xuất được: ${failing.filter((r) => r.result === 'FAIL').length} điều kiện không đạt.`,
    NEEDS_REVIEW: 'Xuất được, nhưng còn chỗ chưa duyệt. Người duyệt bản xuất sẽ thấy cảnh báo.',
    READY_IN_SCOPE: 'Đủ điều kiện xuất theo các mẫu trong phạm vi MVP.',
  }
  const createPack = () => navigate(`/exports/new?seafarer=${id}`)
  const dropFiles = () => navigate(`/seafarers/${id}/upload`)
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
    count: item.value === 'docs' ? certList.length : null,
  }))

  const bodies = {
    overview: (
      <>
        <AttentionSection items={attention} reviewTo={`/seafarers/${id}/review`} />
        <ProfileOverview seafarer={seafarer} seafarerId={id} />
        <WorkSection s={seafarer} />
      </>
    ),
    docs: (
      <CertificatesSection seafarerId={id} />
    ),
    service: (
      <>
        <ProfileSeaService seafarerId={id} />
        <ContractsSection seafarerId={id} />
      </>
    ),
    training: <EnrollmentsSection seafarerId={id} />,
    exports: (
      <>
        <ProfileExports seafarerId={Number(id)} canCreate={readiness !== 'BLOCKED'} blockedReason={readiness === 'BLOCKED' ? 'Hồ sơ đang bị chặn, xem mục kiểm tra phía trên' : undefined} />
        <Section title="Xuất lẻ từng mẫu">
          <FormExportTab seafarerId={parseInt(id)} seafarerName={seafarer.full_name} />
        </Section>
      </>
    ),
    history: <ProfileHistory seafarerId={id} />,
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
          <CrewPhoto size="xl" src={photo} />
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
          <Button icon={<SendOutlined />} disabled={readiness === 'BLOCKED'} title={readiness === 'BLOCKED' ? 'Hồ sơ đang bị chặn, xem mục kiểm tra bên dưới' : undefined} onClick={createPack}>Tạo bộ giấy</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={dropFiles}>Tải giấy tờ lên</Button>
        </div>
      </div>

      <div role={readiness === 'BLOCKED' ? 'alert' : 'status'} className={`ds-banner ds-banner--${{ BLOCKED: 'error', NEEDS_REVIEW: 'warning', READY_IN_SCOPE: 'neutral' }[readiness]}`}>
        <div className="ds-banner__body">
          <p className="ds-banner__title"><StatusBadge group="readiness" value={readiness} /> {READINESS_TEXT[readiness]}</p>
          {failing.length > 0 && (
            <ul className="rules">
              {failing.map((rule) => (
                <li key={rule.title} className="rule">
                  <span className="rule__mark"><StatusBadge group="rule" value={rule.result} /></span>
                  <span className="rule__text">
                    <span>{rule.title}</span>
                    {rule.reason && <span className="rule__reason">{rule.reason}</span>}
                  </span>
                  {rule.action && <Button size="small" onClick={RULE_ACTIONS[rule.action][1]}>{RULE_ACTIONS[rule.action][0]}</Button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {readiness === 'READY_IN_SCOPE' && <div className="ds-banner__action"><Button onClick={createPack}>Tạo bộ giấy</Button></div>}
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
      styles={{ label: { width: 160, background: 'var(--background)' } }}
    >
      {fields.map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {value ?? '-'}
        </Descriptions.Item>
      ))}
    </Descriptions>
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

function CertificatesSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null) // null | 'new' | dòng chứng chỉ
  const [certFile, setCertFile] = useState(null)
  const [form] = Form.useForm()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', seafarerId],
    queryFn: () => certificateApi.list(seafarerId).then((r) => r.data),
  })

  const { data: certTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: () => lookupApi.certificateTypes().then((r) => r.data),
  })

  const close = () => { setEditing(null); form.resetFields(); setCertFile(null) }
  const saved = (text) => () => {
    toast.success(text)
    close()
    queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
  }
  const failed = (text) => (e) => toast.error(e.response?.data?.error || text)

  const saveMutation = useMutation({
    mutationFn: async ({ row, values }) => {
      const noExpiry = Boolean(values.no_expiry)
      const payload = {
        certificate_type_id: values.certificate_type_id,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD') || undefined,
        expiry_date: noExpiry ? undefined : values.expiry_date?.format?.('YYYY-MM-DD') || undefined,
        no_expiry: noExpiry,
      }
      if (row) {
        await certificateApi.update(seafarerId, row.id, { ...payload, expiry_date: payload.expiry_date || null, issued_date: payload.issued_date || null })
        if (certFile) await certificateApi.upload(seafarerId, row.id, certFile)
        return row
      }
      const cert = (await certificateApi.create(seafarerId, payload)).data
      if (certFile && cert?.id) await certificateApi.upload(seafarerId, cert.id, certFile)
      return cert
    },
    onSuccess: (_, { row }) => saved(row ? 'Đã lưu chứng chỉ' : 'Đã thêm chứng chỉ')(),
    onError: failed('Không lưu được chứng chỉ'),
  })

  const deleteMutation = useMutation({
    mutationFn: (certId) => certificateApi.remove(seafarerId, certId),
    onSuccess: saved('Đã xoá chứng chỉ'),
    onError: failed('Xoá thất bại'),
  })

  function handleDeleteCert(row) {
    Modal.confirm({
      title: 'Xoá chứng chỉ?',
      content: `Bạn có chắc muốn xoá chứng chỉ "${row.display_name}"?`,
      okText: 'Xoá',
      cancelText: 'Huỷ',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(row.id),
    })
  }

  function startEdit(row) {
    setEditing(row)
    form.setFieldsValue({
      certificate_type_id: row.certificate_type_id,
      certificate_number: row.certificate_number,
      issued_date: row.issued_date ? dayjs(row.issued_date) : null,
      expiry_date: row.expiry_date ? dayjs(row.expiry_date) : null,
      no_expiry: Boolean(row.no_expiry),
    })
  }

  async function openSource(cert) {
    if (!cert.uploadId) return toast.error('Chứng chỉ này không còn bản gốc.')
    try {
      const blob = await documentApi.uploadFile(cert.uploadId)
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (e) {
      failed('Không mở được bản gốc')(e)
    }
  }

  const rows = data?.data || []
  const isNew = editing === 'new'
  const noExpiry = Form.useWatch('no_expiry', form)

  return (
    <Section title={<>Chứng chỉ {rows.length ? <span className="ds-num">{rows.length}</span> : null}</>} noPad extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing('new') }}>Thêm chứng chỉ</Button>}>
      {isLoading ? (
        <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có chứng chỉ nào" description="Bấm Tải giấy tờ lên ở đầu hồ sơ. Chứng chỉ duyệt xong sẽ hiện ở đây." />
      ) : (
        <CertificateTable
          certs={toTableCerts(rows)}
          onEdit={(cert) => startEdit(cert.raw)}
          onOpenSource={openSource}
        />
      )}
      <Modal
        title={isNew ? 'Thêm chứng chỉ' : 'Sửa chứng chỉ'}
        open={editing !== null}
        onCancel={close}
        footer={null}
        width={440}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate({ row: isNew ? null : editing, values: v })}>
          <Form.Item name="certificate_type_id" label="Loại chứng chỉ" rules={[{ required: true, message: 'Chọn loại chứng chỉ' }]}>
            <Select
              placeholder="Chọn loại"
              showSearch
              optionFilterProp="label"
              options={(certTypes?.data || certTypes || []).map((c) => ({ value: c.id, label: c.name_vi || c.name }))}
            />
          </Form.Item>
          <Form.Item name="certificate_number" label="Số chứng chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp" rules={[{ required: true, message: 'Nhập ngày cấp' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Có giá trị đến" rules={[{ required: !noExpiry, message: 'Nhập hạn hoặc đánh dấu không thời hạn' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={Boolean(noExpiry)} />
          </Form.Item>
          <Form.Item name="no_expiry" valuePropName="checked">
            <Checkbox>Không thời hạn</Checkbox>
          </Form.Item>
          <Form.Item label="File đính kèm">
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              {isNew ? <span /> : <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteCert(editing)}>Xoá chứng chỉ</Button>}
              <Space>
                <Button onClick={close}>Huỷ</Button>
                <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>Lưu</Button>
              </Space>
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
    <Section
      title="Hợp đồng"
      noPad
      extra={<Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm hợp đồng</Button>}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={isLoading}
        locale={{ emptyText: <EmptyState title="Chưa có hợp đồng nào" /> }}
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
    queryFn: () => courseApi.listAll(),
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
    <Section
      title="Đào tạo"
      noPad
      extra={<Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm đăng ký</Button>}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        locale={{ emptyText: <EmptyState title="Chưa đăng ký khoá học nào" /> }}
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
