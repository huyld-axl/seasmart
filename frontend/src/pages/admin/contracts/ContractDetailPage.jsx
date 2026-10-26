import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Skeleton } from 'antd'
import { CheckCircleOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, LockOutlined, MoreOutlined, PrinterOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import AuditTimeline from '../../../components/ds/AuditTimeline'
import Banner from '../../../components/ds/Banner'
import { EmptyState } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useContract, useContractMutations } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatDateTime } from '../../../utils/format'
import { Crumb } from '../fleet/FleetParts'
import ApproveModal from './ApproveModal'
import TripLink from '../voyages/TripLink'
import BalanceCard from './BalanceCard'
import DealTable from './DealTable'
import RejectModal from './RejectModal'
import TermsTable from './TermsTable'
import { itemRows } from './contractView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import '../voyages/voyages.css'
import './contracts.css'

const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`
const LOG_VIEW = {
  CREATE: { title: 'Tạo hợp đồng', kind: 'upload', tone: 'neutral' },
  SUBMIT: { title: 'Xin duyệt', kind: 'export', tone: 'warning' },
  WITHDRAW: { title: 'Thôi xin duyệt', kind: 'withdraw', tone: 'neutral' },
  REJECT: { title: 'Từ chối', kind: 'reject', tone: 'error' },
  APPROVE: { title: 'Duyệt · có hiệu lực', kind: 'accept', tone: 'success' },
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
  const { data, isLoading, isError, refetch } = useContract(id)
  const { submit, withdraw, remove } = useContractMutations()

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

  const { contract, voyage, seafarer, position, balance, log, trip } = data
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

  const edit = <Button key="edit" icon={<EditOutlined />} onClick={() => navigate(`/contracts/${contract.id}/edit`)}>Sửa hợp đồng</Button>
  const allActions = {
    DRAFT: [
      <Dropdown key="more" menu={{ items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá hợp đồng', danger: true }], onClick: handleDelete }} trigger={['click']} placement="bottomRight">
        <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
      </Dropdown>,
      edit,
      <Button key="submit" type="primary" icon={<SendOutlined />} loading={submit.isPending} onClick={() => run(submit, contract.id, `Đã gửi xin duyệt hợp đồng ${number}`)}>Xin duyệt</Button>,
    ],
    PENDING: [
      <Button key="withdraw" icon={<UndoOutlined />} loading={withdraw.isPending} onClick={() => run(withdraw, contract.id, `Đã thôi xin duyệt, hợp đồng ${number} về Nháp`)}>Thôi xin duyệt</Button>,
      <Button key="reject" danger icon={<CloseOutlined />} onClick={() => setDialog('reject')}>Từ chối</Button>,
      <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => setDialog('approve')}>Duyệt</Button>,
    ],
    REJECTED: [
      edit,
      <Button key="submit" type="primary" icon={<SendOutlined />} loading={submit.isPending} onClick={() => run(submit, contract.id, `Đã gửi xin duyệt lại hợp đồng ${number}`)}>Xin duyệt lại</Button>,
    ],
    ACTIVE: [
      <Button key="print" icon={<PrinterOutlined />} onClick={() => toast.info('Chưa in được hợp đồng', { description: 'Chưa có mẫu hợp đồng MLC.' })}>
        In hợp đồng <span className="ct-soon">Chưa chạy</span>
      </Button>,
    ],
    ENDED: [],
  }[status]
  // Nút nào cần quyền nào (xem, ẩn nút khi thiếu quyền).
  const ACTION_PERM = { more: 'contract.delete', edit: 'contract.update', submit: 'contract.submit', withdraw: 'contract.submit', reject: 'contract.approve', approve: 'contract.approve' }
  const actions = allActions.filter((button) => !ACTION_PERM[button.key] || can(ACTION_PERM[button.key]))

  let banner = null
  if (status === 'PENDING') {
    const entry = lastOf('SUBMIT')
    banner = <Banner tone="warning" icon={LockOutlined} title={`${entry?.actor_name || 'Người dùng'} xin duyệt lúc ${formatDateTime(entry?.created_at)}`} description="Nội dung khoá cho tới khi được duyệt hoặc từ chối. Cần sửa thì bấm Thôi xin duyệt, hợp đồng về Nháp." />
  } else if (status === 'REJECTED') {
    const entry = lastOf('REJECT')
    banner = <Banner tone="error" title={`${entry?.actor_name || 'Người dùng'} từ chối lúc ${formatDateTime(entry?.created_at)}`} description={`Lý do: ${contract.last_reject_reason || entry?.reason || '—'}`} />
  } else if (status === 'ACTIVE') {
    const entry = lastOf('APPROVE')
    banner = <Banner tone="neutral" icon={CheckCircleOutlined} title={`Hiệu lực từ ${formatDate(contract.start_date)} đến ${formatDate(contract.end_date)}`} description={`${entry?.actor_name || 'Người dùng'} duyệt lúc ${formatDateTime(entry?.created_at)}. Nội dung không sửa được nữa.`} />
  }

  const timeline = log.map((entry) => ({
    id: entry.id,
    ...LOG_VIEW[entry.action],
    time: formatDateTime(entry.created_at),
    reason: entry.action === 'REJECT' ? entry.reason : undefined,
    actor: entry.actor_name,
  }))

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[
        { label: 'Tàu', to: '/vessels' },
        ...(voyage.vessel_id ? [{ label: voyage.vessel_name, to: `/vessels/${voyage.vessel_id}` }] : []),
        trip ? { label: trip.code, to: `/voyages/${trip.id}` } : { label: voyage.code },
        { label: number },
      ]} />

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">{number} · {seafarer.full_name}</h1>
          <p className="crew-head__desc">{position.rank_name} · {voyage.vessel_id ? <Link to={`/vessels/${voyage.vessel_id}`}>{voyage.vessel_name}</Link> : voyage.vessel_name} · chuyến <TripLink trip={trip} legacyCode={voyage.code} /></p>
          <div className="crew-head__badges"><StatusBadge group="contract" value={status} /></div>
        </div>
        <div className="crew-head__actions">{actions}</div>
      </div>

      {banner}

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
                  <Link to={`/seafarers/${seafarer.id}`}>{seafarer.full_name}</Link>{seafarer.seafarer_code ? ` · ${seafarer.seafarer_code}` : ''}
                </Field>
                <Field label="Vị trí" span={6}>{position.rank_name} · dòng {position.sort_order + 1} của chuyến</Field>
                <Field label="Ngày bắt đầu" span={3}>{formatDate(contract.start_date)}</Field>
                <Field label="Ngày kết thúc" span={3}>{formatDate(contract.end_date)} <span className="vd-muted">· {formatMonths(contract.months)}</span></Field>
                <Field label="Ghi chú" span={6}>{contract.notes}</Field>
                <Field label="Chuyến" span={6}>
                  <TripLink trip={trip} legacyCode={voyage.code} withStatus />
                </Field>
                <Field label="Trạng thái thuyền viên" span={6}><StatusBadge group="crew" value={seafarer.status} /></Field>
              </dl>
            </div>
          </section>

          <DealTable readOnly value={items} ownerName={voyage.ship_owner_name} seafarerName={seafarer.full_name} />
          <TermsTable readOnly value={data.terms} ownerName={voyage.ship_owner_name} seafarerName={seafarer.full_name} />
        </div>

        <aside className="ct-detail__side">
          <BalanceCard balance={balance} budgetTotal={position.budget_total_usd} />
          <section className="crew-panel">
            <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử duyệt</h2></div>
            <div className="crew-panel__body"><AuditTimeline items={timeline} /></div>
          </section>
        </aside>
      </div>

      {dialog === 'approve' ? <ApproveModal contract={data} open onClose={() => setDialog(null)} /> : null}
      {dialog === 'reject' ? <RejectModal contract={data} open onClose={() => setDialog(null)} /> : null}
    </div>
  )
}
