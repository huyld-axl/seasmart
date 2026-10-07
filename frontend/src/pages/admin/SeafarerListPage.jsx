import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Grid, Input, Pagination, Skeleton, Table } from 'antd'
import {
  DownloadOutlined,
  EllipsisOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { seafarerApi } from '../../api'
import api from '../../api/client'
import StatusBadge from '../../components/ds/StatusBadge'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import { CREW_TABS, availabilityText, docsAlert, nameInitials } from './seafarers/crewView'
import './seafarers/SeafarerListPage.css'

const { useBreakpoint } = Grid
const PAGE_SIZE = 20

function Person({ row }) {
  return (
    <span className="crew-person">
      <span className="crew-avatar" aria-hidden>{nameInitials(row.full_name)}</span>
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

function DocsCell({ row }) {
  const alert = docsAlert(row)
  return <span className={`crew-docs crew-docs--${alert.tone}`}>{alert.text}</span>
}

function Completeness({ value }) {
  return (
    <span className="crew-complete" title={`Hồ sơ đầy đủ ${value}%`}>
      <span className="crew-complete__bar">
        <span style={{ width: `${value}%` }} />
      </span>
      <span className="ds-num">{value}%</span>
    </span>
  )
}

export default function SeafarerListPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const query = { tab: tab === 'all' ? '' : tab, search: search.trim(), page, limit: PAGE_SIZE }
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
      message.error('Không xuất được file Excel. Thử lại sau.')
    } finally {
      setExporting(false)
    }
  }

  const moreMenu = {
    items: [
      { key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel' },
      { key: 'export', icon: <DownloadOutlined />, label: exporting ? 'Đang xuất…' : 'Xuất ra Excel', disabled: exporting },
    ],
    onClick: ({ key }) => (key === 'import' ? navigate('/seafarers/import') : handleExport()),
  }

  const columns = [
    { title: 'Thuyền viên', key: 'person', render: (_, row) => <Person row={row} /> },
    { title: 'Tình trạng', key: 'status', width: 160, render: (_, row) => <StatusBadge group="crew" value={row.status} /> },
    { title: 'Tàu / sẵn sàng', key: 'where', render: (_, row) => <span className="crew-nowrap">{availabilityText(row)}</span> },
    { title: 'Giấy tờ', key: 'docs', width: 180, responsive: ['lg'], render: (_, row) => <DocsCell row={row} /> },
    { title: 'Hồ sơ', key: 'complete', width: 140, responsive: ['lg'], render: (_, row) => <Completeness value={row.completeness} /> },
    { title: <span className="ds-sr-only">Mở</span>, key: 'open', width: 48, align: 'right', render: () => <RightOutlined className="crew-chevron" /> },
  ]

  const keyword = search.trim()
  let body
  if (isError) {
    body = <EmptyState isError title="Không tải được danh sách thuyền viên" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length && keyword) {
    body = <EmptyState title={`Không có thuyền viên nào khớp "${keyword}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
  } else if (!rows.length && tab !== 'all') {
    body = <EmptyState title="Không có thuyền viên nào trong mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title="Chưa có thuyền viên nào" description="Thêm thuyền viên đầu tiên, hoặc nhập cả danh sách từ Excel." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seafarers/new')}>Thêm thuyền viên</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <Person row={row} />
              <span className="crew-list__meta">
                <StatusBadge group="crew" value={row.status} />
                <span className="ds-cell2__sub">{availabilityText(row)} · <DocsCell row={row} /></span>
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

  const total = data?.total || 0
  return (
    <div className="ds-page">
      <div className="ds-toolbar crew-toolbar">
        <StatusTabs tabs={tabs} value={tab} onChange={(value) => { setTab(value); setPage(1) }} />
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
          <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} aria-label="Nhập, xuất Excel" />
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seafarers/new')}>
            Thêm thuyền viên
          </Button>
        </span>
      </div>

      <div className="ds-card">
        {body}
        {rows.length > 0 && (
          <div className="ds-table-foot">
            <span className="ds-num">{total} thuyền viên</span>
            {total > PAGE_SIZE && (
              <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} onChange={setPage} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
