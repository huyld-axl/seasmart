import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Grid, Input, Skeleton, Table } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useFleetList, usePartnerLogo } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { initialsOfName } from './fleetView'
import { FleetTile } from './FleetParts'
import '../seafarers/SeafarerListPage.css'
import './fleet.css'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import useListSticky from '../../../components/ds/useListSticky'
import ListFooter from '../../../components/ds/ListFooter'

const TAB_ACTIVE = { all: undefined, active: '1', inactive: '0' }
const muted = (value) => (value == null || value === '' ? <span style={{ color: 'var(--muted)' }}>—</span> : value)

function PartnerCell({ row }) {
  const logo = usePartnerLogo(row)
  return (
    <span className="fl-who">
      <FleetTile text={initialsOfName(row.company_name)} src={logo} />
      <span className="ds-cell2">
        <span className="ds-cell2__main">{row.company_name}</span>
        {Number(row.is_active) === 0 ? <span className="fl-pill">Ngừng hợp tác</span> : null}
      </span>
    </span>
  )
}

// Danh sách đối tác (chủ tàu): cùng khuôn với danh sách tàu.
export default function PartnerListPage() {
  const navigate = useNavigate()
  const can = useCan()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const list = useFleetList('ship-owners', shipOwnerApi, { active: TAB_ACTIVE[tab], search: keyword || undefined, page, limit: pageSize })
  const rows = list.data?.data || []
  const counts = list.data?.counts
  const total = list.data?.total || 0
  const tabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang hợp tác' },
    { value: 'inactive', label: 'Ngừng hợp tác' },
  ].map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/partners/${row.id}`)

  const columns = [
    { title: 'Đối tác', key: 'partner', render: (_, row) => <PartnerCell row={row} /> },
    { title: 'Quốc gia', dataIndex: 'country_name', responsive: ['md'], render: muted },
    {
      title: 'Người liên hệ',
      key: 'contact',
      responsive: ['lg'],
      render: (_, row) =>
        row.contact_person ? (
          <span className="ds-cell2">
            <span>{row.contact_person}</span>
            <span className="ds-cell2__sub">{row.contact_phone || row.contact_email}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>Chưa có</span>
        ),
    },
    { title: 'Số tàu', dataIndex: 'vessel_count', align: 'right', render: (value) => <span className="ds-num">{value}</span> },
    { title: 'Bộ giấy đã nộp', dataIndex: 'pack_count', align: 'right', responsive: ['md'], render: (value) => <span className="ds-num">{value}</span> },
    actionColumn((row) => <RowActions name={row.company_name} onView={() => open(row)} onEdit={can('partner.update') ? () => navigate(`/partners/${row.id}/edit`) : undefined} />),
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách đối tác" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && keyword) {
    body = <EmptyState title={`Không có đối tác nào khớp "${keyword}"`} description="Thử tìm bằng tên, mã đối tác hoặc người liên hệ." action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có đối tác nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có đối tác nào" description="Thêm chủ tàu đối tác để chọn ở mục “Nộp cho” của bộ giấy và gắn với tàu." action={can('partner.create') ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/partners/new')}>Thêm đối tác</Button> : undefined} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <PartnerCell row={row} />
              <span className="crew-list__meta">
                <span className="ds-cell2__sub">{[row.country_name, `${row.vessel_count} tàu`].filter(Boolean).join(' · ')}</span>
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
            placeholder="Tìm tên, mã đối tác, người liên hệ"
            aria-label="Tìm đối tác"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          {can('partner.create') ? (
            <span className="ds-toolbar__end">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/partners/new')}>Thêm đối tác</Button>
            </span>
          ) : null}
        </div>
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="đối tác" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
