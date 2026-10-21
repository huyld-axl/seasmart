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
  certificateApi,
  lookupApi,
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
import { attentionItems, activeContract, headLine, toProfileContracts } from './seafarers/profileView'
import { useContractList } from '../../hooks/useVoyages'
import { readinessLevel, readinessRules } from './exports/packModel'
import './exports/exports.css'
import { useCan } from '../../hooks/usePermission'
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
}
const STATUS_LABEL = {
  AVAILABLE: 'Ở bờ',
  ON_VESSEL: 'Đang trên tàu',
}




const PROFILE_TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'docs', label: 'Chứng chỉ' },
  { value: 'service', label: 'Đi tàu' },
  { value: 'exports', label: 'Đã xuất' },
  { value: 'history', label: 'Lịch sử' },
]

function AttentionSection({ items, reviewTo, canReview }) {
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
              {item.kind === 'review' && canReview && <Link to={reviewTo}>Mở màn duyệt</Link>}
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
  const can = useCan()

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
  const { data: contracts } = useContractList({ seafarer_id: Number(id), limit: 100 }, { enabled: !!seafarer && can('contract.view') })

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
  const contractList = toProfileContracts(contracts?.data)
  const attention = attentionItems(seafarer, certList)
  const expired = attention.filter((item) => item.state === 'EXPIRED').length
  const expiring = attention.filter((item) => item.state === 'EXPIRING').length
  const rules = readinessRules({ seafarer, certificates: certList, contracts: contractList, pendingReview: certList.filter((c) => c.status === 'PENDING').length })
  const readiness = readinessLevel(rules)
  const failing = rules.filter((rule) => rule.result !== 'PASS')
  // [nhãn, hành động, quyền cần có]
  const RULE_ACTIONS = {
    edit: ['Sửa hồ sơ', () => navigate(`/seafarers/${id}/edit`), 'seafarer.update'],
    service: ['Xem đi tàu', () => setTab('service')],
    review: ['Duyệt', () => navigate(`/seafarers/${id}/review`), 'seafarer.docs'],
    upload: ['Tải giấy tờ lên', () => dropFiles(), 'seafarer.docs'],
  }
  const READINESS_TEXT = {
    BLOCKED: `Chưa xuất được: ${failing.filter((r) => r.result === 'FAIL').length} điều kiện không đạt.`,
    NEEDS_REVIEW: 'Xuất được, nhưng còn chỗ chưa duyệt. Người duyệt bản xuất sẽ thấy cảnh báo.',
    READY_IN_SCOPE: 'Đủ điều kiện xuất theo các mẫu trong phạm vi MVP.',
  }
  const createPack = () => navigate(`/exports/new?seafarer=${id}`)
  const dropFiles = () => navigate(`/seafarers/${id}/upload`)
  const moreItems = [
    ...(can('seafarer.update') ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa thông tin' }] : []),
    ...(can('seafarer.update') && can('seafarer.delete') ? [{ type: 'divider' }] : []),
    ...(can('seafarer.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá thuyền viên', danger: true }] : []),
  ]
  const moreMenu = {
    items: moreItems,
    onClick: ({ key }) => (key === 'edit' ? navigate(`/seafarers/${id}/edit`) : handleDelete()),
  }
  // Tab Đã xuất cần export.view; phần Hợp đồng ở tab Đi tàu cần contract.view.
  const TAB_PERM = { exports: 'export.view' }
  const tabs = PROFILE_TABS.filter((item) => !TAB_PERM[item.value] || can(TAB_PERM[item.value])).map((item) => ({
    ...item,
    count: item.value === 'docs' ? certList.length : null,
  }))

  const bodies = {
    overview: (
      <>
        <AttentionSection items={attention} reviewTo={`/seafarers/${id}/review`} canReview={can('seafarer.docs')} />
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
        {can('contract.view') ? <ContractsSection seafarerId={id} /> : null}
      </>
    ),
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
          {moreItems.length > 0 && (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={deleteMutation.isPending} />
            </Dropdown>
          )}
          {can('export.create') && (
            <Button icon={<SendOutlined />} disabled={readiness === 'BLOCKED'} title={readiness === 'BLOCKED' ? 'Hồ sơ đang bị chặn, xem mục kiểm tra bên dưới' : undefined} onClick={createPack}>Tạo bộ giấy</Button>
          )}
          {can('seafarer.docs') && <Button type="primary" icon={<UploadOutlined />} onClick={dropFiles}>Tải giấy tờ lên</Button>}
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
                  {rule.action && (!RULE_ACTIONS[rule.action][2] || can(RULE_ACTIONS[rule.action][2])) && <Button size="small" onClick={RULE_ACTIONS[rule.action][1]}>{RULE_ACTIONS[rule.action][0]}</Button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {readiness === 'READY_IN_SCOPE' && can('export.create') && <div className="ds-banner__action"><Button onClick={createPack}>Tạo bộ giấy</Button></div>}
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
  const can = useCan()
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
    <Section title={<>Chứng chỉ {rows.length ? <span className="ds-num">{rows.length}</span> : null}</>} noPad extra={can('seafarer.update') ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing('new') }}>Thêm chứng chỉ</Button> : null}>
      {isLoading ? (
        <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có chứng chỉ nào" description="Bấm Tải giấy tờ lên ở đầu hồ sơ. Chứng chỉ duyệt xong sẽ hiện ở đây." />
      ) : (
        <CertificateTable
          certs={toTableCerts(rows)}
          onEdit={can('seafarer.update') ? (cert) => startEdit(cert.raw) : undefined}
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

// Khối "Hợp đồng" chỉ đọc: hợp đồng tạo từ chuyến tàu (xem /voyages), ở đây chỉ liệt kê.
function ContractsSection({ seafarerId }) {
  const { data, isLoading } = useContractList({ seafarer_id: Number(seafarerId), limit: 100 })
  const rows = data?.data || []
  return (
    <Section title="Hợp đồng" noPad>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Chưa có hợp đồng. Hợp đồng tạo từ chuyến tàu.' }}
        columns={[
          { title: 'Số hợp đồng', dataIndex: 'contract_number', render: (value, row) => <Link to={`/contracts/${row.id}`}>{value}</Link> },
          {
            title: 'Tàu · chuyến',
            key: 'vessel',
            render: (_, row) => (
              <span>
                {row.vessel_name} · <Link to={`/voyages/${row.voyage_id}`}>{row.voyage_code}</Link>
              </span>
            ),
          },
          { title: 'Thời gian', key: 'dates', render: (_, row) => `${fmt(row.start_date)} → ${fmt(row.end_date)}` },
          { title: 'Trạng thái', dataIndex: 'status', render: (value) => <StatusBadge group="contract" value={value} /> },
        ]}
      />
    </Section>
  )
}
