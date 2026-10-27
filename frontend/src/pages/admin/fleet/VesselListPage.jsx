import { withFlag } from '../../../utils/flag'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Grid, Input, Skeleton, Table, Tooltip } from 'antd'
import { GlobalOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import { vesselApi } from '../../../api/fleetApi'
import { useFleetList } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { VESSEL_STATUS_OPTIONS } from './fleetView'
import { FleetTile } from './FleetParts'
import VesselCatalogPanel from './VesselCatalogPanel'
import '../seafarers/SeafarerListPage.css'
import './fleet.css'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'

const muted = (value) => (value == null || value === '' ? <span style={{ color: 'var(--muted)' }}>—</span> : value)

function VesselCell({ row }) {
  return (
    <span className="fl-who">
      <FleetTile />
      <span className="ds-cell2">
        <span className="ds-cell2__main">{row.vessel_name}</span>
        <span className="ds-cell2__sub">{row.vessel_type_name || 'Chưa có loại tàu'}</span>
        {row.status !== 'ACTIVE' ? <span style={{ marginTop: 4, justifySelf: 'start' }}><StatusBadge group="vesselStatus" value={row.status} /></span> : null}
      </span>
    </span>
  )
}

// Danh sách tàu: cùng khuôn với danh sách thuyền viên. Bấm cả dòng để mở chi tiết.
export default function VesselListPage() {
  const navigate = useNavigate()
  const can = useCan()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // Danh mục tàu thế giới: `key` đổi mỗi lần mở để panel bắt đầu lại từ ô tìm sạch (hoặc từ khoá đang tìm).
  const [catalog, setCatalog] = useState({ open: false, key: 0, query: '' })
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const list = useFleetList('vessels', vesselApi, { status: tab === 'all' ? undefined : tab, search: keyword || undefined, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = [{ value: 'all', label: 'Tất cả' }, ...VESSEL_STATUS_OPTIONS].map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/vessels/${row.id}`)
  const openCatalog = (query = '') => setCatalog((previous) => ({ open: true, key: previous.key + 1, query }))
  const clearSearch = () => { setSearch(''); setPage(1) }

  const columns = [
    { title: 'Tàu', key: 'vessel', render: (_, row) => <VesselCell row={row} /> },
    { title: 'IMO', dataIndex: 'imo_number', render: (value) => (value ? <span className="ds-mono">{value}</span> : <span style={{ color: 'var(--muted)' }}>Không có IMO</span>) },
    { title: 'Cờ', dataIndex: 'flag_name', responsive: ['lg'], render: (value, row) => muted(value ? withFlag(row.flag_code, value, row.flag_emoji) : null) },
    { title: 'Chủ tàu', dataIndex: 'ship_owner_name', responsive: ['lg'], render: muted },
    { title: 'GRT', dataIndex: 'gross_tonnage', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{value == null ? '—' : Number(value).toLocaleString('vi-VN')}</span> },
    { title: 'Đang trên tàu', dataIndex: 'crew_on_board', align: 'right', render: (value) => <span className="ds-num">{value}</span> },
    actionColumn((row) => <RowActions name={row.vessel_name} onView={() => open(row)} onEdit={can('vessel.update') ? () => navigate(`/vessels/${row.id}/edit`) : undefined} />),
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách tàu" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && keyword) {
    const isImo = /^\d{7}$/.test(keyword)
    body = isImo ? (
      <EmptyState
        title={`Chưa có tàu IMO ${keyword} trong MCAH`}
        description="Thêm tàu này: IMO được điền sẵn, và bạn có thể bấm Lấy thông minh ở form để điền các thông số còn lại."
        action={
          <>
            <Button onClick={clearSearch}>Xoá tìm kiếm</Button>
            {can('vessel.create') ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vessels/new', { state: { prefill: { imo_number: keyword } } })}>Thêm tàu IMO {keyword}</Button> : null}
          </>
        }
      />
    ) : (
      <EmptyState
        title={`Không có tàu nào khớp "${keyword}"`}
        description="Tàu có thể chưa được thêm. Tìm trong Danh mục tàu thế giới, hoặc thêm thủ công."
        action={
          <>
            <Button onClick={clearSearch}>Xoá tìm kiếm</Button>
            {can('vessel.create') ? <Button type="primary" icon={<GlobalOutlined />} onClick={() => openCatalog(keyword)}>Danh mục tàu thế giới</Button> : null}
          </>
        }
      />
    )
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có tàu nào ở trạng thái này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có tàu nào" description="Thêm tàu để dùng khi đối chiếu sea service và tạo bộ giấy." action={can('vessel.create') ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vessels/new')}>Thêm tàu</Button> : undefined} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <VesselCell row={row} />
              <span className="crew-list__meta">
                <span className="ds-cell2__sub">{[row.imo_number ? `IMO ${row.imo_number}` : 'Không có IMO', row.flag_name && withFlag(row.flag_code, row.flag_name, row.flag_emoji), row.ship_owner_name].filter(Boolean).join(' · ')}</span>
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
      <VesselCatalogPanel key={catalog.key} open={catalog.open} initialQuery={catalog.query} onClose={() => setCatalog((previous) => ({ ...previous, open: false }))} />
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs compact tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <span className="fl-searchgroup">
            <Input
              className="ds-toolbar__search"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm tên tàu, IMO, chủ tàu"
              aria-label="Tìm tàu"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            />
            {can('vessel.create') ? (
              <Tooltip title="Danh mục tàu thế giới">
                <Button icon={<GlobalOutlined />} aria-label="Danh mục tàu thế giới" onClick={() => openCatalog()} />
              </Tooltip>
            ) : null}
          </span>
          {can('vessel.create') ? (
            <span className="ds-toolbar__end">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vessels/new')}>Thêm tàu</Button>
            </span>
          ) : null}
        </div>
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="tàu" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
