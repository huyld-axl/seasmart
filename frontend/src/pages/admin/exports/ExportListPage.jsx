import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Input, Skeleton, Table } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EmptyState } from '../../../components/ds/Controls'
import { STAGES, template } from './packModel'
import { exportApi } from '../../../api/exportApi'
import { PackDownload } from './DownloadButtons'
import '../seafarers/SeafarerListPage.css'
import './exports.css'

const stageOf = (pack) => {
  const stages = [...new Set(pack.docs.map((key) => template(key).stage))]
  return stages.map((key) => STAGES.find((s) => s.key === key).label).join(', ')
}
const when = (date) => (dayjs(date).isSame(dayjs(), 'day') ? `${dayjs(date).format('HH:mm')} hôm nay` : dayjs(date).format('DD/MM'))

// C1 Bản xuất: mọi bộ giấy đã tạo, tải cả bộ ngay trên dòng.
export default function ExportListPage() {
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().md
  const [search, setSearch] = useState('')

  const query = { search: search.trim() || undefined, limit: 100 }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exports', query],
    queryFn: () => exportApi.list(query),
    placeholderData: (previous) => previous,
  })
  const rows = data?.data || []
  const open = (pack) => navigate(`/exports/${pack.id}`)

  const columns = [
    {
      title: 'Bộ giấy tờ', key: 'pack',
      render: (_, pack) => (
        <span className="ds-cell2" style={{ maxWidth: 320 }}>
          <span className="ds-cell2__main">{pack.seafarer_name}</span>
          <span className="ds-cell2__sub">{stageOf(pack)} · {pack.docs.length} giấy · #{pack.code}</span>
        </span>
      ),
    },
    { title: 'Nộp cho', key: 'owner', responsive: ['lg'], render: (_, pack) => <span className="rv-muted">{pack.ship_owner_name || '—'}</span> },
    { title: 'Người tạo', key: 'by', responsive: ['lg'], render: (_, pack) => <span className="rv-muted crew-nowrap">{pack.created_by_email}</span> },
    { title: 'Ngày', key: 'date', responsive: ['lg'], width: 120, render: (_, pack) => <span className="rv-muted ds-num crew-nowrap">{when(pack.created_at)}</span> },
    { title: <span className="ds-sr-only">Thao tác</span>, key: 'act', align: 'right', render: (_, pack) => <PackDownload pack={pack} size="small" label="Tải về" /> },
  ]

  let body
  if (isError) {
    body = <EmptyState isError title="Không tải được danh sách bộ giấy" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 5 }} /></div>
  } else if (!rows.length && !search.trim()) {
    body = <EmptyState title="Chưa có bộ giấy tờ nào" description="Tạo bộ giấy theo giai đoạn: tuyển dụng, lên tàu, rời tàu." action={<Button icon={<PlusOutlined />} onClick={() => navigate('/exports/new')}>Tạo bộ giấy tờ</Button>} />
  } else if (!rows.length) {
    body = <EmptyState title={`Không có bộ giấy nào khớp "${search.trim()}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((pack) => (
          <li key={pack.id}>
            <div role="link" tabIndex={0} className="crew-list__row" onClick={() => open(pack)} onKeyDown={(e) => e.key === 'Enter' && open(pack)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{pack.seafarer_name}</span>
                <span className="ds-cell2__sub">{stageOf(pack)} · {pack.docs.length} giấy · #{pack.code}{pack.ship_owner_name ? ` · Nộp cho ${pack.ship_owner_name}` : ''} · {when(pack.created_at)}</span>
              </span>
              <span className="ex-row__end">
                <PackDownload pack={pack} size="small" label="Tải về" />
              </span>
            </div>
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
        onRow={(pack) => ({ onClick: () => open(pack), onKeyDown: (e) => e.key === 'Enter' && open(pack), tabIndex: 0 })}
      />
    )
  }

  return (
    <div className="ds-page">

      <div className="ds-card">
        <div className="ds-toolbar crew-toolbar">
          <Input className="ds-toolbar__search" allowClear prefix={<SearchOutlined />} placeholder="Tìm thuyền viên, mã bộ" aria-label="Tìm bộ giấy tờ" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="ds-toolbar__end">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/exports/new')}>Tạo bộ giấy tờ</Button>
          </span>
        </div>
        {body}
        {rows.length > 0 && (
          <div className="ds-table-foot">
            <span className="ds-num">{rows.length} bộ</span>
          </div>
        )}
      </div>

    </div>
  )
}
