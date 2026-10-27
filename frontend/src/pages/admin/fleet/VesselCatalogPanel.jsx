import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import SlidePanel from '../../../components/ds/SlidePanel'
import ListFooter from '../../../components/ds/ListFooter'
import { EmptyState, ListRow } from '../../../components/ds/Controls'
import { vesselApi } from '../../../api/fleetApi'
import { useLookupStatus } from '../../../hooks/useLookupCooldown'
import useDebouncedValue from '../../../hooks/useDebouncedValue'
import { isValidImo } from '../../../utils/imo'
import { FleetTile } from './FleetParts'
import SmartFetchDialog from './SmartFetchDialog'

const PAGE_SIZES = [10, 20, 50]

// Danh mục tàu thế giới: kho tra cứu hơn 700 nghìn tàu (tách khỏi bảng vessel). Tàu đã có trong MCAH không hiện ở đây.
// Trang cha đặt `key` mới mỗi lần mở để ô tìm và trang bắt đầu lại từ `initialQuery`.
// Bấm Thêm: tàu có IMO hợp lệ và máy chủ đã bật Lấy thông tin thông minh thì hỏi trước; còn lại mở form Thêm tàu điền sẵn.
export default function VesselCatalogPanel({ open, initialQuery = '', onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState(initialQuery)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [asking, setAsking] = useState(null)
  const term = useDebouncedValue(q.trim(), 300)
  const status = useLookupStatus()

  const searching = open && term.length >= 2
  const list = useQuery({
    queryKey: ['fleet', 'vessels', 'catalog', term, page, pageSize],
    queryFn: () => vesselApi.catalog({ q: term, page, limit: pageSize }),
    enabled: searching,
    placeholderData: (previous) => previous,
  })
  const rows = list.data?.data || []

  function openForm(row, smart) {
    navigate('/vessels/new', { state: { prefill: row.prefill, unmatched: row.unmatched, smart: smart || null } })
    setAsking(null)
    onClose()
  }
  function add(row) {
    if (status.data?.enabled && row.imo_number && isValidImo(row.imo_number)) setAsking(row)
    else openForm(row)
  }

  let body
  if (!searching) {
    body = <EmptyState title="Tìm tàu trong danh mục" description="Gõ tên tàu, tên cũ, số IMO hoặc MMSI (từ 2 ký tự). Danh mục có hơn 700 nghìn tàu; tàu đã có trong MCAH không hiện ở đây." />
  } else if (list.isError) {
    body = <EmptyState isError title="Không tải được danh mục" description="Dữ liệu trong MCAH không bị ảnh hưởng." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <div className="fl-catalog__loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length) {
    body = <EmptyState title={`Không có tàu nào khớp "${term}"`} description="Thử tên khác, tên cũ, số IMO hoặc MMSI. Tàu đã có trong MCAH không hiện ở đây." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vessels/new')}>Thêm tàu thủ công</Button>} />
  } else {
    body = (
      <ul className="fl-catalog">
        {rows.map((row) => (
          <ListRow
            key={row.source_id}
            leading={<FleetTile />}
            title={<>{row.ship_name}{row.ex_name ? <span className="fl-catalog__ex">Tên cũ: {row.ex_name}</span> : null}</>}
            meta={[row.ship_type, row.flag_name, row.mmsi ? `MMSI ${row.mmsi}` : null].filter(Boolean).join(' · ')}
            trailing={
              <span className="fl-catalog__end">
                {row.imo_number ? <span className="ds-mono">{row.imo_number}</span> : <span className="fl-catalog__noimo">Không có IMO</span>}
                <Button size="small" icon={<PlusOutlined />} onClick={() => add(row)}>Thêm</Button>
              </span>
            }
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <SlidePanel open={open} onClose={onClose} size="wide" hasForm={false} title="Danh mục tàu thế giới" description="Kho tàu tra cứu có sẵn. Bấm Thêm để đưa tàu vào MCAH.">
        <Input allowClear autoFocus prefix={<SearchOutlined />} value={q} placeholder="Tên tàu, tên cũ, IMO, MMSI" aria-label="Tìm trong danh mục tàu thế giới" onChange={(event) => { setQ(event.target.value); setPage(1) }} />
        <div className="fl-catalog__body">{body}</div>
        {searching && rows.length ? (
          <ListFooter total={list.data.total} page={page} pageSize={pageSize} unit="tàu" onChange={(next, size) => { setPage(next); setPageSize(PAGE_SIZES.includes(size) ? size : 20) }} />
        ) : null}
      </SlidePanel>
      <SmartFetchDialog row={asking} onCancel={() => setAsking(null)} onSkip={() => openForm(asking)} onResult={(result) => openForm(asking, result)} />
    </>
  )
}
