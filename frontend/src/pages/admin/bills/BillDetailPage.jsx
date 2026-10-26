import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, DatePicker, Dropdown, Form, Modal, Skeleton, Tooltip } from 'antd'
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
import BillCalendar from './BillCalendar'
import BillMoneyTable from './BillMoneyTable'
import { closingLabel, groupItems, overdueLabel, payLabel } from './billView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import TripLink from '../voyages/TripLink'
import '../voyages/voyages.css'
import '../contracts/contracts.css'
import './bills.css'

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const LOG_VIEW = {
  CREATE: { title: 'Tạo khi duyệt hợp đồng', kind: 'upload', tone: 'neutral' },
  UPDATE: { title: 'Sửa số tiền', kind: 'edit', tone: 'neutral' },
  SEND: { title: 'Đánh dấu đã gửi', kind: 'export', tone: 'warning' },
  UNSEND: { title: 'Thu hồi', kind: 'withdraw', tone: 'neutral' },
  COLLECT: { title: 'Ghi nhận đã thu', kind: 'accept', tone: 'success' },
  UNCOLLECT: { title: 'Huỷ ghi nhận đã thu', kind: 'withdraw', tone: 'neutral' },
}

function Field({ label, children, span = 6 }) {
  return (
    <div className={`sf-ro sf-c${span}`}>
      <dt className="sf-ro__label">{label}</dt>
      <dd className="sf-ro__value">{children}</dd>
    </div>
  )
}
const Empty = ({ children }) => <span className="sf-ro__empty">{children}</span>

function AmountRow({ label, value, note }) {
  return (
    <div className="ct-card-row">
      <span className="ct-card-row__label">{label}</span>
      <span className="ct-card-row__end">
        <span className="ct-card-row__value"><b>{formatUsd(value)}</b> <span className="ct-fig__unit">USD</span></span>
        {note ? <span className="ct-card-row__note">{note}</span> : null}
      </span>
    </div>
  )
}

