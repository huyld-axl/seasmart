import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { App, Button, Dropdown, Input, Skeleton, Table, Tooltip } from 'antd'
import { LeftOutlined, MoreOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useListSessionState from '../../../hooks/useListSessionState'
import Select from '../../../components/ds/SearchSelect'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import DateField from '../../../components/ds/DateField'
import MoneyInput from '../../../components/ds/MoneyInput'
import BottomSheet from '../../../components/ds/BottomSheet'
import ListFilters from '../../../components/ds/ListFilters'
import ListCard, { ListCardList } from '../../../components/ds/ListCard'
import useListSticky from '../../../components/ds/useListSticky'
import useToast from '../../../components/ds/useToast'
import useLeaveGuard from '../../../hooks/useLeaveGuard'
import useViewport from '../../../hooks/useViewport'
import { useCan } from '../../../hooks/usePermission'
import { useFleetList } from '../../../hooks/useFleet'
import { usePayoutList, usePayoutMutations } from '../../../hooks/useVoyages'
import { shipOwnerApi } from '../../../api/fleetApi'
import { DEFAULT_ITEMS } from '../../../constants/voyageContract'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatDateTime, formatUsd } from '../../../utils/format'
import { CrewFilterButton } from '../seafarers/CrewFilters'
import {
  applyEdit, billChanged, isChanged, isMonth, monthLabel, paidLabel, payRow, previousMonth, shiftMonth, shownAmounts, sumAmounts,
} from './payoutView'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './payouts.css'

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'UNPAID', label: 'Chưa trả' },
  { value: 'PAID', label: 'Đã trả' },
]
const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng' },
  { kind: 'ONE_TIME', title: 'Một lần' },
]
const money = (value) => formatUsd(value ?? 0, { fixed: true })
const short = (iso) => (iso ? dayjs(iso).format('DD/MM') : '—')
// Hai dòng mỗi bill dùng chung ô: dòng Thu gộp 2 hàng, dòng Trả ẩn ô đó.
const span = (line) => ({ rowSpan: line.side === 'thu' ? 2 : 0 })

