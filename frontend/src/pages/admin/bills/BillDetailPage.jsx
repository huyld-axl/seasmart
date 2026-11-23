import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Skeleton } from 'antd'
import Tooltip from '../../../components/ds/Tooltip'
import HeadActions from '../../../components/ds/HeadActions'
import { CheckOutlined, EditOutlined, MoreOutlined, RollbackOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AuditTimeline from '../../../components/ds/AuditTimeline'
import { EmptyState } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useBill, useBillMutations } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatDateTime, formatUsd } from '../../../utils/format'
import { Crumb } from '../fleet/FleetParts'
import { BillMoneyView, BillPeriods } from './BillParts'
import InfoTable from '../../../components/ds/InfoTable'
import CollectModal from './CollectModal'
import { closingLabel, overdueLabel, payLabel } from './billView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import TripLink from '../voyages/TripLink'
import '../voyages/voyages.css'
import '../contracts/contracts.css'
import './bills.css'
import { PicChange } from '../../../components/common/PersonInCharge'
import { assignChange } from '../../../utils/pic'

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const LOG_VIEW = {
  CREATE: { title: 'Tạo khi duyệt hợp đồng', kind: 'upload', tone: 'neutral' },
  UPDATE: { title: 'Sửa số tiền', kind: 'edit', tone: 'neutral' },
  APPROVE: { title: 'Duyệt', kind: 'accept', tone: 'success' },
  UNAPPROVE: { title: 'Bỏ duyệt', kind: 'withdraw', tone: 'neutral' },
  SEND: { title: 'Đánh dấu đã gửi', kind: 'export', tone: 'warning' },
  UNSEND: { title: 'Thu hồi', kind: 'withdraw', tone: 'neutral' },
  COLLECT: { title: 'Ghi nhận đã thu', kind: 'accept', tone: 'success' },
  UNCOLLECT: { title: 'Huỷ ghi nhận đã thu', kind: 'withdraw', tone: 'neutral' },
  ASSIGN: { title: 'Đổi người phụ trách', kind: 'edit', tone: 'neutral' },
}

const Empty = ({ children }) => <span className="sf-ro__empty">{children}</span>


