import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Input, Select, Skeleton, Table } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'
import { CrewFilterButton } from '../seafarers/CrewFilters'
import { lookupApi } from '../../../api'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useOpportunityList } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import { OPPORTUNITY_TABS, OPPORTUNITY_TAB_LABELS } from '../../../constants/opportunityVoyage'
import { formatDate, formatUsd } from '../../../utils/format'
import { chosenCandidate, deadlineLabel } from './opportunityView'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './opportunities.css'

const TABS = OPPORTUNITY_TABS.map((value) => ({ value, label: OPPORTUNITY_TAB_LABELS[value] }))

// Liên kết trong ô của dòng: bấm vào liên kết thì không mở chi tiết cơ hội.
function RowLink({ to, children }) {
  return <Link to={to} onClick={(event) => event.stopPropagation()}>{children}</Link>
}

function Deadline({ row }) {
  const flag = deadlineLabel(row.deadline_flag)
  return (
    <span className="ds-cell2">
      <span className={`ds-num${row.status === 'OPEN' ? '' : ' vd-muted'}`}>{formatDate(row.deadline)}</span>
      {flag ? <span className={`crew-docs crew-docs--${flag.tone}`}>{flag.text}</span> : null}
    </span>
  )
}

function Place({ date, port }) {
  return (
    <span className="ds-cell2">
      <span className="ds-num">{formatDate(date)}</span>
      <span className="ds-cell2__sub">{port || '—'}</span>
    </span>
  )
}

// Danh sách cơ hội: mỗi dòng một vị trí chủ tàu cần người.
export default function OpportunityListPage() {
  const can = useCan()
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 }, { enabled: can('partner.view') })
  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const vessels = useQuery({ queryKey: ['vessels-lookup', vesselSearch], queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data), staleTime: 60000 })
  const list = useOpportunityList({ tab, search: keyword || undefined, ...filters, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/opportunities/${row.id}`)
  const filterCount = Object.values(filters).filter(Boolean).length
  const filtered = Boolean(keyword || filterCount)
  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }
  const resetFilters = () => { setSearch(''); setFilters({}); setPage(1) }

  const columns = [
    { title: 'Mã', dataIndex: 'code', render: (value) => <span className="ds-mono">{value}</span> },
    { title: 'Vị trí', dataIndex: 'rank_name', render: (value) => <span className="ds-cell2__main">{value}</span> },
    {
      title: 'Tàu',
      key: 'vessel',
      render: (_, row) => (row.vessel_name
        ? (can('vessel.view') ? <RowLink to={`/vessels/${row.vessel_id}`}>{row.vessel_name}</RowLink> : row.vessel_name)
        : <span className="vd-muted">Chưa rõ tàu</span>),
    },
    {
      title: 'Chủ tàu',
      key: 'owner',
      render: (_, row) => (can('partner.view') ? <RowLink to={`/partners/${row.ship_owner_id}`}>{row.ship_owner_name}</RowLink> : row.ship_owner_name),
    },
    { title: 'Xuống tàu dự kiến', key: 'join', render: (_, row) => <Place date={row.planned_join_date} port={row.planned_join_port_name} /> },
    {
      title: 'Ứng viên được chốt',
      key: 'chosen',
      render: (_, row) => {
        const chosen = chosenCandidate(row)
        if (!chosen) return <span className="vd-muted">—</span>
        return chosen.seafarerId && can('seafarer.view') ? <RowLink to={`/seafarers/${chosen.seafarerId}`}>{chosen.name}</RowLink> : chosen.name
      },
    },
    { title: 'Hạn chốt', key: 'deadline', responsive: ['lg'], render: (_, row) => <Deadline row={row} /> },
    { title: 'Trạng thái', dataIndex: 'display_status', render: (value) => <StatusBadge group="opportunity" value={value} /> },
    { title: 'Budget/tháng (USD)', dataIndex: 'budget_monthly_usd', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{formatUsd(value)}</span> },
    actionColumn((row) => (
      <RowActions
        name={`cơ hội ${row.code}`}
        onView={() => open(row)}
        onEdit={row.status === 'OPEN' && can('opportunity.update') ? () => navigate(`/opportunities/${row.id}/edit`) : undefined}
      />
    )),
  ]

  const createButton = can('opportunity.create')
    ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/opportunities/new')}>Tạo cơ hội</Button>
    : undefined

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách cơ hội" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filtered) {
    body = <EmptyState title="Không có cơ hội nào khớp bộ lọc" description="Thử tìm bằng mã, chức danh hoặc tên tàu." action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có cơ hội nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có cơ hội nào" description="Mỗi cơ hội là một vị trí chủ tàu cần người. Cần nhiều vị trí thì tạo nhiều cơ hội." action={createButton} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{row.rank_name} · <span className="ds-mono">{row.code}</span></span>
                <span className="ds-cell2__sub">{row.vessel_name || 'Chưa rõ tàu'} · {row.ship_owner_name}</span>
                <span className="ds-cell2__sub">Xuống {formatDate(row.planned_join_date)}{chosenCandidate(row) ? ` · ${chosenCandidate(row).name}` : ''}</span>
              </span>
              <span className="crew-list__meta">
                <StatusBadge group="opportunity" value={row.display_status} />
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

  const filterSelect = (key, label, props) => (
    <label className="crew-filterbar__field crew-filterbar__field--wide">
      <span>{label}</span>
    <Select
      style={{ width: '100%' }}
      allowClear
      showSearch
      optionFilterProp="label"
      value={filters[key]}
      onChange={(value) => setFilter(key, value)}
      {...props}
    />
    </label>
  )

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs compact tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm mã, chức danh, tàu"
            aria-label="Tìm cơ hội"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          <span className="ds-toolbar__end">
            <CrewFilterButton count={filterCount} open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} />
            {createButton}
          </span>
        </div>
        {filtersOpen ? (
        <div className="crew-filterbar" id="crew-filter-bar">
          {filterSelect('vessel_id', 'Tàu', {
            placeholder: 'Chọn tàu',
            'aria-label': 'Lọc theo tàu',
            filterOption: false,
            onSearch: setVesselSearch,
            loading: vessels.isLoading,
            options: (vessels.data || []).map((v) => ({ value: v.id, label: v.vessel_name })),
          })}
          {can('partner.view') ? filterSelect('ship_owner_id', 'Chủ tàu', {
            placeholder: 'Chọn chủ tàu',
            'aria-label': 'Lọc theo chủ tàu',
            loading: owners.isLoading,
            options: (owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name })),
          }) : null}
          {filterSelect('rank_id', 'Chức danh', {
            placeholder: 'Chọn chức danh',
            'aria-label': 'Lọc theo chức danh',
            loading: ranks.isLoading,
            options: (ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi })),
          })}
          <Button className="crew-filterbar__clear" disabled={!filterCount} onClick={() => setFilters({})}>Xoá bộ lọc</Button>
        </div>
        ) : null}
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="cơ hội" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
