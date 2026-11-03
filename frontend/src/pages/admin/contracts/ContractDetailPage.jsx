import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Skeleton, Table } from 'antd'
import dayjs from 'dayjs'
import { CloseCircleFilled } from '@ant-design/icons'
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FlagOutlined, LockOutlined, MoreOutlined, PrinterOutlined, RollbackOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import AuditTimeline from '../../../components/ds/AuditTimeline'
import Banner from '../../../components/ds/Banner'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useBillList, useContract, useContractMutations } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatDateTime, formatUsd } from '../../../utils/format'
import { ContractSvg, Crumb, FleetTile } from '../fleet/FleetParts'
import ApproveModal from './ApproveModal'
import TripLink from '../voyages/TripLink'
import BalanceCard from './BalanceCard'
import DealTable from './DealTable'
import RejectModal from './RejectModal'
import TermsTable from './TermsTable'
import { itemRows } from './contractView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerForm.css'
import '../seafarers/SeafarerProfile.css'
import '../voyages/voyages.css'
import '../fleet/fleet.css'
import './contracts.css'

const CONTRACT_TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'bills', label: 'Yêu cầu thanh toán' },
  { value: 'history', label: 'Lịch sử' },
]
const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`
const LOG_VIEW = {
  CREATE: { title: 'Tạo hợp đồng', kind: 'upload', tone: 'neutral' },
  SUBMIT: { title: 'Xin duyệt', kind: 'export', tone: 'warning' },
  WITHDRAW: { title: 'Thôi xin duyệt', kind: 'withdraw', tone: 'neutral' },
  REJECT: { title: 'Từ chối', kind: 'reject', tone: 'error' },
  APPROVE: { title: 'Duyệt · có hiệu lực', kind: 'accept', tone: 'success' },
  REVERT: { title: 'Đưa về Nháp', kind: 'withdraw', tone: 'warning' },
  END: { title: 'Kết thúc hợp đồng', kind: 'accept', tone: 'neutral' },
  APPLY_BILLS: { title: 'Áp thay đổi yêu cầu thanh toán', kind: 'edit', tone: 'warning' },
  DELETE: { title: 'Xoá theo chuyến', kind: 'reject', tone: 'error' },
}

function Field({ label, children, span }) {
  return (
    <div className={`sf-ro${span ? ` sf-c${span}` : ''}`}>
      <dt className="sf-ro__label">{label}</dt>
      <dd className="sf-ro__value">{children || <span className="sf-ro__empty">Không có</span>}</dd>
    </div>
  )
}

export default function ContractDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [dialog, setDialog] = useState(null)
  const [tab, setTab] = useState('overview')
  const { data, isLoading, isError, refetch } = useContract(id)
  const awaiting = Boolean(data?.awaiting_reapproval)
  const hasBills = (data?.bills_summary?.count || 0) > 0
  const bills = useBillList({ contract_id: id, limit: 100 }, { enabled: hasBills && can('bill.view') })
  const { submit, withdraw, remove, revert, end } = useContractMutations()

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 6 }} /></div>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được hợp đồng' : 'Không tìm thấy hợp đồng'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Hợp đồng có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/contracts')}>Về danh sách</Button>}
      />
    )
  }

  const { contract, seafarer, position, balance, log } = data
  // Chuyến mới (hợp đồng gắn chuyến); hợp đồng cũ chưa nối chuyến chỉ có chuyến cũ.
  const trip = data.voyage
  const place = data.voyage || data.legacy_voyage
  const legacyCode = data.legacy_voyage?.code
  const billCount = data.bills_summary.count
  const number = contract.contract_number
  const status = contract.status
  const locked = ['PENDING', 'ACTIVE', 'ENDED'].includes(status)
  const lastOf = (action) => log.find((entry) => entry.action === action)
  const items = [...itemRows(data.items).MONTHLY, ...itemRows(data.items).ONE_TIME]

  async function run(mutation, id, message) {
    try {
      await mutation.mutateAsync(id)
      toast.success(message)
    } catch (error) {
      toast.error(`Không cập nhật được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  function handleDelete() {
    modal.confirm({
      title: `Xoá hợp đồng ${number}?`,
      content: 'Hợp đồng nháp sẽ bị xoá.',
      okText: 'Xoá hợp đồng',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await remove.mutateAsync(contract.id)
          toast.success(`Đã xoá hợp đồng ${number}`)
          navigate('/contracts')
        } catch (error) {
          toast.error(`Không xoá được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }

  // Màn 8 · Đưa về Nháp: chỉ đổi trạng thái, bill giữ nguyên.
  function handleRevert() {
    modal.confirm({
      title: `Đưa ${number} về Nháp?`,
      content: `Hợp đồng mở lại để sửa. ${billCount} yêu cầu thanh toán giữ nguyên cho tới khi duyệt lại. Sau khi sửa cần xin duyệt và duyệt lại.`,
      okText: 'Đưa về Nháp',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await revert.mutateAsync(contract.id)
          toast.success(`Đã đưa hợp đồng ${number} về Nháp`)
        } catch (error) {
          toast.error(`Không đưa được hợp đồng ${number} về Nháp`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }

  // Màn 13 · Kết thúc hợp đồng: thay cho job tự kết thúc. Ngày kết thúc còn ở tương lai thì cảnh báo nhưng vẫn cho kết thúc.
  function handleEnd() {
    const early = dayjs(contract.end_date).isAfter(dayjs(), 'day')
    modal.confirm({
      title: `Kết thúc ${number}?`,
      content: (
        <>
          <p>Hợp đồng chuyển sang Đã kết thúc, không mở lại được. Ngày kết thúc {formatDate(contract.end_date)} và {billCount} yêu cầu thanh toán giữ nguyên.</p>
          {early ? <Banner tone="warning" title="Ngày kết thúc còn ở tương lai" description={`Hợp đồng kết thúc sớm hơn ngày ${formatDate(contract.end_date)} ghi trên hợp đồng. Muốn rút ngắn bill thì đưa về Nháp, sửa ngày kết thúc trước.`} /> : null}
        </>
      ),
      okText: 'Kết thúc hợp đồng',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await end.mutateAsync(contract.id)
          toast.success(`Đã kết thúc hợp đồng ${number}`)
        } catch (error) {
          toast.error(`Không kết thúc được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }

  const edit = <Button key="edit" icon={<EditOutlined />} onClick={() => navigate(`/contracts/${contract.id}/edit`)}>Sửa hợp đồng</Button>
  const allActions = {
    DRAFT: [
      // Đã có bill (từng Hiệu lực) thì không xoá được.
      ...(billCount ? [] : [
        <Dropdown key="more" menu={{ items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá hợp đồng', danger: true }], onClick: handleDelete }} trigger={['click']} placement="bottomRight">
          <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
        </Dropdown>,
      ]),
      ...(contract.legacy_unlinked ? [] : [edit]),
      <Button key="submit" type="primary" icon={<SendOutlined />} loading={submit.isPending} onClick={() => run(submit, contract.id, `Đã gửi xin duyệt hợp đồng ${number}`)}>Xin duyệt</Button>,
    ],
    PENDING: [
      <Button key="withdraw" icon={<UndoOutlined />} loading={withdraw.isPending} onClick={() => run(withdraw, contract.id, `Đã thôi xin duyệt, hợp đồng ${number} về Nháp`)}>Thôi xin duyệt</Button>,
      <Button key="reject" danger icon={<CloseOutlined />} onClick={() => setDialog('reject')}>Từ chối</Button>,
      <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => setDialog('approve')}>Duyệt</Button>,
    ],
    REJECTED: [
      ...(contract.legacy_unlinked ? [] : [edit]),
      <Button key="submit" type="primary" icon={<SendOutlined />} loading={submit.isPending} onClick={() => run(submit, contract.id, `Đã gửi xin duyệt lại hợp đồng ${number}`)}>Xin duyệt lại</Button>,
    ],
    ACTIVE: [
      <Button key="print" icon={<PrinterOutlined />} onClick={() => toast.info('Chưa in được hợp đồng', { description: 'Chưa có mẫu hợp đồng MLC.' })}>
        In hợp đồng <span className="ct-soon">Chưa chạy</span>
      </Button>,
      <Button key="end" icon={<FlagOutlined />} onClick={handleEnd}>Kết thúc hợp đồng</Button>,
      ...(contract.legacy_unlinked ? [] : [<Button key="revert" icon={<RollbackOutlined />} onClick={handleRevert}>Đưa về Nháp</Button>]),
    ],
    ENDED: [],
  }[status]
  // Nút nào cần quyền nào (xem, ẩn nút khi thiếu quyền).
  const ACTION_PERM = { more: 'contract.delete', edit: 'contract.update', submit: 'contract.submit', withdraw: 'contract.submit', reject: 'contract.approve', approve: 'contract.approve', end: 'contract.end', revert: 'contract.update' }
  const actions = allActions.filter((button) => !ACTION_PERM[button.key] || can(ACTION_PERM[button.key]))

  const canEditNote = ['DRAFT', 'REJECTED'].includes(status) && !contract.legacy_unlinked && can('contract.update')
  const rejected = status === 'REJECTED' ? lastOf('REJECT') : null
  // Màn 7: chuyến đã rời mà hợp đồng còn kéo dài sau ngày rời. Chỉ là nhãn, không tự đổi gì.
  const mismatch = data.date_mismatch && trip ? (
    <Banner
      tone="warning"
      title={`Chuyến ${trip.code} đã rời tàu ${formatDate(data.date_mismatch.leave_date)}`}
      description={`Hợp đồng còn tới ${formatDate(data.date_mismatch.end_date)}, bill vẫn sinh tới ngày đó.`}
      action={can('voyage.view') ? <Button onClick={() => navigate(`/voyages/${trip.id}`)}>Mở chuyến</Button> : undefined}
    />
  ) : null

  const timeline = log.map((entry) => ({
    id: entry.id,
    ...LOG_VIEW[entry.action],
    time: formatDateTime(entry.created_at),
    reason: entry.action === 'REJECT' ? entry.reason : undefined,
    actor: entry.actor_name,
  }))

  const tabs = CONTRACT_TABS
    .filter((item) => item.value !== 'bills' || (hasBills && can('bill.view')))
    .map((item) => ({ ...item, count: item.value === 'bills' ? billCount : item.value === 'history' ? log.length : null }))

  const bodies = {
    overview: (
      <div className="ct-detail">
        <div className="ct-detail__main">
          <section className="crew-panel">
            <div className="crew-panel__head">
              <h2 className="crew-panel__title">Thông tin chung</h2>
              {locked ? <span className="ct-locked"><LockOutlined aria-hidden /> Đã khoá</span> : null}
            </div>
            <div className="crew-panel__body">
              <dl className="sf-grid">
                <Field label="Thuyền viên" span={6}>
                  <Link to={`/seafarers/${seafarer.id}`}>{seafarer.full_name}</Link>{seafarer.seafarer_code ? ` · ${seafarer.seafarer_code}` : ''} <StatusBadge group="crew" value={seafarer.status} />
                </Field>
                <Field label="Chức danh" span={6}>{position.rank_name}{contract.legacy_unlinked && position.sort_order != null ? ` · dòng ${position.sort_order + 1} của chuyến cũ` : ''}</Field>
                <Field label="Ngày bắt đầu" span={3}>{formatDate(contract.start_date)}</Field>
                <Field label="Ngày kết thúc" span={3}>{formatDate(contract.end_date)} <span className="vd-muted">· {formatMonths(contract.months)}</span></Field>
                <Field label="Chuyến" span={6}>
                  <TripLink trip={trip} legacyCode={legacyCode} />
                </Field>
              </dl>
            </div>
          </section>
          <DealTable readOnly value={items} ownerName={place.ship_owner_name} seafarerName={seafarer.full_name} />
          <TermsTable readOnly value={data.terms} ownerName={place.ship_owner_name} seafarerName={seafarer.full_name} />
        </div>
        <aside className="ct-detail__side">
          <BalanceCard balance={balance} budgetTotal={position.budget_total_usd} />
        </aside>
      </div>
    ),
    bills: (
      <section className="crew-panel">
        <div className="crew-panel__head"><h2 className="crew-panel__title">Yêu cầu thanh toán <span className="vd-count">{billCount}</span></h2></div>
        <Table
          size="small"
          rowKey="id"
          loading={bills.isLoading}
          pagination={false}
          dataSource={bills.data?.data || []}
          columns={[
            { title: 'Kỳ', dataIndex: 'seq', width: 56 },
            { title: 'Từ – đến', key: 'period', render: (_, b) => <span className="ds-num">{formatDate(b.period_start)} – {formatDate(b.period_end)}</span> },
            { title: 'Hạn', dataIndex: 'due_date', render: (value) => <span className="ds-num">{formatDate(value)}</span> },
            { title: 'Trạng thái', dataIndex: 'display_status', render: (value) => <StatusBadge group="bill" value={value} /> },
            { title: 'Số tiền (USD)', dataIndex: 'total_usd', align: 'right', render: (value, b) => <Link to={`/bills/${b.id}`} className="ds-num">{formatUsd(value)}</Link> },
          ]}
        />
      </section>
    ),
    history: (
      <section className="crew-panel">
        <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử duyệt</h2></div>
        <div className="crew-panel__body"><AuditTimeline items={timeline} /></div>
      </section>
    ),
  }

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Hợp đồng', to: '/contracts' }, { label: number }]} />

      <div className="crew-head">
        <div className="crew-head__person">
        <div className="crew-head__photo crew-head__photo--logo">
          <FleetTile large icon={ContractSvg} />
        </div>
        <div className="crew-head__text">
          <div className="crew-head__titlerow">
            <h1 className="crew-head__title">{number}</h1>
            <StatusBadge group="contract" value={status} />
            {awaiting ? <span className="crew-docs crew-docs--warning">Chờ duyệt lại</span> : null}
          </div>
          <p className="crew-head__desc">Chức danh {position.rank_name}</p>
          <dl className="crew-head__meta">
            <dt>Thuyền viên</dt>
            <dd>{can('seafarer.view') ? <Link to={`/seafarers/${seafarer.id}`}>{seafarer.full_name}</Link> : seafarer.full_name}</dd>
            {place.ship_owner_name ? (
              <>
                <dt>Chủ tàu</dt>
                <dd>{can('partner.view') && place.ship_owner_id ? <Link to={`/partners/${place.ship_owner_id}`}>{place.ship_owner_name}</Link> : place.ship_owner_name}</dd>
              </>
            ) : null}
            <dt>Tàu</dt>
            <dd>{place.vessel_id && can('vessel.view') ? <Link to={`/vessels/${place.vessel_id}`}>{place.vessel_name}</Link> : place.vessel_name}</dd>
            <dt>Chuyến</dt>
            <dd><TripLink trip={trip} legacyCode={legacyCode} /></dd>
            <dt>Thời gian</dt>
            <dd>{formatDate(contract.start_date)} → {formatDate(contract.end_date)} · {formatMonths(contract.months)}</dd>
          </dl>
        </div>
        </div>
        <div className="ct-head-side">
            <div className="sf-note sf-note--head" role="note">
              <div className="sf-note__head">
                <span className="sf-note__title">Ghi chú</span>
                {canEditNote ? <Button type="link" size="small" onClick={() => navigate(`/contracts/${contract.id}/edit`)}>{contract.notes ? 'Sửa' : 'Thêm'}</Button> : null}
              </div>
              {contract.notes ? <div className="sf-note__body">{contract.notes}</div> : <div className="sf-ro__empty">Chưa có ghi chú.</div>}
            </div>
            {rejected ? (
              <div className="ct-reject" role="alert">
                <div className="ct-reject__title"><CloseCircleFilled aria-hidden /> Lý do từ chối</div>
                <div className="ct-reject__body">{contract.last_reject_reason || rejected.reason || '—'}</div>
                <div className="ct-reject__by">{rejected.actor_name || 'Người dùng'} · {formatDateTime(rejected.created_at)}</div>
              </div>
            ) : null}
          </div>
        <div className="crew-head__actions">{actions}</div>
      </div>

      {mismatch}

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      {bodies[tab]}

      {dialog === 'approve' ? <ApproveModal contract={data} open onClose={() => setDialog(null)} /> : null}
      {dialog === 'reject' ? <RejectModal contract={data} open onClose={() => setDialog(null)} /> : null}
    </div>
  )
}
