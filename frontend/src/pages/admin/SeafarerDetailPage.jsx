import { useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Table,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  DatePicker,
  Space,
  App,
  Dropdown,
  Skeleton,
} from 'antd'
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, CloseOutlined, DownOutlined, ScanOutlined, PauseCircleOutlined, PlayCircleOutlined, EditOutlined, EllipsisOutlined, MoreOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import { DownloadIcon, UploadIcon } from '../../components/ds/TransferIcons'
import {
  seafarerApi,
  certificateApi,
  certificateTypeApi,
  lookupApi,
} from '../../api'
import FormExportTab from '../../components/seafarer/FormExportTab'
import dayjs from 'dayjs'
import StatusBadge from '../../components/ds/StatusBadge'
import useToast from '../../components/ds/useToast'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import ProfileSeaService from './seafarers/ProfileSeaService'
import CertificateTable from '../../components/ds/CertificateTable'
import { expiryAlerts, supersededIds, toTableCerts } from './seafarers/certificateView'
import { documentApi } from '../../api/documentApi'
import Banner from '../../components/ds/Banner'
import ScanButton from '../../components/ds/ScanButton'
import { ZaloActions, EmailActions, PhoneActions } from '../../components/ds/ContactActions'
import { attentionItems, headLine, toProfileContracts, voyageNow } from './seafarers/profileView'
import { useContractList, useVoyageList } from '../../hooks/useVoyages'
import { readinessLevel, readinessRules } from './exports/packModel'
import './exports/exports.css'
import { useCan } from '../../hooks/usePermission'
import { BackButton } from './fleet/FleetParts'
import ProfileOverview, { NoteBox } from './seafarers/ProfileOverview'
import ProfileHistory from './seafarers/ProfileHistory'
import ProfileExports from './seafarers/ProfileExports'
import CrewPhoto from './seafarers/CrewPhoto'
import './seafarers/SeafarerListPage.css'
import './seafarers/SeafarerProfile.css'
import './contracts/contracts.css'


const STATUS_COLOR = {
  AVAILABLE: 'green',
  ON_VESSEL: 'blue',
}
const STATUS_LABEL = {
  AVAILABLE: 'Ở bờ',
  ON_VESSEL: 'Đang trên tàu',
}




const NOW_LABEL = { current: 'Chuyến', last: 'Chuyến gần nhất' }

const PROFILE_TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'docs', label: 'Chứng chỉ' },
  { value: 'service', label: 'Đi tàu' },
  { value: 'exports', label: 'Đã xuất' },
  { value: 'history', label: 'Lịch sử' },
]

