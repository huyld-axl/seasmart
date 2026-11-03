import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Grid, Input, Select, Skeleton, Table, Tooltip } from 'antd'
import { CheckOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useBillList, useBillMutations } from '../../../hooks/useVoyages'
import useToast from '../../../components/ds/useToast'
import apiErrorText from '../../../utils/apiError'
import CollectModal from './CollectModal'
import { formatDate, formatUsd } from '../../../utils/format'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './bills.css'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'
import { useCan } from '../../../hooks/usePermission'
import { overdueLabel } from './billView'

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'TO_APPROVE', label: 'Cần duyệt' },
  { value: 'TO_SEND', label: 'Cần gửi' },
  { value: 'OVERDUE', label: 'Quá hạn' },
  { value: 'SENT', label: 'Đã gửi' },
  { value: 'UPCOMING', label: 'Chưa đến kỳ' },
  { value: 'PAID', label: 'Đã thu' },
]

// Link trong dòng bảng: bấm link không mở bill.
const stop = (event) => event.stopPropagation()

// Danh sách yêu cầu thanh toán: không có nút tạo, bill sinh khi duyệt hợp đồng. Mặc định mở tab Cần duyệt (người có quyền duyệt) hoặc Cần gửi.
export default function BillListPage({ shipOwnerId } = {}) {
  const can = useCan()
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState(shipOwnerId ? 'all' : can('bill.approve') ? 'TO_APPROVE' : 'TO_SEND')
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [collecting, setCollecting] = useState(null)
  const tableScroll = useListSticky()
  const toast = useToast()
  const { move } = useBillMutations()
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 }, { enabled: !shipOwnerId && can('partner.view') })
  const list = useBillList({ tab: tab === 'all' ? undefined : tab, search: keyword || undefined, ship_owner_id: shipOwnerId || ownerId, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/bills/${row.id}`)
  const filtered = Boolean(keyword || ownerId)
  const resetFilters = () => { setSearch(''); setOwnerId(undefined); setPage(1) }
  async function run(row, action, message, body = {}) {
    try {
      await move.mutateAsync({ id: row.id, action, ...body })
      toast.success(message)
      return true
    } catch (error) {
      toast.error(`Không cập nhật được ${row.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      return false
    }
  }
  // Nút thao tác nhanh: Cần duyệt → Duyệt; Cần gửi → Gửi; Đã gửi / Quá hạn → Ghi nhận đã thu. Các trạng thái khác chừa ô trống cho thẳng cột.
  const quickAction = (row) => {
    if (row.display_status === 'TO_APPROVE' && can('bill.approve')) {
      return (
        <Tooltip title="Duyệt">
          <Button type="text" size="small" icon={<CheckOutlined />} aria-label={`Duyệt ${row.code}`} disabled={move.isPending}
            onClick={(event) => { event.stopPropagation(); run(row, 'approve', `Đã duyệt ${row.code}`) }} />
        </Tooltip>
      )
    }
    if (row.display_status === 'TO_SEND' && can('bill.send')) {
      return (
        <Tooltip title="Đánh dấu đã gửi">
          <Button type="text" size="small" icon={<SendOutlined />} aria-label={`Đánh dấu đã gửi ${row.code}`} disabled={move.isPending}
            onClick={(event) => { event.stopPropagation(); run(row, 'send', `Đã đánh dấu gửi ${row.code}`) }} />
        </Tooltip>
      )
    }
    if ((row.display_status === 'SENT' || row.display_status === 'OVERDUE') && can('bill.collect')) {
      return (
        <Tooltip title="Ghi nhận đã thu">
          <Button type="text" size="small" icon={<CheckOutlined />} aria-label={`Ghi nhận đã thu ${row.code}`}
            onClick={(event) => { event.stopPropagation(); setCollecting(row) }} />
        </Tooltip>
      )
    }
    return <span className="ds-row-actions__slot" aria-hidden />
  }
  const badge = (row) => <StatusBadge group="bill" value={row.display_status} label={overdueLabel(row)} />

  const columns = [
    {
      title: 'Mã',
      key: 'code',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main ds-mono">{row.code}</span>
          <span className="ds-cell2__sub">Kỳ {row.seq}/{row.periods}</span>
        </span>
      ),
    },
    { title: 'Hợp đồng', key: 'contract', render: (_, row) => <Link className="ds-mono" to={`/contracts/${row.contract.id}`} onClick={stop}>{row.contract.contract_number}</Link> },
    { title: 'Bắt đầu', dataIndex: 'period_start', render: (value) => <span className="ds-num bl-nowrap">{formatDate(value)}</span> },
    { title: 'Kết thúc', dataIndex: 'period_end', render: (value) => <span className="ds-num bl-nowrap">{formatDate(value)}</span> },
    { title: 'Đối tác', key: 'owner', render: (_, row) => <Link to={`/partners/${row.ship_owner.id}`} onClick={stop}>{row.ship_owner.company_name}</Link> },
    {
      title: 'Thuyền viên',
      key: 'seafarer',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.seafarer.full_name}</span>
          <span className="ds-cell2__sub">{row.seafarer.rank_name}</span>
        </span>
      ),
    },
    {
      title: 'Tàu',
      key: 'vessel',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main"><Link to={`/vessels/${row.vessel.id}`} onClick={stop}>{row.vessel.vessel_name}</Link></span>
          <span className="ds-cell2__sub ds-mono">{row.trip ? row.trip.code : row.voyage?.code}</span>
        </span>
      ),
    },
    { title: 'Hạn thanh toán', dataIndex: 'due_date', render: (value) => <span className="ds-num bl-nowrap">{formatDate(value)}</span> },
    { title: 'Số tiền', dataIndex: 'total_usd', align: 'right', render: (value) => <b className="ds-num">{formatUsd(value, { fixed: true })}</b> },
    { title: 'Trạng thái', key: 'status', render: (_, row) => badge(row) },
    actionColumn((row) => (
      <RowActions name={`yêu cầu thanh toán ${row.code}`} onView={() => open(row)} onEdit={row.status === 'OPEN' && can('bill.update') ? () => navigate(`/bills/${row.id}/edit`) : undefined}>
        {quickAction(row)}
      </RowActions>
    ), { buttons: 3 }),
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách yêu cầu thanh toán" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filtered) {
    body = <EmptyState title="Không có yêu cầu thanh toán nào khớp bộ lọc" description="Thử tìm bằng mã bill, số hợp đồng hoặc tên thuyền viên." action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có yêu cầu thanh toán nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có yêu cầu thanh toán nào" description="Yêu cầu thanh toán tự tạo khi duyệt hợp đồng, mỗi kỳ chốt sổ một bill." action={can('contract.view') ? <Button type="primary" onClick={() => navigate('/contracts')}>Xem hợp đồng</Button> : undefined} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{row.seafarer.full_name} · <span className="ds-mono">{row.code}</span></span>
                <span className="ds-cell2__sub">{row.contract.contract_number} · {row.vessel.vessel_name} · {row.ship_owner.company_name}</span>
                <span className="ds-cell2__sub">Kỳ {row.seq}/{row.periods} · {formatDate(row.period_start)} → {formatDate(row.period_end)} · hạn {formatDate(row.due_date)}</span>
              </span>
              <span className="crew-list__meta">
                {badge(row)}
                <b className="ds-num">{formatUsd(row.total_usd)}</b>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <Table
        rowKey="id"
        className="crew-table"
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={tableScroll}
        onRow={(row) => ({ onClick: () => open(row), onKeyDown: (event) => event.key === 'Enter' && open(row), tabIndex: 0 })}
      />
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm mã bill, số hợp đồng, thuyền viên"
            aria-label="Tìm yêu cầu thanh toán"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          {!shipOwnerId && can('partner.view') ? (
            <Select
              className="vy-owner-filter"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả chủ tàu"
              aria-label="Lọc theo chủ tàu"
              value={ownerId}
              loading={owners.isLoading}
              options={(owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name }))}
              onChange={(value) => { setOwnerId(value); setPage(1) }}
            />
          ) : null}
        </div>
        {body}
        {collecting ? (
          <CollectModal
            bill={collecting}
            open
            pending={move.isPending}
            onCancel={() => setCollecting(null)}
            onConfirm={async (paidDate) => { if (await run(collecting, 'collect', `Đã ghi nhận đã thu ${collecting.code}`, { paid_date: paidDate })) setCollecting(null) }}
          />
        ) : null}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="yêu cầu" note={`Tổng ${formatUsd(list.data?.total_usd, { fixed: true })} USD`} onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
