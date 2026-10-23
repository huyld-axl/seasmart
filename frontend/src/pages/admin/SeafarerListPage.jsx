import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Grid, Input, Skeleton, Table } from 'antd'
import {
  DownloadOutlined,
  EllipsisOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { seafarerApi } from '../../api'
import api from '../../api/client'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import { CREW_TABS, vesselNow } from './seafarers/crewView'
import StatusBadge from '../../components/ds/StatusBadge'
import CrewThumb from './seafarers/CrewThumb'
import { CrewFilterBar, CrewFilterButton } from './seafarers/CrewFilters'
import { EMPTY_FILTERS, filterCount, filterParams } from './seafarers/crewFilters'
import './seafarers/SeafarerListPage.css'
import RowActions from '../../components/ds/RowActions'
import { actionColumn } from '../../components/ds/actionColumn'
import useListSticky from '../../components/ds/useListSticky'
import ListFooter from '../../components/ds/ListFooter'
import { useCan } from '../../hooks/usePermission'
import useToast from '../../components/ds/useToast'

const { useBreakpoint } = Grid
const GENDER_LABELS = { M: 'Nam', F: 'Nữ', O: 'Khác' }

function Person({ row }) {
  return (
    <span className="crew-person">
      <CrewThumb id={row.id} hasPhoto={row.has_photo} version={row.photo_updated_at} />
      <span className="ds-cell2">
        <span className="ds-cell2__main">{row.full_name}</span>
        <span className="ds-cell2__sub">{row.rank_name || 'Chưa có chức danh'}</span>
        {row.pending_review_count > 0 && (
          <span className="crew-pending">
            <EllipsisOutlined aria-hidden />
            {row.pending_review_count} giấy tờ chờ duyệt
          </span>
        )}
      </span>
    </span>
  )
}

export default function SeafarerListPage() {
  const navigate = useNavigate()
  const can = useCan()
  const toast = useToast()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest') // newest | name_asc | name_desc
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const [exporting, setExporting] = useState(false)

  const query = { tab: tab === 'all' ? '' : tab, search: search.trim(), page, limit: pageSize, sort: sort === 'newest' ? '' : sort, ...filterParams(filters) }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['seafarers', query],
    queryFn: () => seafarerApi.list(query).then((res) => res.data),
    placeholderData: (previous) => previous,
  })

  const rows = data?.data || []
  const counts = data?.counts
  const tabs = CREW_TABS.map((item) => ({ ...item, count: counts ? counts[item.value] : null }))
  const open = (row) => navigate(`/seafarers/${row.id}`)

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const res = await api.get(`/seafarers/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Không xuất được file Excel', { description: 'Thử lại sau ít phút.' })
    } finally {
      setExporting(false)
    }
  }

  const moreMenu = {
    items: [
      ...(can('seafarer.import') ? [{ key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel' }] : []),
      { key: 'export', icon: <DownloadOutlined />, label: exporting ? 'Đang xuất…' : 'Xuất ra Excel', disabled: exporting },
    ],
    onClick: ({ key }) => (key === 'import' ? navigate('/seafarers/import') : handleExport()),
  }

  const columns = [
    {
      title: 'Thuyền viên',
      key: 'person',
      sorter: true,
      sortOrder: sort === 'name_asc' ? 'ascend' : sort === 'name_desc' ? 'descend' : null,
      sortDirections: ['ascend', 'descend', 'ascend'],
      render: (_, row) => <Person row={row} />,
    },
    { title: 'Giới tính', key: 'gender', width: 100, responsive: ['lg'], render: (_, row) => GENDER_LABELS[row.gender] || '—' },
    { title: 'Nơi sinh', dataIndex: 'place_of_birth', responsive: ['lg'], render: (value) => value || '—' },
    { title: 'Hộ chiếu', dataIndex: 'passport_number', width: 130, responsive: ['lg'], render: (value) => (value ? <span className="ds-mono">{value}</span> : '—') },
    { title: 'Tình trạng', key: 'where', render: (_, row) => <StatusBadge group="crew" value={row.status} /> },
    {
      title: 'Tàu đang sign on',
      key: 'vessel',
      render: (_, row) => {
        const now = vesselNow(row)
        return now ? (
          <span className="ds-cell2">
            <span className="ds-cell2__main crew-nowrap">
              {now.vesselId && can('vessel.view') ? <Link to={`/vessels/${now.vesselId}`} onClick={(event) => event.stopPropagation()}>{now.vessel}</Link> : now.vessel}
            </span>
            {now.until ? <span className="ds-cell2__sub">{now.until}</span> : null}
          </span>
        ) : '—'
      },
    },
    actionColumn((row) => <RowActions name={row.full_name} onView={() => open(row)} onEdit={can('seafarer.update') ? () => navigate(`/seafarers/${row.id}/edit`) : undefined} />),
  ]

  const keyword = search.trim()
  let body
  if (isError) {
    body = <EmptyState isError title="Không tải được danh sách thuyền viên" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && filterCount(filters)) {
    body = <EmptyState title="Không có thuyền viên nào khớp bộ lọc" action={<Button onClick={() => setFilters(EMPTY_FILTERS)}>Xoá bộ lọc</Button>} />
  } else if (!rows.length && keyword) {
    body = <EmptyState title={`Không có thuyền viên nào khớp "${keyword}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có thuyền viên nào trong mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có thuyền viên nào" description="Thêm thuyền viên đầu tiên, hoặc nhập cả danh sách từ Excel." action={can('seafarer.create') ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seafarers/new')}>Thêm thuyền viên</Button> : undefined} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <Person row={row} />
              <span className="crew-list__meta">
                <StatusBadge group="crew" value={row.status} />
                {vesselNow(row) ? <span className="ds-cell2__sub">{vesselNow(row).vessel}</span> : null}
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
        onChange={(_, __, sorter) => { setSort(sorter?.order === 'ascend' ? 'name_asc' : sorter?.order === 'descend' ? 'name_desc' : 'newest'); setPage(1) }}
        onRow={(row) => ({ onClick: () => open(row), onKeyDown: (event) => event.key === 'Enter' && open(row), tabIndex: 0 })}
      />
    )
  }

  const total = data?.total || 0
  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar crew-toolbar">
          <StatusTabs compact tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm tên, CCCD, số sổ"
            aria-label="Tìm thuyền viên"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          <span className="ds-toolbar__end">
            <CrewFilterButton value={filters} open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)} />
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Nhập, xuất Excel" />
            </Dropdown>
            {can('seafarer.create') ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seafarers/new')}>
                Thêm thuyền viên
              </Button>
            ) : null}
          </span>
        </div>
        {filtersOpen ? <CrewFilterBar value={filters} onChange={(next) => { setFilters(next); setPage(1) }} /> : null}
        {body}
        {rows.length > 0 && (
          <ListFooter total={total} page={page} pageSize={pageSize} unit="thuyền viên" onChange={(next, size) => { setPage(next); setPageSize(size) }} />
        )}
      </div>
    </div>
  )
}
