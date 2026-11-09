import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Select, Skeleton, Table } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import { lookupApi, seafarerApi } from '../../../api'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useContractList } from '../../../hooks/useVoyages'
import { formatDate, formatDiff, formatUsd } from '../../../utils/format'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './contracts.css'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'
import { useCan } from '../../../hooks/usePermission'
import { CrewFilterButton } from '../seafarers/CrewFilters'
import useViewport from '../../../hooks/useViewport'
import ListFilters from '../../../components/ds/ListFilters'
import Fab from '../../../components/ds/Fab'

const stop = (event) => event.stopPropagation()

// Ô tiền nổi bật: thu xanh mũi tên lên, chi đỏ mũi tên xuống, chênh lệch theo dấu. Số 0 để xám, không mũi tên.
function MoneyChip({ value, children, strong = false }) {
  const n = Number(value)
  const tone = n > 0 ? 'up' : n < 0 ? 'down' : 'zero'
  const Icon = n > 0 ? ArrowUpOutlined : n < 0 ? ArrowDownOutlined : null
  return (
    <span className={`ct-money ct-money--${tone}${strong ? ' ct-money--strong' : ''}`}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </span>
  )
}

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'ACTIVE', label: 'Hiệu lực' },
  { value: 'ENDED', label: 'Đã kết thúc' },
]