// Hộp thoại ghi nhận đã thu: chọn ngày tiền về, mặc định hôm nay, không sau hôm nay.
function CollectModal({ bill, open, pending, onCancel, onConfirm }) {
  const [form] = Form.useForm()
  return (
    <Modal
      open={open}
      title={`Ghi nhận đã thu ${bill.code}?`}
      okText="Ghi nhận đã thu"
      cancelText="Huỷ"
      confirmLoading={pending}
      onCancel={onCancel}
      onOk={() => form.validateFields().then((values) => onConfirm(values.paid_date.format('YYYY-MM-DD')))}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark initialValues={{ paid_date: dayjs() }}>
        <Form.Item
          name="paid_date"
          label="Ngày thu"
          rules={[{ required: true, message: 'Chọn ngày thu' }]}
          extra={`${bill.ship_owner.company_name} · ${formatUsd(bill.total_usd, { fixed: true })} USD. Ghi khi đã nhận đủ tiền.`}
        >
          <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function BillDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [collecting, setCollecting] = useState(false)
  const { data, isLoading, isError, refetch } = useBill(id)
  const { move } = useBillMutations()

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
  const { totals } = groupItems(items)
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

  const unsend = () => confirm(`Thu hồi ${bill.code}?`, `Yêu cầu thanh toán về Chưa gửi để sửa. Nếu đã gửi cho ${bill.ship_owner.company_name}, báo họ bản đã gửi không còn dùng.`, 'Thu hồi', 'unsend', `Đã thu hồi ${bill.code}`)
  const uncollect = () => confirm(`Huỷ ghi nhận đã thu ${bill.code}?`, 'Yêu cầu thanh toán về Đã gửi.', 'Huỷ ghi nhận', 'uncollect', `Đã huỷ ghi nhận đã thu ${bill.code}`)
  const more = (key, label, icon, onClick) => (
    <Dropdown key="more" menu={{ items: [{ key, icon, label }], onClick }} trigger={['click']} placement="bottomRight">
      <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
    </Dropdown>
  )
  const edit = can('bill.update') ? <Button key="edit" icon={<EditOutlined />} onClick={() => navigate(`/bills/${bill.id}/edit`)}>Sửa</Button> : null
  const send = can('bill.send') ? (
    display === 'UPCOMING' ? (
      <Tooltip key="send" title={`Gửi được từ ngày chốt sổ ${formatDate(bill.period_end)}`}>
        <Button type="primary" icon={<SendOutlined />} disabled>Đánh dấu đã gửi</Button>
      </Tooltip>
    ) : (
      <Button key="send" type="primary" icon={<SendOutlined />} loading={move.isPending} onClick={() => run('send', `Đã đánh dấu gửi ${bill.code}`)}>Đánh dấu đã gửi</Button>
    )
  ) : null
  const collect = can('bill.collect') ? <Button key="collect" type="primary" icon={<CheckOutlined />} onClick={() => setCollecting(true)}>Ghi nhận đã thu</Button> : null
  const actions = {
    UPCOMING: [edit, send],
    TO_SEND: [edit, send],
    SENT: [can('bill.send') ? more('unsend', 'Thu hồi', <RollbackOutlined />, unsend) : null, collect],
    OVERDUE: [can('bill.send') ? more('unsend', 'Thu hồi', <RollbackOutlined />, unsend) : null, collect],
    PAID: [can('bill.collect') ? more('uncollect', 'Huỷ ghi nhận đã thu', <UndoOutlined />, uncollect) : null],
  }[display].filter(Boolean)

  const timeline = log.map((entry) => ({ id: entry.id, ...LOG_VIEW[entry.action], time: formatDateTime(entry.created_at), actor: entry.actor_name }))

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[
        { label: 'Tàu', to: '/vessels' },
        { label: bill.vessel.vessel_name, to: `/vessels/${bill.vessel.id}` },
        bill.trip ? { label: bill.trip.code, to: `/voyages/${bill.trip.id}` } : { label: bill.voyage.code },
        { label: bill.contract.contract_number, to: `/contracts/${bill.contract.id}` },
        { label: bill.code },
      ]} />

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">{bill.code} · Kỳ {bill.seq}/{bill.periods}</h1>
          <p className="crew-head__desc">{formatDate(bill.period_start)} → {formatDate(bill.period_end)} · hạn thanh toán {formatDate(bill.due_date)}</p>
          <div className="crew-head__badges"><StatusBadge group="bill" value={display} label={overdueLabel(bill)} /></div>
        </div>
        <div className="crew-head__actions">{actions}</div>
      </div>

      <div className="ct-detail">
        <div className="ct-detail__main">
          <section className="crew-panel">
            <div className="crew-panel__head"><h2 className="crew-panel__title">Thông tin chung</h2></div>
            <div className="crew-panel__body">
              <dl className="sf-grid">
                <Field label="Hợp đồng"><Link className="ds-mono" to={`/contracts/${bill.contract.id}`}>{bill.contract.contract_number}</Link></Field>
                <Field label="Thuyền viên"><Link to={`/seafarers/${bill.seafarer.id}`}>{bill.seafarer.full_name}</Link> <span className="vd-muted">· {bill.seafarer.rank_name}</span></Field>
                <Field label="Đối tác"><Link to={`/partners/${bill.ship_owner.id}`}>{bill.ship_owner.company_name}</Link></Field>
                <Field label="Tàu"><Link to={`/vessels/${bill.vessel.id}`}>{bill.vessel.vessel_name}</Link> <span className="vd-muted">· chuyến <TripLink trip={bill.trip} legacyCode={bill.voyage.code} /></span></Field>
                <Field label="Kỳ" span={3}>{formatDate(bill.period_start)} → {formatDate(bill.period_end)}</Field>
                <Field label="Ngày chốt sổ" span={3}>{term ? closingLabel(term.closing_day) : <Empty>—</Empty>}</Field>
                <Field label="Hạn thanh toán">{formatDate(bill.due_date)} ({WEEKDAY[dayjs(bill.due_date).day()]}) {term ? <span className="vd-muted">· {payLabel(term).toLowerCase()}</span> : null}</Field>
                <Field label="Ngày gửi" span={3}>{bill.sent_at ? formatDate(bill.sent_at) : <Empty>Chưa gửi</Empty>}</Field>
                <Field label="Ngày thu" span={3}>{bill.paid_date ? formatDate(bill.paid_date) : <Empty>Chưa thu</Empty>}</Field>
                <Field label="Ghi chú">{bill.note || <Empty>Không có</Empty>}</Field>
              </dl>
            </div>
          </section>
          <BillMoneyTable value={items} readOnly />
        </div>

        <aside className="ct-detail__side">
          <section className="crew-panel">
            <div className="crew-panel__head"><h2 className="crew-panel__title">Số tiền</h2></div>
            <div className="crew-panel__body ct-card">
              <div className="ct-budget ct-budget--card">
                <span className="ct-budget__label">Tổng yêu cầu</span>
                <span className="ct-budget__value"><b>{formatUsd(totals.all)}</b> <span className="ct-fig__unit">USD</span></span>
                <span className="ct-budget__sub">{bill.ship_owner.company_name}</span>
              </div>
              <AmountRow label="Hằng tháng" value={totals.monthly} />
              {totals.once ? <AmountRow label="Một lần" value={totals.once} note="Chỉ có ở kỳ đầu" /> : null}
              {totals.adjust ? <AmountRow label="Điều chỉnh" value={totals.adjust} /> : null}
            </div>
          </section>
          <BillCalendar key={bill.id} periods={periods} currentId={bill.id} onOpen={(next) => navigate(`/bills/${next}`)} />
          <section className="crew-panel">
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
