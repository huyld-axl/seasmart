import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Grid, Input, Select, Skeleton } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'
import { CrewFilterButton } from '../seafarers/CrewFilters'
import { lookupApi } from '../../../api'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useVoyageList } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import { SOURCE_LABELS, VOYAGE_SOURCES, VOYAGE_TABS, VOYAGE_TAB_LABELS } from '../../../constants/opportunityVoyage'
import { formatDate } from '../../../utils/format'
import LeaveModal from './LeaveModal'
import VoyageTable from './VoyageTable'
import { leaveCell, leaveFlagLabel, thisMonth } from './voyageList'
import '../seafarers/SeafarerListPage.css'
import '../opportunities/opportunities.css'
import './voyages.css'

const TABS = VOYAGE_TABS.map((value) => ({ value, label: VOYAGE_TAB_LABELS[value] }))
const SOURCE_OPTIONS = VOYAGE_SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] }))
const LEAVING_OPTIONS = [{ value: 30, label: 'Sắp rời trong 30 ngày' }]

// Màn 8 · Danh sách chuyến: mỗi dòng một thuyền viên đi một tàu. Chọn nhiều chuyến đang trên tàu để ghi rời một lượt.
export default function VoyageListPage() {
  const can = useCan()
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('onboard')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState(thisMonth)
  const [filters, setFilters] = useState({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState([])
  const [leaving, setLeaving] = useState(null)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 }, { enabled: can('partner.view') })
  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const vessels = useQuery({ queryKey: ['vessels-lookup', vesselSearch], queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data), staleTime: 60000 })
  const list = useVoyageList({
    tab,
    search: keyword || undefined,
    from: range?.[0]?.format('YYYY-MM-DD'),
    to: range?.[1]?.format('YYYY-MM-DD'),
    ...filters,
    page,
    limit: pageSize,
  })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/voyages/${row.id}`)
  const filterCount = Object.values(filters).filter(Boolean).length
  const filtered = Boolean(keyword || filterCount)
  const reset = (fn) => (...args) => { fn(...args); setPage(1); setSelected([]) }
  const setFilter = (key, value) => reset(setFilters)((prev) => ({ ...prev, [key]: value }))
  const resetFilters = () => { setSearch(''); setFilters({}); setRange(null); setPage(1); setSelected([]) }
  const mayLeave = can('voyage.run')
  const picked = rows.filter((row) => selected.includes(row.id))

  const createButton = can('voyage.create')
    ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/voyages/new')}>Tạo chuyến</Button>
    : undefined

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách chuyến" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && (filtered || range)) {
    body = <EmptyState title="Không có chuyến nào khớp bộ lọc" description={range ? 'Thử nới khoảng "Trên tàu trong", hoặc tìm bằng tên, mã chuyến.' : 'Thử tìm bằng tên thuyền viên hoặc mã chuyến.'} action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có chuyến nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có chuyến nào" description="Chuyến sinh ra khi chốt người trên cơ hội, hoặc tạo tay khi không qua tuyển." action={createButton} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => {
          const flag = leaveFlagLabel(row.leave_flag)
          return (
            <li key={row.id}>
              <button type="button" className="crew-list__row" onClick={() => open(row)}>
                <span className="ds-cell2">
                  <span className="ds-cell2__main">{row.seafarer_name} · <span className="ds-mono">{row.code}</span></span>
                  <span className="ds-cell2__sub">{row.rank_name} · {row.vessel_name}</span>
                  <span className="ds-cell2__sub">Lên {formatDate(row.join_date)} · rời {formatDate(leaveCell(row, formatDate).date)}{flag ? ` · ${flag.text}` : ''}</span>
                </span>
                <span className="crew-list__meta">
                  <StatusBadge group="voyage" value={row.status} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  } else {
    body = (
      <VoyageTable
        rows={rows}
        scroll={tableScroll}
        selected={mayLeave ? selected : null}
        onSelect={setSelected}
        onOpen={open}
      />
    )
  }

  const filterSelect = (key, label, props) => (
    <label className="crew-filterbar__field crew-filterbar__field--wide">
      <span>{label}</span>
      <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" value={filters[key]} onChange={(value) => setFilter(key, value)} {...props} />
    </label>
  )

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs compact tabs={tabs} value={tab} onChange={reset(setTab)} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm thuyền viên, mã chuyến…"
            aria-label="Tìm chuyến"
            value={search}
            onChange={(event) => reset(setSearch)(event.target.value)}
          />
          <DatePicker.RangePicker
            className="vy-range"
            format="DD/MM/YYYY"
            value={range}
            onChange={reset(setRange)}
            placeholder={['Trên tàu từ', 'đến']}
            aria-label="Trên tàu trong khoảng"
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
            {filterSelect('source', 'Nguồn', { placeholder: 'Chọn nguồn', 'aria-label': 'Lọc theo nguồn', options: SOURCE_OPTIONS })}
            {filterSelect('leaving_within', 'Rời tàu', { placeholder: 'Bất kỳ', 'aria-label': 'Lọc sắp rời tàu', options: LEAVING_OPTIONS })}
            <Button className="crew-filterbar__clear" disabled={!filterCount} onClick={() => reset(setFilters)({})}>Xoá bộ lọc</Button>
          </div>
        ) : null}
        {picked.length ? (
          <div className="op-bulk">
            <b>Đã chọn {picked.length} chuyến</b>
            <Button size="small" type="primary" onClick={() => setLeaving(picked)}>Ghi rời tàu</Button>
            <Button size="small" type="text" onClick={() => setSelected([])}>Bỏ chọn</Button>
          </div>
        ) : null}
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="chuyến" onChange={(next, size) => { setPage(next); setPageSize(size); setSelected([]) }} />
        )}
      </div>
      {leaving ? <LeaveModal voyages={leaving} onClose={() => setLeaving(null)} onDone={() => setSelected([])} /> : null}
    </div>
  )
}