// Danh sách hợp đồng. Hợp đồng luôn thuộc một chuyến: sinh khi chốt người trên cơ hội, hoặc thêm tay từ chuyến chưa có hợp đồng.
export default function ContractListPage() {
  const can = useCan()
  const navigate = useNavigate()
  const isMobile = useViewport().isCompact
  // ?tab= mở sẵn một tab (link từ Tổng quan).
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'all'))
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const vessels = useQuery({ queryKey: ['vessels-lookup', vesselSearch], queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data), staleTime: 60000 })
  const people = useQuery({ queryKey: ['seafarer-pick', personSearch], queryFn: () => seafarerApi.list({ search: personSearch || undefined, limit: 20 }).then((r) => r.data.data), enabled: can('seafarer.view') })
  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 }, { enabled: can('partner.view') })
  const list = useContractList({ tab: tab === 'all' ? undefined : tab, search: keyword || undefined, ...filters, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/contracts/${row.id}`)
  const filterCount = Object.values(filters).filter(Boolean).length
  const filtered = Boolean(keyword || filterCount)
  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }
  const createButton = can('contract.create')
    ? <Button className="ds-toolbar__add" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/contracts/new')}>Thêm hợp đồng</Button>
    : undefined
  const resetFilters = () => { setSearch(''); setFilters({}); setPage(1) }

  const columns = [
    { title: 'Số hợp đồng', dataIndex: 'contract_number', render: (value) => <span className="ds-mono">{value}</span> },
    { title: 'Bắt đầu', dataIndex: 'start_date', render: (value) => <span className="ds-num">{formatDate(value)}</span> },
    { title: 'Kết thúc', dataIndex: 'end_date', render: (value) => <span className="ds-num">{formatDate(value)}</span> },
    {
      title: 'Chủ tàu',
      key: 'owner',
      responsive: ['lg'],
      render: (_, row) => (can('partner.view') && row.ship_owner_id ? <Link to={`/partners/${row.ship_owner_id}`} onClick={stop}>{row.ship_owner_name}</Link> : row.ship_owner_name),
    },
    {
      title: 'Chuyến · tàu',
      key: 'vessel',
      responsive: ['xl'],
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main ds-mono">
            {row.trip && can('voyage.view') ? <Link to={`/voyages/${row.trip.id}`} onClick={stop}>{row.trip.code}</Link> : (row.trip ? row.trip.code : row.voyage_code)}
          </span>
          <span className="ds-cell2__sub">
            {row.vessel_id && can('vessel.view') ? <Link to={`/vessels/${row.vessel_id}`} onClick={stop}>{row.vessel_name}</Link> : row.vessel_name}
          </span>
        </span>
      ),
    },
    { title: 'Thu/tháng', dataIndex: 'receivable_monthly', align: 'right', responsive: ['lg'], render: (value) => <MoneyChip value={value}>{formatUsd(value)}</MoneyChip> },
    {
      title: 'Thuyền viên',
      key: 'seafarer',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main ct-plain">
            {can('seafarer.view') ? <Link to={`/seafarers/${row.seafarer_id}`} onClick={stop}>{row.seafarer_name}</Link> : row.seafarer_name}
          </span>
          <span className="ds-cell2__sub">{row.rank_name}</span>
        </span>
      ),
    },
    { title: 'Chi/tháng', dataIndex: 'payable_monthly', align: 'right', responsive: ['lg'], render: (value) => <MoneyChip value={-Number(value)}>{Number(value) > 0 ? '-' : ''}{formatUsd(value)}</MoneyChip> },
    { title: 'Chênh lệch', dataIndex: 'diff_monthly', align: 'right', render: (value) => <MoneyChip value={value} strong>{formatDiff(value)}</MoneyChip> },
    { title: 'Trạng thái', key: 'status', render: (_, row) => <StatusBadge group="contract" value={row.status} /> },
    actionColumn((row) => <RowActions name={`hợp đồng ${row.contract_number}`} onView={() => open(row)} onEdit={['DRAFT', 'REJECTED'].includes(row.status) && can('contract.update') ? () => navigate(`/contracts/${row.id}/edit`) : undefined} />),
  ]

  const filterSelect = (key, label, props) => (
    <label className="crew-filterbar__field crew-filterbar__field--wide">
      <span>{label}</span>
      <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" value={filters[key]} onChange={(value) => setFilter(key, value)} {...props} />
    </label>
  )

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
    body = <EmptyState title="Chưa có hợp đồng nào" description="Hợp đồng sinh khi chốt người trên cơ hội, hoặc thêm tay cho chuyến chưa có hợp đồng." action={createButton} />
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
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs compact phone="chips" tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm số hợp đồng, thuyền viên"
            aria-label="Tìm hợp đồng"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          <span className="ds-toolbar__end">
            <CrewFilterButton count={filterCount} open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} />
            {createButton}
          </span>
        </div>
        <ListFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} count={filterCount} onClear={() => { setFilters({}); setPage(1) }} total={total} unit="hợp đồng" loading={list.isLoading}>
            {can('partner.view') ? filterSelect('ship_owner_id', 'Chủ tàu', {
              placeholder: 'Chọn chủ tàu',
              'aria-label': 'Lọc theo chủ tàu',
              loading: owners.isLoading,
              options: (owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name })),
            }) : null}
            {filterSelect('vessel_id', 'Tàu', {
              placeholder: 'Chọn tàu',
              'aria-label': 'Lọc theo tàu',
              filterOption: false,
              onSearch: setVesselSearch,
              loading: vessels.isLoading,
              options: (vessels.data || []).map((v) => ({ value: v.id, label: v.vessel_name })),
            })}
            {can('seafarer.view') ? filterSelect('seafarer_id', 'Thuyền viên', {
              placeholder: 'Tìm thuyền viên',
              'aria-label': 'Lọc theo thuyền viên',
              filterOption: false,
              onSearch: setPersonSearch,
              loading: people.isLoading,
              options: (people.data || []).map((p) => ({ value: p.id, label: p.full_name })),
            }) : null}
            {filterSelect('rank_id', 'Chức danh', {
              placeholder: 'Chọn chức danh',
              'aria-label': 'Lọc theo chức danh',
              loading: ranks.isLoading,
              options: (ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi })),
            })}
        </ListFilters>
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="hợp đồng" note="Số tiền tính bằng USD" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
      {can('contract.create') ? <Fab label="Thêm hợp đồng" onClick={() => navigate('/contracts/new')} /> : null}
    </div>
  )
}
