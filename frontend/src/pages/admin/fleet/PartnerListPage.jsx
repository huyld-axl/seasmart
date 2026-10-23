import dayjs from 'dayjs'
import { withFlag } from '../../../utils/flag'
import { useQuery } from '@tanstack/react-query'
import { lookupApi } from '../../../api'
import StatusBadge from '../../../components/ds/StatusBadge'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Grid, Input, Select, Skeleton, Table } from 'antd'
import { DownOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
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
  const logo = usePartnerLogo(row, 'thumb')
  return (
    <span className="fl-who">
      <FleetTile text={initialsOfName(row.company_name)} src={logo} />
      <span className="ds-cell2">
        <span className="ds-cell2__main">{row.company_name}</span>
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countryId, setCountryId] = useState(undefined)
  const [channels, setChannels] = useState([])
  const filterCount = Number(Boolean(countryId)) + Number(channels.length > 0)
  const clearFilters = () => { setCountryId(undefined); setChannels([]); setPage(1) }
  const countries = useQuery({ queryKey: ['lookup', 'countries'], queryFn: () => lookupApi.countries().then((r) => r.data), enabled: filtersOpen })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const keyword = search.trim()

  const list = useFleetList('ship-owners', shipOwnerApi, { country_id: countryId, channels: channels.length ? channels.join(',') : undefined, active: TAB_ACTIVE[tab], search: keyword || undefined, page, limit: pageSize })
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
    { title: 'Quốc gia', key: 'country', responsive: ['md'], render: (_, row) => muted(row.country_name ? withFlag(row.country_code, row.country_name, row.country_flag_emoji) : null) },
    {
      title: 'Liên hệ chính',
      key: 'contact',
      responsive: ['lg'],
      render: (_, row) => {
        const primary = row.contacts?.find((contact) => Number(contact.is_primary) === 1) || row.contacts?.[0]
        if (!primary) return <span style={{ color: 'var(--muted)' }}>Chưa có</span>
        return (
          <span className="ds-cell2">
            <span>{primary.name}</span>
            <span className="ds-cell2__sub">{primary.position}</span>
            <span className="ds-cell2__sub">{primary.phone || primary.email}</span>
          </span>
        )
      },
    },
    { title: 'Trạng thái', key: 'status', render: (_, row) => <StatusBadge group="partner" value={Number(row.is_active) === 1 ? 'ACTIVE' : 'INACTIVE'} /> },
    { title: 'Cập nhật gần nhất', key: 'updated', responsive: ['lg'], render: (_, row) => row.updated_at ? <span className="ds-num">{dayjs(row.updated_at).format('DD/MM/YYYY HH:mm')}</span> : muted(null) },
    actionColumn((row) => <RowActions name={row.company_name} onView={() => open(row)} onEdit={can('partner.update') ? () => navigate(`/partners/${row.id}/edit`) : undefined} />),
  ]

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách đối tác" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filterCount) {
    body = <EmptyState title="Không có đối tác nào khớp bộ lọc" action={<Button onClick={clearFilters}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && keyword) {
    body = <EmptyState title={`Không có đối tác nào khớp "${keyword}"`} description="Thử tìm bằng tên đối tác hoặc người liên hệ." action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
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
                <StatusBadge group="partner" value={Number(row.is_active) === 1 ? 'ACTIVE' : 'INACTIVE'} />
                <span className="ds-cell2__sub">{[row.country_name && withFlag(row.country_code, row.country_name, row.country_flag_emoji)].filter(Boolean).join(' · ')}</span>
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
          <StatusTabs compact tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm tên đối tác, người liên hệ"
            aria-label="Tìm đối tác"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          <span className="ds-toolbar__end">
            <Badge count={filterCount} size="small" offset={[-4, 4]}>
              <Button className="crew-filter-btn" icon={<FilterOutlined />} aria-expanded={filtersOpen} aria-controls="partner-filter-bar" onClick={() => setFiltersOpen((open) => !open)}>Bộ lọc <DownOutlined className="crew-filter-btn__chev" /></Button>
            </Badge>
            {can('partner.create') && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/partners/new')}>Thêm đối tác</Button>}
          </span>
        </div>
        {filtersOpen && <div className="crew-filterbar" id="partner-filter-bar">
          <label className="crew-filterbar__field crew-filterbar__field--wide">
            <span>Quốc gia</span>
            <Select aria-label="Lọc theo quốc gia" allowClear showSearch optionFilterProp="label" placeholder="Tất cả quốc gia" loading={countries.isLoading} value={countryId} onChange={(value) => { setCountryId(value); setPage(1) }} options={(countries.data || []).map((country) => ({ value: country.id, label: withFlag(country.code, country.name_vi || country.name_en, country.flag_emoji) }))} />
          </label>
          {countries.isError && <Button onClick={() => countries.refetch()}>Tải lại quốc gia</Button>}
          <label className="crew-filterbar__field crew-filterbar__field--wide" title="Có đủ các kênh đã chọn, ở công ty hoặc người liên hệ.">
            <span>Kênh liên hệ đang có</span>
            <Select aria-label="Lọc kênh liên hệ" mode="multiple" allowClear maxTagCount="responsive" placeholder="Có đủ các kênh đã chọn" value={channels} onChange={(value) => { setChannels(value); setPage(1) }} options={[{ value: 'zalo', label: 'Zalo' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'line', label: 'LINE' }, { value: 'wechat', label: 'WeChat' }]} />
          </label>
          <Button className="crew-filterbar__clear" disabled={!filterCount} onClick={clearFilters}>Xoá bộ lọc</Button>
        </div>}
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="đối tác" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