export default function SeafarerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { modal } = App.useApp()
  const [tab, setTab] = useState('overview')
  const pageRef = useRef(null)
  const can = useCan()
  const [dismissed, setDismissed] = useState(() => loadDismissed(id))
  const saveDismissed = (next) => {
    setDismissed(next)
    try { localStorage.setItem(dismissKey(id), JSON.stringify(next)) } catch { /* trình duyệt chặn lưu thì chỉ đổi lần này */ }
  }
  const dismissAlerts = (items) => saveDismissed({ ...dismissed, ...Object.fromEntries(items.map((i) => [i.id, i.expiry])) })
  const restoreAlert = (certId) => saveDismissed(Object.fromEntries(Object.entries(dismissed).filter(([key]) => String(key) !== String(certId))))

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
  const { data: voyages } = useVoyageList({ seafarer_id: Number(id), tab: 'all', limit: 100 }, { enabled: !!seafarer && can('voyage.view') })

  const deleteMutation = useMutation({
    mutationFn: () => seafarerApi.remove(id),
    onSuccess: () => {
      toast.success(`Đã xoá thuyền viên ${seafarer?.full_name || ''}`.trim())
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      navigate('/seafarers')
    },
    onError: (e) => toast.error('Không xoá được thuyền viên', { description: e.response?.data?.error }),
  })

  const activeMutation = useMutation({
    mutationFn: (active) => (active ? seafarerApi.activate(id) : seafarerApi.deactivate(id)),
    onSuccess: (_, active) => {
      toast.success(active ? 'Đã kích hoạt lại thuyền viên' : 'Đã tạm ngưng thuyền viên')
      queryClient.invalidateQueries({ queryKey: ['seafarer', id] })
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      queryClient.invalidateQueries({ queryKey: ['revisions', id] })
    },
    onError: (e) => toast.error('Không đổi được trạng thái', { description: e.response?.data?.error || e.response?.data?.message }),
  })

  function handleToggleActive() {
    const active = seafarer?.status === 'INACTIVE'
    modal.confirm({
      title: active ? `Kích hoạt lại ${seafarer?.full_name}?` : `Tạm ngưng ${seafarer?.full_name}?`,
      content: active
        ? 'Thuyền viên về trạng thái Ở bờ và có thể được xếp vào hợp đồng mới.'
        : 'Thuyền viên sẽ không được chọn khi tạo hợp đồng. Hồ sơ vẫn giữ nguyên, kích hoạt lại bất cứ lúc nào.',
      okText: active ? 'Kích hoạt lại' : 'Tạm ngưng',
      cancelText: 'Huỷ',
      onOk: () => activeMutation.mutateAsync(active),
    })
  }

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
  const nowVoyage = voyageNow(voyages?.data)
  const certAlerts = expiryAlerts(certList, { dismissed })
  const replaced = supersededIds(certList)
  const liveCerts = certList.filter((c) => !replaced.has(c.id))
  const attention = attentionItems(seafarer, liveCerts)
  const expired = attention.filter((item) => item.state === 'EXPIRED').length
  const rules = readinessRules({ seafarer, contracts: contractList, pendingReview: certList.filter((c) => c.status === 'PENDING').length })
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
  }
  const createPack = () => navigate(`/exports/new?seafarer=${id}`)
  const dropFiles = () => navigate(`/seafarers/${id}/upload`)
  const moreItems = [
    ...(can('export.create') ? [{ key: 'pack', icon: <SendOutlined />, label: 'Tạo bộ giấy', disabled: readiness === 'BLOCKED', title: readiness === 'BLOCKED' ? 'Hồ sơ đang bị chặn, xem mục kiểm tra bên dưới' : undefined }] : []),
    ...((can('export.create') && (can('seafarer.update') || can('seafarer.delete'))) ? [{ type: 'divider' }] : []),
    ...(can('seafarer.update') ? [seafarer.status === 'INACTIVE' ? { key: 'activate', icon: <PlayCircleOutlined />, label: 'Kích hoạt lại' } : { key: 'deactivate', icon: <PauseCircleOutlined />, label: 'Tạm ngưng thuyền viên' }] : []),
    ...(can('seafarer.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá thuyền viên', danger: true }] : []),
  ]
  const moreMenu = {
    items: moreItems,
    onClick: ({ key }) => (key === 'pack' ? createPack() : key === 'delete' ? handleDelete() : handleToggleActive()),
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
        <ProfileOverview seafarer={seafarer} seafarerId={id} />
      </>
    ),
    docs: (
      <CertificatesSection seafarerId={id} dismissed={dismissed} onDismiss={dismissAlerts} onRestore={restoreAlert} />
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
        <BackButton />
        <Link to="/seafarers">Thuyền viên</Link>
        <RightOutlined aria-hidden />
        <span aria-current="page">{seafarer.full_name}</span>
      </nav>

      <div className="crew-head">
        <div className="crew-head__person">
          <div className="crew-head__photo">
            <CrewPhoto size="xl" src={photo} />
            {photo && (
              <Button size="small" className="crew-head__download" icon={<DownloadIcon />} href={photo} download={`${seafarer.seafarer_code || seafarer.id} - ${seafarer.full_name}.${photo.startsWith('data:image/png') ? 'png' : 'jpg'}`}>Tải ảnh</Button>
            )}
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{seafarer.full_name}</h1>
              <StatusBadge group="crew" value={seafarer.status} />
              {expired > 0 && <span className="crew-docs crew-docs--error">{expired} giấy tờ hết hạn</span>}
            </div>
            <p className="crew-head__desc">{headLine(seafarer) || seafarer.seafarer_code}</p>
            <dl className="crew-head__meta">
              {nowVoyage && (
                <>
                  <dt>Tàu</dt>
                  <dd>
                    {can('vessel.view') && nowVoyage.row.vessel_id ? <Link to={`/vessels/${nowVoyage.row.vessel_id}`}>{nowVoyage.row.vessel_name}</Link> : nowVoyage.row.vessel_name}
                  </dd>
                  <dt>{NOW_LABEL[nowVoyage.kind]}</dt>
                  <dd>
                    <Link to={`/voyages/${nowVoyage.row.voyage_id}`}>{nowVoyage.row.voyage_code}</Link>
                    {nowVoyage.row.rank_name && nowVoyage.row.rank_name !== seafarer.rank_name ? ` · ${nowVoyage.row.rank_name}` : ''}
                    {nowVoyage.kind === 'current' ? ` · đến ${fmt(nowVoyage.row.end_date)}` : ` · ${fmt(nowVoyage.row.start_date)} → ${fmt(nowVoyage.row.end_date)}`}
                  </dd>
                </>
              )}
              {seafarer.phone_primary && (
                <>
                  <dt>Điện thoại</dt>
                  <dd>{seafarer.phone_primary}<PhoneActions phone={seafarer.phone_primary} /></dd>
                </>
              )}
              {seafarer.zalo && <><dt>Zalo</dt><dd>{seafarer.zalo}<ZaloActions value={seafarer.zalo} /></dd></>}
              {seafarer.email && (
                <>
                  <dt>Email</dt>
                  <dd>{seafarer.email}<EmailActions email={seafarer.email} /></dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <NoteBox seafarer={seafarer} seafarerId={id} className="sf-note--head" />
        <div className="crew-head__actions">
          {moreItems.length > 0 && (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={deleteMutation.isPending || activeMutation.isPending} />
            </Dropdown>
          )}
          {can('seafarer.update') && <Button icon={<EditOutlined />} onClick={() => navigate(`/seafarers/${id}/edit`)}>Sửa thông tin</Button>}
          {can('seafarer.docs') && <Button type="primary" icon={<UploadIcon />} onClick={dropFiles}>Tải giấy tờ lên</Button>}
        </div>
      </div>

      {readiness !== 'READY_IN_SCOPE' && (
      <div role={readiness === 'BLOCKED' ? 'alert' : 'status'} className={`ds-banner ds-banner--${{ BLOCKED: 'error', NEEDS_REVIEW: 'warning' }[readiness]}`}>
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
      </div>
      )}

      <ExpiryAlert tone="error" onDismiss={dismissAlerts} items={certAlerts.expired} title={(n) => `${n} chứng chỉ đã quá hạn`} line={(i) => `quá hạn ${-i.days} ngày (hết hạn ${i.expiresOn})`} />
      <ExpiryAlert tone="warning" onDismiss={dismissAlerts} items={certAlerts.expiring} title={(n) => `${n} chứng chỉ sắp hết hạn trong 60 ngày tới`} line={(i) => (i.days === 0 ? `hết hạn hôm nay (${i.expiresOn})` : `còn ${i.days} ngày (hết hạn ${i.expiresOn})`)} />

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

// Khung cảnh báo hạn chứng chỉ ở đầu tab. Tắt được: tắt cả các chứng chỉ đang liệt kê.
function ExpiryAlert({ tone, items, title, line, onDismiss }) {
  if (!items.length) return null
  return (
    <Banner tone={tone} title={title(items.length)} action={<Button size="small" icon={<CloseOutlined />} onClick={() => onDismiss(items)}>Tắt cảnh báo</Button>}>
      <ul className="crew-certs__alerts">
        {items.map((i) => <li key={i.id}><b>{i.name}</b> · {line(i)}</li>)}
      </ul>
    </Banner>
  )
}

// Cảnh báo đã tắt nhớ trong trình duyệt theo thuyền viên: { [id chứng chỉ]: hạn lúc tắt }.
const dismissKey = (seafarerId) => `cert-alert-dismissed:${seafarerId}`
function loadDismissed(seafarerId) {
  try { return JSON.parse(localStorage.getItem(dismissKey(seafarerId))) || {} } catch { return {} }
}

function CertificatesSection({ seafarerId, dismissed, onDismiss, onRestore }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const can = useCan()
  const [editing, setEditing] = useState(null) // null | 'new' | dòng chứng chỉ
  const quickScanInput = useRef(null)
  const [newType, setNewType] = useState('')
  const [creatingType, setCreatingType] = useState(false)
  const [renewing, setRenewing] = useState(null) // chứng chỉ đang được cập nhật bằng bản mới (editing = 'new')
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

  const close = () => { setEditing(null); setRenewing(null); form.resetFields(); setCertFile(null) }
  const saved = (text) => () => {
    toast.success(text)
    close()
    queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
  }
  const failed = (text) => (e) => toast.error(text, { description: e.response?.data?.error || 'Thử lại sau ít phút.' })

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

  // Tạo nhanh loại chứng chỉ ngay trong ô chọn loại; mã tự sinh từ tên.
  async function createType() {
    const name = newType.trim()
    if (!name || creatingType) return
    setCreatingType(true)
    try {
      const code = `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().slice(0, 40)}_${Date.now().toString(36).toUpperCase().slice(-4)}`
      const created = await certificateTypeApi.create({ code, name_vi: name, name_en: name })
      await queryClient.invalidateQueries({ queryKey: ['certificate-types'] })
      form.setFieldValue('certificate_type_id', created.id)
      setNewType('')
      toast.success(`Đã tạo loại "${name}"`)
    } catch (e) {
      failed('Không tạo được loại chứng chỉ')(e)
    } finally {
      setCreatingType(false)
    }
  }

  // Cập nhật = tạo chứng chỉ mới, điền sẵn loại và số của bản cũ. Bản mới có hạn muộn hơn thì bản cũ hết cảnh báo.
  function startRenew(cert) {
    setRenewing(cert.raw)
    setEditing('new')
    form.resetFields()
    form.setFieldsValue({ certificate_type_id: cert.raw.certificate_type_id, certificate_number: cert.raw.certificate_number })
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
    if (!cert.uploadId) return toast.error('Chứng chỉ này không còn bản gốc')
    try {
      const blob = await documentApi.uploadFile(cert.uploadId)
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (e) {
      failed('Không mở được bản gốc')(e)
    }
  }

  async function downloadCert(cert) {
    try {
      const blob = cert.uploadId ? await documentApi.uploadFile(cert.uploadId) : await certificateApi.file(seafarerId, cert.id)
      const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = cert.fileName || `${cert.name}${cert.number !== '—' ? ` - ${cert.number}` : ''}.${ext}`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (e) {
      failed('Không tải được chứng chỉ')(e)
    }
  }

  const certTypeList = certTypes?.data || certTypes || []
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState('')
  async function scanCertificate(file) {
    setScanning(true)
    try {
      const result = await documentApi.scan(file, 'certificate')
      const got = Object.fromEntries((result.fields || []).map((item) => [item.field, item.value]))
      const type = certTypeList.find((c) => c.code === got.certificate_type_code)
      const values = {
        ...(type ? { certificate_type_id: type.id } : {}),
        ...(got.certificate_number ? { certificate_number: got.certificate_number } : {}),
        ...(got.issued_date ? { issued_date: dayjs(got.issued_date) } : {}),
        ...(got.expiry_date ? { expiry_date: dayjs(got.expiry_date) } : {}),
        ...(got.no_expiry ? { no_expiry: true, expiry_date: null } : {}),
      }
      if (!Object.keys(values).length) {
        toast.warning('Không đọc được ô nào từ giấy này', { description: 'Thử ảnh rõ hơn hoặc nhập tay.' })
        return
      }
      form.setFieldsValue(values)
      setCertFile(file)
      setScanDone(`Đã điền ${Object.keys(values).length} ô`)
      setTimeout(() => setScanDone(''), 5000)
      if (!type) toast.warning('Chưa nhận ra loại chứng chỉ', { description: 'Chọn loại tay rồi kiểm tra các ô còn lại.' })
    } catch (e) {
      failed('Không đọc được chứng chỉ')(e)
    } finally {
      setScanning(false)
    }
  }

  const rows = data?.data || []
  const isNew = editing === 'new'
  const noExpiry = Form.useWatch('no_expiry', form)

  return (
    <section className="ct-block" aria-label="Chứng chỉ">
      <div className="crew-certs__head">
        <h3 className="crew-certs__title">Danh sách chứng chỉ</h3>
        {can('seafarer.update') ? (
          <Space.Compact>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing('new') }}>Thêm chứng chỉ</Button>
            {can('seafarer.docs') ? (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{ items: [{ key: 'scan', icon: <ScanOutlined />, label: 'Quét chứng chỉ' }], onClick: () => quickScanInput.current?.click() }}
              >
                <Button type="primary" icon={<DownOutlined />} aria-label="Thêm chứng chỉ theo cách khác" />
              </Dropdown>
            ) : null}
          </Space.Compact>
        ) : null}
        <input
          ref={quickScanInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            form.resetFields()
            setEditing('new')
            scanCertificate(file)
          }}
        />
      </div>
      {isLoading ? (
        <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có chứng chỉ nào" description="Bấm Tải giấy tờ lên ở đầu hồ sơ. Chứng chỉ duyệt xong sẽ hiện ở đây." />
      ) : (
        <CertificateTable
          certs={toTableCerts(rows, { dismissed })}
          onDismiss={(cert) => onDismiss([{ id: cert.id, expiry: String(cert.raw.expiry_date).slice(0, 10) }])}
          onRestore={(cert) => onRestore(cert.id)}
          onRenew={can('seafarer.update') ? startRenew : undefined}
          onEdit={can('seafarer.update') ? (cert) => startEdit(cert.raw) : undefined}
          onOpenSource={openSource}
          onDownload={downloadCert}
        />
      )}
      <Modal
        title={renewing ? `Cập nhật chứng chỉ: ${renewing.display_name}` : isNew ? 'Thêm chứng chỉ' : 'Sửa chứng chỉ'}
        open={editing !== null}
        onCancel={close}
        footer={null}
        width={440}
        destroyOnHidden
      >
        {isNew && can('seafarer.docs') ? (
          <div className="crew-certs__scan">
            <ScanButton
              label="Quét chứng chỉ"
              loading={scanning}
              doneText={scanDone || undefined}
              onPick={(files) => scanCertificate(files[0])}
            />
          </div>
        ) : null}
        {renewing ? <p className="crew-certs__renew">Nhập thông tin bản mới. Khi bản mới có hạn muộn hơn, cảnh báo của bản cũ sẽ tự tắt.</p> : null}
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate({ row: isNew ? null : editing, values: v })}>
          <Form.Item name="certificate_type_id" label="Loại chứng chỉ" rules={[{ required: true, message: 'Chọn loại chứng chỉ' }]}>
            <Select
              allowClear
              placeholder="Chọn loại"
              showSearch
              optionFilterProp="label"
              options={certTypeList.map((c) => ({ value: c.id, label: c.name_vi || c.name }))}
              popupRender={(menu) => (can('catalog.update') ? (
                <>
                  {menu}
                  <div className="crew-certs__newtype">
                    <Input size="small" value={newType} maxLength={200} placeholder="Tên loại chứng chỉ mới" onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.stopPropagation()} onPressEnter={createType} />
                    <Button size="small" type="primary" icon={<PlusOutlined />} disabled={!newType.trim()} loading={creatingType} onClick={createType}>Tạo nhanh</Button>
                  </div>
                </>
              ) : menu)}
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
    </section>
  )
}

// Khối "Hợp đồng" chỉ đọc: hợp đồng tạo từ chuyến tàu (xem /voyages), ở đây chỉ liệt kê.
function ContractsSection({ seafarerId }) {
  const can = useCan()
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
                {can('vessel.view') && row.vessel_id ? <Link to={`/vessels/${row.vessel_id}`}>{row.vessel_name}</Link> : row.vessel_name} · <Link to={`/voyages/${row.voyage_id}`}>{row.voyage_code}</Link>
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