export default function BillDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [collecting, setCollecting] = useState(false)
  const { data, isLoading, isError, refetch } = useBill(id)
  const { move, setPic } = useBillMutations()

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
        title={isError ? 'Không tải được yêu cầu thanh toán' : 'Không tìm thấy yêu cầu thanh toán'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Yêu cầu thanh toán có thể không còn trong phạm vi của bạn.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/bills')}>Về danh sách</Button>}
      />
    )
  }

  const { bill, items, term, periods, log } = data
  const display = bill.display_status

  async function run(action, message, body = {}) {
    try {
      await move.mutateAsync({ id: bill.id, action, ...body })
      toast.success(message)
      return true
    } catch (error) {
      toast.error(`Không cập nhật được ${bill.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      return false
    }
  }

  function confirm(title, content, okText, action, message) {
    modal.confirm({ title, content, okText, cancelText: 'Huỷ', onOk: () => run(action, message) })
  }

  const unsend = () => confirm(`Thu hồi ${bill.code}?`, `Yêu cầu thanh toán về Chưa duyệt để sửa và duyệt lại. Nếu đã gửi cho ${bill.ship_owner.company_name}, báo họ bản đã gửi không còn dùng.`, 'Thu hồi', 'unsend', `Đã thu hồi ${bill.code}`)
  const uncollect = () => confirm(`Huỷ ghi nhận đã thu ${bill.code}?`, 'Yêu cầu thanh toán về Đã gửi.', 'Huỷ ghi nhận', 'uncollect', `Đã huỷ ghi nhận đã thu ${bill.code}`)
  const unapprove = () => confirm(`Bỏ duyệt ${bill.code}?`, 'Yêu cầu thanh toán về Chưa duyệt để sửa. Gửi lại được sau khi duyệt lại.', 'Bỏ duyệt', 'unapprove', `Đã bỏ duyệt ${bill.code}`)
  const more = (key, label, icon, onClick) => (
    <Dropdown key="more" menu={{ items: [{ key, icon, label }], onClick }} trigger={['click']} placement="bottomRight">
      <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
    </Dropdown>
  )
  const edit = can('bill.update') ? <Button key="edit" icon={<EditOutlined />} onClick={() => navigate(`/bills/${bill.id}/edit`)}>Sửa</Button> : null
  const send = can('bill.send') ? (
    <Button key="send" type="primary" icon={<SendOutlined />} loading={move.isPending} onClick={() => run('send', `Đã đánh dấu gửi ${bill.code}`)}>Đánh dấu đã gửi</Button>
  ) : null
  const approve = can('bill.approve') ? (
    display === 'UPCOMING' ? (
      <Tooltip key="approve" title={`Duyệt được từ ngày chốt sổ ${formatDate(bill.period_end)}`}>
        <Button type="primary" icon={<CheckOutlined />} disabled>Duyệt</Button>
      </Tooltip>
    ) : (
      <Button key="approve" type="primary" icon={<CheckOutlined />} loading={move.isPending} onClick={() => run('approve', `Đã duyệt ${bill.code}`)}>Duyệt</Button>
    )
  ) : null
  const collect = can('bill.collect') ? <Button key="collect" type="primary" icon={<CheckOutlined />} onClick={() => setCollecting(true)}>Ghi nhận đã thu</Button> : null
  const actions = {
    UPCOMING: [edit, approve],
    TO_APPROVE: [edit, approve],
    TO_SEND: [can('bill.approve') ? more('unapprove', 'Bỏ duyệt', <RollbackOutlined />, unapprove) : null, send],
    SENT: [can('bill.send') ? more('unsend', 'Thu hồi', <RollbackOutlined />, unsend) : null, collect],
    OVERDUE: [can('bill.send') ? more('unsend', 'Thu hồi', <RollbackOutlined />, unsend) : null, collect],
    PAID: [can('bill.collect') ? more('uncollect', 'Huỷ ghi nhận đã thu', <UndoOutlined />, uncollect) : null],
  }[display].filter(Boolean)

  const timeline = log.map((entry) => ({ id: entry.id, ...LOG_VIEW[entry.action], time: formatDateTime(entry.created_at), actor: entry.actor_name, ...assignChange(entry) }))

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[
        { label: 'Tàu', to: '/vessels' },
        { label: bill.vessel.vessel_name, to: `/vessels/${bill.vessel.id}` },
        bill.trip ? { label: bill.trip.code, to: `/voyages/${bill.trip.id}` } : { label: bill.voyage?.code },
        { label: bill.contract.contract_number, to: `/contracts/${bill.contract.id}` },
        { label: bill.code },
      ]} />

      <div className="crew-head">
        <div className="crew-head__text">
          <div className="crew-head__titlerow">
            <h1 className="crew-head__title">{bill.code} · Kỳ {bill.seq}/{bill.periods}</h1>
            <StatusBadge group="bill" value={display} label={overdueLabel(bill)} />
          </div>
          <dl className="crew-head__meta">
            <div className="crew-head__pair"><dt>Hợp đồng</dt><dd><Link className="ds-mono" to={`/contracts/${bill.contract.id}`}>{bill.contract.contract_number}</Link></dd></div>
            <div className="crew-head__pair"><dt>Thuyền viên</dt><dd><Link to={`/seafarers/${bill.seafarer.id}`}>{bill.seafarer.full_name}</Link>&nbsp;<span className="vd-muted">· {bill.seafarer.rank_name}</span></dd></div>
            <div className="crew-head__pair"><dt>Đối tác</dt><dd><Link to={`/partners/${bill.ship_owner.id}`}>{bill.ship_owner.company_name}</Link></dd></div>
            <div className="crew-head__pair"><dt>Kỳ</dt><dd className="ds-num">{formatDate(bill.period_start)} → {formatDate(bill.period_end)}</dd></div>
            <div className="crew-head__pair"><dt>Hạn</dt><dd className="ds-num">{formatDate(bill.due_date)} ({WEEKDAY[dayjs(bill.due_date).day()]})</dd></div>
            <div className="crew-head__pair"><dt>Phụ trách</dt>
            <dd>
              <PicChange
                pic={bill.pic}
                canEdit={can('bill.update')}
                saving={setPic.isPending}
                onSave={(picUserId) => setPic.mutateAsync({ id: bill.id, picUserId })}
                note="Chỉ đổi yêu cầu thanh toán này. Hợp đồng và các kỳ khác giữ người phụ trách của chúng."
              />
            </dd></div>
          </dl>
        </div>
        <HeadActions>{actions}</HeadActions>
      </div>

      <div className="ct-detail ct-detail--bill">
        <div className="ct-detail__main">
          <section className="crew-panel crew-panel--table">
            <div className="crew-panel__head"><h2 className="crew-panel__title">Thông tin chung</h2></div>
            <InfoTable
              fields={[
                ['Tàu', <><Link to={`/vessels/${bill.vessel.id}`}>{bill.vessel.vessel_name}</Link> <span className="vd-muted">· chuyến <TripLink trip={bill.trip} legacyCode={bill.voyage?.code} /></span></>],
                ['Ngày chốt sổ', term ? closingLabel(term.closing_day) : null],
                ['Hạn thanh toán', <>{formatDate(bill.due_date)} ({WEEKDAY[dayjs(bill.due_date).day()]}) {term ? <span className="vd-muted">· {payLabel(term).toLowerCase()}</span> : null}</>],
                ['Ngày gửi', bill.sent_at ? formatDate(bill.sent_at) : <Empty>Chưa gửi</Empty>],
                ['Ngày thu', bill.paid_date ? formatDate(bill.paid_date) : <Empty>Chưa thu</Empty>],
                ['Trả lương', data.payout?.status === 'PAID'
                  ? <>Đã trả {formatDate(data.payout.paid_date)} · {formatUsd(data.payout.total_usd, { fixed: true })} USD{can('payout.view') ? <> <Link to={`/payouts?month=${bill.period_end.slice(0, 7)}`}>Xem</Link></> : null}</>
                  : <><Empty>Chưa trả</Empty>{can('payout.view') ? <> <Link to={`/payouts?month=${bill.period_end.slice(0, 7)}`}>Mở bảng trả lương</Link></> : null}</>],
                ['Ghi chú', bill.note || <Empty>Không có</Empty>],
              ]}
            />
          </section>
          <BillMoneyView items={items} ownerName={bill.ship_owner.company_name} />
        </div>

        <aside className="ct-detail__side">
          <BillPeriods key={bill.id} periods={periods} currentId={bill.id} />
          <section className="crew-panel crew-panel--table">
            <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử</h2></div>
            <div className="crew-panel__body"><AuditTimeline items={timeline} /></div>
          </section>
        </aside>
      </div>

      <CollectModal
        bill={bill}
        open={collecting}
        pending={move.isPending}
        onCancel={() => setCollecting(false)}
        onConfirm={async (paidDate) => { if (await run('collect', `Đã ghi nhận đã thu ${bill.code}`, { paid_date: paidDate })) setCollecting(false) }}
      />
    </div>
  )
}
