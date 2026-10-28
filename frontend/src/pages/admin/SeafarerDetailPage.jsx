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
} from '../../api'
import FormExportTab from '../../components/seafarer/FormExportTab'
import dayjs from 'dayjs'
import StatusBadge from '../../components/ds/StatusBadge'
import useToast from '../../components/ds/useToast'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import ProfileSeaService from './seafarers/ProfileSeaService'
import CertificateTable from '../../components/ds/CertificateTable'
import { expiryAlerts, supersededIds } from './seafarers/certificateView'
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
import DocumentsSection from './seafarers/DocumentsSection'
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
  { value: 'docs', label: 'Giấy tờ' },
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
  const dropFiles = () => navigate(`/seafarers/${id}/upload`)
  const moreItems = [
    ...(can('seafarer.update') ? [seafarer.status === 'INACTIVE' ? { key: 'activate', icon: <PlayCircleOutlined />, label: 'Kích hoạt lại' } : { key: 'deactivate', icon: <PauseCircleOutlined />, label: 'Tạm ngưng thuyền viên' }] : []),
    ...(can('seafarer.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá thuyền viên', danger: true }] : []),
  ]
  const moreMenu = {
    items: moreItems,
    onClick: ({ key }) => (key === 'delete' ? handleDelete() : handleToggleActive()),
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
      <DocumentsSection seafarerId={id} seafarer={seafarer} photo={photo} dismissed={dismissed} onDismiss={dismissAlerts} onRestore={restoreAlert} onUploadMany={dropFiles} />
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
