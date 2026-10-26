import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Input, Select, Skeleton, Table } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'
import { lookupApi } from '../../../api'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useOpportunityList } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import { OPPORTUNITY_TABS, OPPORTUNITY_TAB_LABELS } from '../../../constants/opportunityVoyage'
import { formatDate, formatUsd } from '../../../utils/format'
import { candidateSummary, deadlineLabel } from './opportunityView'
import '../seafarers/SeafarerListPage.css'
import '../voyages/voyages.css'
import './opportunities.css'

const TABS = OPPORTUNITY_TABS.map((value) => ({ value, label: OPPORTUNITY_TAB_LABELS[value] }))

function Deadline({ row }) {
  const flag = deadlineLabel(row.deadline_flag)
  return (
    <span className="ds-cell2">
      <span className={`ds-num${row.status === 'OPEN' ? '' : ' vd-muted'}`}>{formatDate(row.deadline)}</span>
      {flag ? <span className={`op-flag op-flag--${flag.tone}`}>{flag.text}</span> : null}
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
  const filtered = Boolean(keyword || Object.values(filters).some(Boolean))
  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }
  const resetFilters = () => { setSearch(''); setFilters({}); setPage(1) }

  const columns = [
    {
      title: 'Cơ hội · chức danh',
      key: 'rank',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.rank_name}</span>
          <span className="ds-cell2__sub ds-mono">{row.code}</span>
        </span>
      ),
    },
    {
      title: 'Tàu · chủ tàu',
      key: 'vessel',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className={row.vessel_name ? 'ds-cell2__main' : 'ds-cell2__main vd-muted'}>{row.vessel_name || 'Chưa rõ tàu'}</span>
          <span className="ds-cell2__sub">{row.ship_owner_name}</span>
        </span>
      ),
    },
    { title: 'Xuống tàu dự kiến', key: 'join', render: (_, row) => <Place date={row.planned_join_date} port={row.planned_join_port_name} /> },
    { title: 'Rời tàu dự kiến', key: 'leave', responsive: ['xl'], render: (_, row) => <Place date={row.planned_leave_date} port={row.planned_leave_port_name} /> },
    {
      title: 'Ứng viên',
      key: 'candidates',
      render: (_, row) => {
        const s = candidateSummary(row, formatDate)
        return (
          <span className="ds-cell2">
            <span className={s.muted ? 'ds-cell2__main vd-muted' : 'ds-cell2__main'}>{s.main}</span>
            {s.sub ? <span className="ds-cell2__sub">{s.sub}</span> : null}
          </span>
        )
      },
    },
    { title: 'Hạn chốt', key: 'deadline', responsive: ['lg'], render: (_, row) => <Deadline row={row} /> },
    { title: 'Trạng thái', dataIndex: 'display_status', render: (value) => <StatusBadge group="opportunity" value={value} /> },
    { title: 'Budget/tháng', dataIndex: 'budget_monthly_usd', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{formatUsd(value)}</span> },
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
                <span className="ds-cell2__sub">Xuống {formatDate(row.planned_join_date)} · {candidateSummary(row, formatDate).main}</span>
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

  const filterSelect = (key, props) => (
    <Select
      className="vy-owner-filter"
      allowClear
      showSearch
      optionFilterProp="label"
      value={filters[key]}
      onChange={(value) => setFilter(key, value)}
      {...props}
    />
  )

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm mã, chức danh, tàu"
            aria-label="Tìm cơ hội"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          {createButton ? <span className="ds-toolbar__end">{createButton}</span> : null}
        </div>
        <div className="ds-toolbar crew-toolbar op-filters">
          {filterSelect('vessel_id', {
            placeholder: 'Tất cả tàu',
            'aria-label': 'Lọc theo tàu',
            filterOption: false,
            onSearch: setVesselSearch,
            loading: vessels.isLoading,
            options: (vessels.data || []).map((v) => ({ value: v.id, label: v.vessel_name })),
          })}
          {can('partner.view') ? filterSelect('ship_owner_id', {
            placeholder: 'Tất cả chủ tàu',
            'aria-label': 'Lọc theo chủ tàu',
            loading: owners.isLoading,
            options: (owners.data?.data || []).map((o) => ({ value: o.id, label: o.company_name })),
          }) : null}
          {filterSelect('rank_id', {
            placeholder: 'Tất cả chức danh',
            'aria-label': 'Lọc theo chức danh',
            loading: ranks.isLoading,
            options: (ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi })),
          })}
        </div>
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="cơ hội" note="Budget tính bằng USD" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
