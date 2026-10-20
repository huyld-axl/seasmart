import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Grid, Input, Select, Skeleton, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useContractList, useVoyageList } from '../../../hooks/useVoyages'
import { formatDate, formatDiff, formatUsd } from '../../../utils/format'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './contracts.css'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'ACTIVE', label: 'Hiệu lực' },
  { value: 'ENDED', label: 'Hết hạn' },
]

// Danh sách hợp đồng: không có nút tạo, hợp đồng tạo từ vị trí của chuyến tàu.
export default function ContractListPage() {
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState()
  const [voyageId, setVoyageId] = useState()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 })
  const voyages = useVoyageList({ limit: 100 })
  const list = useContractList({ tab: tab === 'all' ? undefined : tab, search: keyword || undefined, ship_owner_id: ownerId, voyage_id: voyageId, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/contracts/${row.id}`)
  const filtered = Boolean(keyword || ownerId || voyageId)
  const resetFilters = () => { setSearch(''); setOwnerId(undefined); setVoyageId(undefined); setPage(1) }

  const columns = [
    { title: 'Số hợp đồng', dataIndex: 'contract_number', render: (value) => <span className="ds-mono">{value}</span> },
    {
      title: 'Thuyền viên',
      key: 'seafarer',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.seafarer_name}</span>
          <span className="ds-cell2__sub">{row.rank_name}</span>
        </span>
      ),
    },
    {
      title: 'Tàu',
      key: 'vessel',
      responsive: ['xl'],
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.vessel_name}</span>
          <span className="ds-cell2__sub ds-mono">{row.voyage_code}</span>
        </span>
      ),
    },
    { title: 'Bắt đầu → kết thúc', key: 'dates', render: (_, row) => <span className="ds-num">{formatDate(row.start_date)} → {formatDate(row.end_date)}</span> },
    {
      title: 'Thu · chi/tháng',
      key: 'money',
      align: 'right',
      responsive: ['lg'],
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main ds-num">{formatUsd(row.receivable_monthly)}</span>
          <span className="ds-cell2__sub ds-num">chi {formatUsd(row.payable_monthly)}</span>
        </span>
      ),
    },
    { title: 'Chênh lệch', dataIndex: 'diff_monthly', align: 'right', render: (value) => <b className="ds-num">{formatDiff(value)}</b> },
    { title: 'Trạng thái', dataIndex: 'status', render: (value) => <StatusBadge group="contract" value={value} /> },
    actionColumn((row) => <RowActions name={`hợp đồng ${row.contract_number}`} onView={() => open(row)} onEdit={['DRAFT', 'REJECTED'].includes(row.status) ? () => navigate(`/contracts/${row.id}/edit`) : undefined} />),
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách hợp đồng" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filtered) {
    body = <EmptyState title="Không có hợp đồng nào khớp bộ lọc" description="Thử tìm bằng số hợp đồng hoặc tên thuyền viên." action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có hợp đồng nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có hợp đồng nào" description="Mở một chuyến tàu, bấm Tạo hợp đồng ở dòng vị trí còn trống." action={<Button type="primary" onClick={() => navigate('/voyages')}>Xem chuyến tàu</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{row.seafarer_name} · <span className="ds-mono">{row.contract_number}</span></span>
                <span className="ds-cell2__sub">{row.rank_name} · {row.vessel_name}</span>
                <span className="ds-cell2__sub">{formatDate(row.start_date)} → {formatDate(row.end_date)}</span>
              </span>
              <span className="crew-list__meta">
                <StatusBadge group="contract" value={row.status} />
                <b className="ds-num">{formatDiff(row.diff_monthly)}</b>
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
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Hợp đồng</h1>
          <p className="ds-page__desc">Hợp đồng tạo từ vị trí của chuyến tàu. Nháp và bị từ chối thì sửa được; chờ duyệt và hiệu lực thì khoá.</p>
        </div>
      </div>
      <div className="ds-toolbar">
        <StatusTabs tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
      </div>
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm số hợp đồng, thuyền viên"
            aria-label="Tìm hợp đồng"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
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
          <Select
            className="vy-owner-filter"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả chuyến"
            aria-label="Lọc theo chuyến"
            value={voyageId}
            loading={voyages.isLoading}
            options={(voyages.data?.data || []).map((v) => ({ value: v.id, label: `${v.code} · ${v.vessel_name}` }))}
            onChange={(value) => { setVoyageId(value); setPage(1) }}
          />
        </div>
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="hợp đồng" note="Số tiền tính bằng USD" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