// Trả lương thuyền viên: mỗi bill phải thu hai dòng, Thu (từ bill, chỉ xem) và Trả (mặc định từ cột Phải chi hợp đồng, sửa được).
// Chốt = ghi nhận đã trả theo số đang hiện, ngày trả là hôm nay; chuyển tiền làm ngoài hệ thống. Số sửa chỉ lưu khi Chốt.
export default function PayoutListPage() {
  const can = useCan()
  const canPay = can('payout.pay')
  const { isCompact: isMobile, isPhone } = useViewport()
  const { modal } = App.useApp()
  const toast = useToast()
  const tableScroll = useListSticky()
  const [searchParams] = useSearchParams()
  const urlMonth = isMonth(searchParams.get('month')) ? searchParams.get('month') : null
  const scope = `payouts:${urlMonth || 'default'}`
  // Tháng và tab không nhớ giữa các lần mở: mỗi lần vào là Tất cả, chưa chọn tháng (bảng trống), trừ khi link có ?month=.
  const [month, setMonth] = useState(urlMonth)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useListSessionState(scope, 'search', '')
  const [ownerId, setOwnerId] = useListSessionState(scope, 'ownerId', undefined)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [edits, setEdits] = useState({})
  const [selected, setSelected] = useState([])
  const [sheetId, setSheetId] = useState(null)
  const { pay, unpay } = usePayoutMutations()
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 }, { enabled: can('partner.view') })
  const list = usePayoutList({ month: month || undefined, tab: tab === 'all' ? undefined : tab, search: keyword || undefined, ship_owner_id: ownerId }, { enabled: Boolean(month) })
  const rows = list.data?.rows || []
  // Số sửa của dòng đã được chốt (ở máy khác, tab khác) không còn tính là chưa lưu.
  const paidIds = new Set(rows.filter((row) => row.payout.status === 'PAID').map((row) => row.bill.id))
  const dirtyRows = Object.keys(edits).filter((id) => !paidIds.has(Number(id))).length
  useLeaveGuard(dirtyRows > 0, { content: 'Có số chi đã sửa nhưng chưa chốt. Rời trang sẽ mất các số này.' })
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const sheetRow = rows.find((row) => row.bill.id === sheetId) || null
  const filtered = Boolean(keyword || ownerId)

  // Đổi tháng / tab / bộ lọc / trang khi còn số sửa chưa chốt thì hỏi trước; đồng ý thì bỏ số sửa.
  const guarded = (apply) => {
    const go = () => { setEdits({}); setSelected([]); apply() }
    if (!dirtyRows) return go()
    const names = rows.filter((row) => edits[row.bill.id]).map((row) => row.seafarer.full_name)
    return modal.confirm({
      title: 'Bỏ số đã sửa?',
      content: `${dirtyRows} dòng có số sửa chưa chốt${names.length === dirtyRows ? `: ${names.join(', ')}` : ''}.`,
      okText: 'Bỏ và tiếp tục',
      cancelText: 'Ở lại',
      okButtonProps: { danger: true },
      onOk: go,
    })
  }
  const changeMonth = (next) => next !== month && guarded(() => setMonth(next))
  // Cùng tháng thì số đang sửa giữ theo từng bill: đổi tab, tìm, lọc đối tác không hỏi, không bỏ số sửa.
  const changeTab = (value) => setTab(value)
  const changeOwner = (value) => setOwnerId(value)
  const changeSearch = (value) => setSearch(value)
  const resetFilters = () => { setSearch(''); setOwnerId(undefined) }

  const edit = (row, code, value) => setEdits((previous) => applyEdit(previous, row, code, value))

  async function undo(results) {
    try {
      for (const item of results) await unpay.mutateAsync({ id: item.id, version: item.version })
      toast.success('Đã hoàn tác chốt trả lương')
    } catch (error) {
      toast.error('Không hoàn tác được', { description: apiErrorText(error, 'Thử lại bằng Huỷ chốt ở dòng đó.') })
    }
  }

  async function submit(targets) {
    try {
      const result = await pay.mutateAsync(targets.map((row) => payRow(row, edits)))
      const ids = new Set(targets.map((row) => row.bill.id))
      setEdits((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.has(Number(id)))))
      setSelected((previous) => previous.filter((id) => !ids.has(id)))
      setSheetId(null)
      const title = targets.length === 1 ? `Đã chốt trả lương ${targets[0].seafarer.full_name}` : `Đã chốt trả lương ${targets.length} thuyền viên`
      toast.success(title, { description: `${money(result.total_usd)} USD · ngày trả ${formatDate(result.paid_date)}`, actionLabel: 'Hoàn tác', onAction: () => undo(result.payouts || []) })
      return true
    } catch (error) {
      list.refetch()
      toast.error('Không chốt được', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      return false
    }
  }

  const confirmBulk = () => {
    const targets = rows.filter((row) => selected.includes(row.bill.id) && row.payout.status !== 'PAID')
    if (!targets.length) return
    const sum = sumAmounts(targets.map((row) => sumAmounts(shownAmounts(row, edits))))
    const notCollected = targets.filter((row) => row.bill.display_status !== 'PAID')
    modal.confirm({
      title: `Chốt trả lương ${targets.length} thuyền viên?`,
      content: (
        <div className="po-confirm">
          <dl>
            <dt>Tháng</dt><dd>{monthLabel(month)}</dd>
            <dt>Tổng trả</dt><dd><b>{money(sum)} USD</b></dd>
            <dt>Ngày trả</dt><dd>{dayjs().format('DD/MM/YYYY')} (hôm nay)</dd>
          </dl>
          {notCollected.length ? (
            <p className="po-confirm__note">{notCollected.length} dòng có bill chưa thu tiền đối tác: {notCollected.map((row) => row.seafarer.full_name).join(', ')}.</p>
          ) : null}
        </div>
      ),
      okText: `Chốt ${targets.length} dòng`,
      cancelText: 'Huỷ',
      onOk: () => submit(targets),
    })
  }

  const confirmUnpay = (row) => modal.confirm({
    title: `Huỷ chốt trả lương ${row.seafarer.full_name}?`,
    content: `Dòng về Chưa trả, giữ số đã chốt (${money(row.payout.total_usd)} USD) để sửa tiếp.`,
    okText: 'Huỷ chốt',
    cancelText: 'Không',
    onOk: async () => {
      try {
        await unpay.mutateAsync({ id: row.payout.id, version: row.payout.version })
        toast.success(`Đã huỷ chốt trả lương ${row.seafarer.full_name}`)
      } catch (error) {
        list.refetch()
        toast.error('Không huỷ chốt được', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      }
    },
  })

  const paid = (row) => row.payout.status === 'PAID'
  const editable = (row) => canPay && !paid(row)
  const payBadge = (row) => <StatusBadge group="payout" value={row.payout.status} />
  const changedBadge = (row) => (billChanged(row) ? (
    <Tooltip title={`Tổng bill lúc chốt: ${money(row.payout.bill_total_usd)} USD`}>
      <span><StatusBadge group="payout" value="BILL_CHANGED" /></span>
    </Tooltip>
  ) : null)
  const moreMenu = (row) => ({
    items: [
      ...(canPay ? [{ key: 'unpay', label: 'Huỷ chốt' }] : []),
      { key: 'bill', label: <Link to={`/bills/${row.bill.id}`}>Xem yêu cầu thanh toán</Link> },
      { key: 'contract', label: <Link to={`/contracts/${row.contract.id}`}>Xem hợp đồng</Link> },
    ],
    onClick: ({ key }) => key === 'unpay' && confirmUnpay(row),
  })

  const payCell = (row, item) => {
    const value = shownAmounts(row, edits)[item.code]
    if (!editable(row)) return <span className="po-amt">{money(value)}</span>
    return (
      <MoneyInput
        size="small"
        suffix={null}
        className={isChanged(row, edits, item.code) ? 'po-input po-input--changed' : 'po-input'}
        value={value}
        onChange={(next) => edit(row, item.code, next)}
        aria-label={`Chi ${item.name}: ${row.seafarer.full_name}`}
      />
    )
  }
  const itemColumn = (item, index) => ({
    title: item.name,
    key: item.code,
    align: 'right',
    width: 112,
    className: [index === 0 ? 'po-sep' : '', item.kind === 'ONE_TIME' ? 'po-once' : ''].filter(Boolean).join(' ') || undefined,
    render: (_, line) => {
      if (line.side === 'tra') return payCell(line.row, item)
      return <span className="po-amt">{money(line.row.bill.amounts[item.code])}</span>
    },
  })

  const columns = [
    {
      title: 'Bill · Thuyền viên',
      key: 'who',
      fixed: 'left',
      width: 150,
      ellipsis: { showTitle: false },
      // Dòng Thu: mã bill; dòng Trả: tên thuyền viên (cùng hàng với đối tác và nút Chốt).
      render: (_, { row, side }) => (side === 'thu'
        ? <Clip text={row.bill.code}><Link className="ds-mono" to={`/bills/${row.bill.id}`}>{row.bill.code}</Link></Clip>
        : <Clip text={row.seafarer.full_name} className="po-name" />),
    },
    {
      title: 'Đối tác',
      key: 'owner',
      width: 130,
      ellipsis: { showTitle: false },
      render: (_, { row, side }) => (side === 'tra' ? <Clip text={row.ship_owner.company_name} /> : null),
    },
    {
      title: 'Hạn',
      key: 'period',
      width: 60,
      // Mỗi dòng một hàng chữ để hai dòng Thu / Trả cao bằng nhau.
      render: (_, { row, side }) => <span className="po-line">{short(side === 'thu' ? row.bill.due_date : row.payable_due_date)}</span>,
    },
    { title: '', key: 'side', width: 40, align: 'center', render: (_, { side }) => <span className="po-side">{side === 'thu' ? 'Thu' : 'Chi'}</span> },
    ...GROUPS.map((group) => ({
      title: group.title,
      key: group.kind,
      className: group.kind === 'ONE_TIME' ? 'po-sep po-once' : 'po-sep',
      children: DEFAULT_ITEMS.filter((item) => item.kind === group.kind).map(itemColumn),
    })),
    {
      title: 'Tổng',
      key: 'total',
      align: 'right',
      width: 120,
      className: 'po-sep',
      render: (_, { row, side }) => <b className="po-amt">{money(side === 'thu' ? row.bill.total_usd : sumAmounts(shownAmounts(row, edits)))}</b>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 116,
      render: (_, { row, side }) => (side === 'thu' ? (
        <span className="po-badges"><StatusBadge group="bill" value={row.bill.display_status} />{changedBadge(row)}</span>
      ) : (
        <span className="po-badges">{payBadge(row)}</span>
      )),
    },
    // Dòng Thu: ai duyệt bill, lúc nào; dòng Trả: ai chốt trả lương, lúc nào.
    {
      title: 'Người chốt',
      key: 'by',
      width: 130,
      ellipsis: { showTitle: false },
      render: (_, { row, side }) => <Clip text={(side === 'thu' ? row.bill.approved_by_name : row.payout.paid_by_name) || ''} />,
    },
    {
      title: 'Thời gian chốt',
      key: 'at',
      width: 140,
      render: (_, { row, side }) => {
        const at = side === 'thu' ? row.bill.approved_at : row.payout.paid_at
        return at ? <span className="po-line">{formatDateTime(at)}</span> : null
      },
    },
    ...(canPay ? [{
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 64,
      className: 'po-col-actions',
      // Nút nằm ở dòng Trả: Chốt là chốt trả lương, không phải chốt thu.
      render: (_, { row, side }) => (side === 'thu' ? null : paid(row) ? (
        <Dropdown menu={moreMenu(row)} trigger={['click']} placement="bottomRight">
          <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Thao tác khác: ${row.seafarer.full_name}`} />
        </Dropdown>
      ) : (
        <Button type="primary" size="small" loading={pay.isPending && pay.variables?.some((r) => r.bill_id === row.bill.id)} onClick={() => submit([row])}>Chốt</Button>
      )),
    }] : []),
  ]
  const tableWidth = (canPay ? 32 : 0) + 150 + 130 + 60 + 40 + DEFAULT_ITEMS.length * 112 + 120 + 116 + 130 + 140 + (canPay ? 64 : 0)
  const lines = rows.flatMap((row) => [
    { key: `${row.bill.id}-thu`, side: 'thu', row },
    { key: `${row.bill.id}-tra`, side: 'tra', row },
  ])
  const rowSelection = canPay ? {
    fixed: 'left',
    columnWidth: 32,
    selectedRowKeys: selected.map((id) => `${id}-thu`),
    onChange: (keys) => setSelected(keys.filter((key) => String(key).endsWith('-thu')).map((key) => Number(String(key).split('-')[0]))),
    getCheckboxProps: (line) => ({ disabled: line.side === 'tra' || paid(line.row), 'aria-label': `Chọn ${line.row.seafarer.full_name}` }),
    onCell: span,
  } : undefined
  const selectedOpen = rows.filter((row) => selected.includes(row.bill.id) && !paid(row)).length

  let body
  if (!month) {
    body = <EmptyState title="Chọn tháng để xem bảng trả lương" description="Mỗi dòng là một yêu cầu thanh toán có ngày kết thúc kỳ trong tháng đã chọn." />
  } else if (list.isError) {
    body = <EmptyState isError title="Không tải được bảng trả lương" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filtered) {
    body = <EmptyState title="Không có dòng nào khớp bộ lọc" description="Thử tìm bằng tên thuyền viên, mã bill hoặc số hợp đồng." action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all' && counts?.all) {
    body = <EmptyState title={tab === 'PAID' ? 'Chưa trả dòng nào trong tháng này' : 'Đã trả hết tháng này'} action={<Button onClick={() => changeTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title={`Tháng ${monthLabel(month)} không có yêu cầu thanh toán nào`} description="Mỗi dòng là một yêu cầu thanh toán có ngày kết thúc kỳ trong tháng. Chọn tháng khác." />
  } else if (isMobile) {
    body = (
      <ListCardList label="Trả lương">
        {rows.map((row) => (
          <ListCard
            key={row.bill.id}
            title={row.seafarer.full_name}
            sub={<span className="ds-mono">{row.bill.code}</span>}
            badge={payBadge(row)}
            figure={{ value: formatUsd(sumAmounts(shownAmounts(row, edits))), unit: 'USD' }}
            fields={[
              { label: 'Thu', value: `${money(row.bill.total_usd)} USD` },
              { label: 'Chi', value: `${money(sumAmounts(shownAmounts(row, edits)))} USD` },
              { label: 'Bill', value: <StatusBadge group="bill" value={row.bill.display_status} /> },
            ]}
            alert={billChanged(row) ? { text: `Bill đổi sau khi chốt (lúc chốt ${money(row.payout.bill_total_usd)} USD)`, tone: 'warn' } : null}
            onOpen={() => setSheetId(row.bill.id)}
            openLabel={`Mở trả lương ${row.seafarer.full_name}`}
          />
        ))}
      </ListCardList>
    )
  } else {
    body = (
      <Table
        rowKey="key"
        className="po-table"
        dataSource={lines}
        columns={columns}
        rowSelection={rowSelection}
        rowClassName={(line) => [line.side === 'thu' ? 'po-row--thu' : 'po-row--tra', selected.includes(line.row.bill.id) ? 'po-row--selected' : '', paid(line.row) ? 'po-row--paid' : ''].join(' ')}
        pagination={false}
        size="small"
        // Đầu bảng và thân bảng là hai bảng riêng (đầu dính): khoá độ rộng cột để hai bên thẳng cột.
        tableLayout="fixed"
        scroll={{ ...tableScroll, x: tableWidth }}
      />
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed po-list">
        <div className="ds-toolbar crew-toolbar">
          <span className="po-month">
            <Button icon={<LeftOutlined />} aria-label="Tháng trước" onClick={() => changeMonth(shiftMonth(month || previousMonth(), month ? -1 : 0))} />
            <DateField picker="month" format="MM/YYYY" allowClear={false} value={month ? dayjs(`${month}-01`) : null} placeholder="Chọn tháng" aria-label="Tháng" onChange={(value) => value && changeMonth(dayjs(value).format('YYYY-MM'))} />
            <Button icon={<RightOutlined />} aria-label="Tháng sau" onClick={() => changeMonth(shiftMonth(month || previousMonth(), month ? 1 : 0))} />
          </span>
          <StatusTabs phone="chips" tabs={tabs} value={tab} onChange={changeTab} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm thuyền viên, mã bill, số hợp đồng"
            aria-label="Tìm trong bảng trả lương"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
          />
          {can('partner.view') && !isPhone ? (
            <Select
              className="vy-owner-filter"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả đối tác"
              aria-label="Lọc theo đối tác"
              value={ownerId}
              loading={owners.isLoading}
              options={(owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name }))}
              onChange={changeOwner}
            />
          ) : null}
          {can('partner.view') && isPhone ? (
            <span className="ds-toolbar__end">
              <CrewFilterButton count={ownerId ? 1 : 0} open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} />
            </span>
          ) : null}
          {canPay && !isMobile ? (
            <span className="ds-toolbar__end">
              <Button type="primary" disabled={!selectedOpen} loading={pay.isPending && (pay.variables?.length || 0) > 1} onClick={confirmBulk}>
                {selectedOpen ? `Chốt ${selectedOpen} dòng đã chọn` : 'Chốt các dòng đã chọn'}
              </Button>
            </span>
          ) : null}
        </div>
        {can('partner.view') ? (
          <ListFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} count={ownerId ? 1 : 0} onClear={() => changeOwner(undefined)} total={total} unit="dòng" loading={list.isLoading}>
            <label className="crew-filterbar__field crew-filterbar__field--wide">
              <span>Đối tác</span>
              <Select
                style={{ width: '100%' }}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tất cả đối tác"
                aria-label="Lọc theo đối tác"
                value={ownerId}
                loading={owners.isLoading}
                options={(owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name }))}
                onChange={changeOwner}
              />
            </label>
          </ListFilters>
        ) : null}
        {body}
        {rows.length > 0 && (
          // Không phân trang: đổ hết dòng của tháng. Tổng: thu của bill đã duyệt, trả của dòng đã chốt.
          <div className="ds-table-foot ds-list-foot">
            <span className="ds-list-foot__info">
              <span className="ds-num">{total} dòng · tháng {monthLabel(month)}</span>
              <span className="ds-list-foot__note">Thu đã duyệt {money(list.data?.totals?.receivable_usd)} · Đã trả {money(list.data?.totals?.payable_usd)} USD</span>
            </span>
          </div>
        )}
      </div>
      {sheetRow ? (
        <PayoutSheet
          row={sheetRow}
          edits={edits}
          canPay={canPay}
          pending={pay.isPending}
          onEdit={edit}
          onPay={() => submit([sheetRow])}
          onUnpay={() => { setSheetId(null); confirmUnpay(sheetRow) }}
          onClose={() => setSheetId(null)}
        />
      ) : null}
    </div>
  )
}

// Chữ một dòng, dài thì cắt "…" và rê chuột hiện đủ.
function Clip({ text, className, children }) {
  return (
    <Tooltip title={text} mouseEnterDelay={0.3}>
      <span className={['po-clip', className].filter(Boolean).join(' ')}>{children || text}</span>
    </Tooltip>
  )
}

// Điện thoại: bảng dưới sửa và chốt một dòng, đủ 14 khoản chia hai nhóm, mỗi khoản có gợi ý số Thu.
function PayoutSheet({ row, edits, canPay, pending, onEdit, onPay, onUnpay, onClose }) {
  const isPaid = row.payout.status === 'PAID'
  const amounts = shownAmounts(row, edits)
  const footer = (
    <div className="po-sheet__foot">
      <span className="po-sheet__sum">Thu <b>{money(row.bill.total_usd)}</b> · Chi <b>{money(sumAmounts(amounts))}</b> USD</span>
      {canPay && isPaid ? <Button block onClick={onUnpay}>Huỷ chốt</Button> : null}
      {canPay && !isPaid ? (
        <span className="po-sheet__buttons">
          <Button type="primary" loading={pending} onClick={onPay}>Chốt đã trả</Button>
        </span>
      ) : null}
    </div>
  )
  return (
    <BottomSheet
      open
      title={row.seafarer.full_name}
      description={`${row.bill.code} · hạn trả ${short(row.payable_due_date)}`}
      onClose={onClose}
      footer={footer}
    >
      <div className="po-sheet">
        {isPaid ? <p className="po-sheet__paid">{paidLabel(row)}{row.payout.paid_by_name ? ` · ${row.payout.paid_by_name}` : ''}</p> : null}
        {GROUPS.map((group) => (
          <section key={group.kind} className="po-sheet__group" aria-label={group.title}>
            <h3 className="po-sheet__title">{group.title}</h3>
            {DEFAULT_ITEMS.filter((item) => item.kind === group.kind).map((item) => (
              <div key={item.code} className="po-sheet__line">
                <span className="po-sheet__name">
                  {item.name}
                  <span className="po-sheet__hint">Thu {money(row.bill.amounts[item.code])}</span>
                </span>
                {canPay && !isPaid ? (
                  <MoneyInput
                    className={isChanged(row, edits, item.code) ? 'po-input po-input--changed' : 'po-input'}
                    value={amounts[item.code]}
                    onChange={(next) => onEdit(row, item.code, next)}
                    aria-label={`Chi ${item.name}`}
                  />
                ) : <b className="ds-num">{money(amounts[item.code])}</b>}
              </div>
            ))}
          </section>
        ))}
      </div>
    </BottomSheet>
  )
}
