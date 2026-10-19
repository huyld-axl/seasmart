import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Grid, Input, Pagination, Select, Skeleton, Table } from 'antd'
import { PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useVoyageList } from '../../../hooks/useVoyages'
import { formatDate, formatDiff, formatUsd } from '../../../utils/format'
import { DueTag, FillBar } from './VoyageParts'
import '../seafarers/SeafarerListPage.css'
import './voyages.css'

const PAGE_SIZE = 20
const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'RECRUITING', label: 'Đang tuyển' },
  { value: 'FULL', label: 'Đủ người' },
  { value: 'ONBOARD', label: 'Đang trên tàu' },
  { value: 'ENDED', label: 'Đã kết thúc' },
]

// Cột Xuống → rời tàu: ngày thực tế nếu có (kèm chữ "thực tế"), dòng dưới là ngày rời, rồi nhãn trễ ngày.
function DatesCell({ row }) {
  const embark = row.actual_embark_date || row.planned_embark_date
  const disembark = row.actual_disembark_date || row.planned_disembark_date
  return (
    <span className="vy-dates">
      <span className="vy-dates__main">
        {formatDate(embark)}
        {row.actual_embark_date ? <span className="vy-tag">thực tế</span> : null}
      </span>
      <span className="vy-dates__sub">
        → {formatDate(disembark)}
        {row.actual_disembark_date ? <span className="vy-tag">thực tế</span> : null}
      </span>
      <DueTag due={row.due} />
    </span>
  )
}

function VesselCell({ row }) {
  return (
    <span className="ds-cell2">
      <span className="ds-cell2__main">{row.vessel_name}</span>
      <span className="ds-cell2__sub">{row.ship_owner_name}</span>
    </span>
  )
}

// Danh sách chuyến tàu: cùng khuôn với danh sách đối tác (PartnerListPage).
export default function VoyageListPage() {
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState()
  const [page, setPage] = useState(1)
  const keyword = search.trim()

  const owners = useFleetList('ship-owners', shipOwnerApi, { limit: 100 })
  const list = useVoyageList({ tab: tab === 'all' ? undefined : tab, search: keyword || undefined, ship_owner_id: ownerId, page, limit: PAGE_SIZE })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/voyages/${row.id}`)
  const filtered = Boolean(keyword || ownerId)
  const resetFilters = () => { setSearch(''); setOwnerId(undefined); setPage(1) }

  const columns = [
    { title: 'Mã chuyến', dataIndex: 'code', render: (code) => <span className="ds-mono">{code}</span> },
    { title: 'Tàu · chủ tàu', key: 'vessel', render: (_, row) => <VesselCell row={row} /> },
    { title: 'Xuống → rời tàu', key: 'dates', render: (_, row) => <DatesCell row={row} /> },
    { title: 'Vị trí', key: 'positions', render: (_, row) => <FillBar done={row.positions_filled} total={row.positions_total} /> },
    { title: 'Budget dự kiến/tháng', dataIndex: 'budget_monthly_sum', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{formatUsd(value)}</span> },
    { title: 'Chênh lệch/tháng', dataIndex: 'diff_monthly_sum', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{formatDiff(value)}</span> },
    { title: 'Trạng thái', dataIndex: 'display_status', render: (value) => <StatusBadge group="voyage" value={value} /> },
    { title: <span className="ds-sr-only">Mở</span>, key: 'open', width: 48, align: 'right', render: () => <RightOutlined className="crew-chevron" /> },
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách chuyến tàu" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filtered) {
    body = <EmptyState title="Không có chuyến nào khớp bộ lọc" description="Thử tìm bằng mã chuyến, tên tàu hoặc chọn chủ tàu khác." action={<Button onClick={resetFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có chuyến nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có chuyến tàu nào" description="Tạo chuyến để chọn tàu, các vị trí cần người và budget; hợp đồng tạo từ từng vị trí." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/voyages/new')}>Tạo chuyến tàu</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{row.vessel_name} · <span className="ds-mono">{row.code}</span></span>
                <span className="ds-cell2__sub">{formatDate(row.actual_embark_date || row.planned_embark_date)} → {formatDate(row.actual_disembark_date || row.planned_disembark_date)}</span>
                <DueTag due={row.due} />
              </span>
              <span className="crew-list__meta">
                <StatusBadge group="voyage" value={row.display_status} />
                <span className="ds-cell2__sub">{row.positions_filled}/{row.positions_total} vị trí có hợp đồng</span>
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
        scroll={{ x: 'max-content' }}
        onRow={(row) => ({ onClick: () => open(row), onKeyDown: (event) => event.key === 'Enter' && open(row), tabIndex: 0 })}
      />
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Chuyến tàu</h1>
          <p className="ds-page__desc">Mỗi chuyến là một lần đưa người lên một tàu, gồm nhiều vị trí. Hợp đồng tạo từ từng vị trí.</p>
        </div>
        <div className="ds-page__actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/voyages/new')}>Tạo chuyến tàu</Button>
        </div>
      </div>
      <div className="ds-toolbar">
        <StatusTabs tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
      </div>
      <div className="ds-card">
        <div className="ds-toolbar crew-toolbar">
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm mã chuyến, tên tàu"
            aria-label="Tìm chuyến tàu"
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
        </div>
        {body}
        {rows.length > 0 && (
          <div className="ds-table-foot">
            <span className="ds-num">{total} chuyến · ngày dự kiến, trừ chỗ ghi "thực tế"</span>
            <span className="vy-foot-unit">USD</span>
            {total > PAGE_SIZE && <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} onChange={setPage} />}
          </div>
        )}
      </div>
    </div>
  )
}
