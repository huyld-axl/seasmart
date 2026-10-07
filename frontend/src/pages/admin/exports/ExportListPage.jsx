import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Input, Modal, Select, Table } from 'antd'
import { DownloadOutlined, ExclamationCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { STAGES, template } from './packModel'
import { PACK_TABS, countByTab, filterPacks, signProgress, usePacks } from './packStore'
import '../seafarers/SeafarerListPage.css'
import './exports.css'

const stageOf = (pack) => {
  const stages = [...new Set(pack.docs.map((key) => template(key).stage))]
  return stages.map((key) => STAGES.find((s) => s.key === key).label).join(', ')
}
const when = (date) => (dayjs(date).isSame(dayjs(), 'day') ? `${dayjs(date).format('HH:mm')} hôm nay` : dayjs(date).format('DD/MM'))

// Chọn thuyền viên trước khi tạo bộ giấy (bộ giấy luôn gắn với một hồ sơ).
function PickSeafarer({ open, onClose, onPick }) {
  const [search, setSearch] = useState('')
  const [value, setValue] = useState(null)
  const { data, isFetching } = useQuery({
    queryKey: ['seafarer-pick', search],
    queryFn: () => seafarerApi.list({ search, limit: 10 }).then((r) => r.data.data),
    enabled: open,
  })
  return (
    <Modal open={open} title="Tạo bộ giấy cho ai?" okText="Tiếp" cancelText="Huỷ" okButtonProps={{ disabled: !value }} onCancel={onClose} onOk={() => onPick(value)} destroyOnHidden>
      <label className="ds-field">
        <span className="ds-field__label">Thuyền viên</span>
        <Select
          showSearch
          autoFocus
          filterOption={false}
          placeholder="Gõ tên, CCCD hoặc số sổ"
          loading={isFetching}
          value={value}
          onSearch={setSearch}
          onChange={setValue}
          notFoundContent={isFetching ? 'Đang tìm…' : 'Không có thuyền viên khớp'}
          options={(data || []).map((s) => ({ value: s.id, label: `${s.full_name}${s.rank_name ? ` · ${s.rank_name}` : ''}` }))}
          style={{ width: '100%' }}
        />
      </label>
    </Modal>
  )
}

// C1 Bản xuất: mọi bộ giấy, lọc theo trạng thái, việc tiếp theo ngay trên dòng.
export default function ExportListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const user = useAuthStore((state) => state.user)
  const isMobile = !Grid.useBreakpoint().md
  const packs = usePacks()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)

  const counts = countByTab(packs)
  const rows = filterPacks(packs, tab, search)
  const open = (pack) => navigate(`/exports/${pack.id}`)

  function nextStep(pack) {
    const stop = (event) => event.stopPropagation()
    switch (pack.status) {
      case 'PENDING_APPROVAL':
        return pack.createdBy === user?.email
          ? <span className="rv-muted ex-note">Chờ người khác duyệt</span>
          : <Button size="small" onClick={(e) => { stop(e); open(pack) }}>Duyệt</Button>
      case 'SIGNING':
        return <Button size="small" type="text" onClick={(e) => { stop(e); open(pack) }}>Xem chữ ký</Button>
      case 'STALE':
        return <Button size="small" onClick={(e) => { stop(e); pack.seafarerId ? navigate(`/exports/new?seafarer=${pack.seafarerId}`) : setPicking(true) }}>Tạo lại</Button>
      case 'DONE':
        return <Button size="small" type="text" icon={<DownloadOutlined />} onClick={(e) => { stop(e); toast.error('Tải .zip cần backend sinh file, chưa có') }}>Tải .zip</Button>
      case 'REJECTED':
        return <Button size="small" type="text" onClick={(e) => { stop(e); open(pack) }}>Xem lý do</Button>
      default:
        return null
    }
  }

  const signCell = (pack) => {
    if (!['SIGNING', 'DONE'].includes(pack.status)) return <span className="rv-muted">—</span>
    const p = signProgress(pack)
    return (
      <span className="crew-complete">
        <span className="crew-complete__bar"><span style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} /></span>
        <span className="ds-num">{p.done}/{p.total}</span>
      </span>
    )
  }

  const columns = [
    {
      title: 'Bộ giấy tờ', key: 'pack',
      render: (_, pack) => (
        <span className="ds-cell2" style={{ maxWidth: 320 }}>
          <span className="ds-cell2__main">{pack.seafarerName}</span>
          <span className="ds-cell2__sub">{stageOf(pack)} · {pack.docs.length} giấy · #{pack.id}</span>
        </span>
      ),
    },
    { title: 'Trạng thái', key: 'status', width: 150, render: (_, pack) => <StatusBadge group="export" value={pack.status} /> },
    { title: 'Chữ ký', key: 'signs', width: 140, render: (_, pack) => signCell(pack) },
    { title: 'Người tạo', key: 'by', responsive: ['lg'], render: (_, pack) => <span className="rv-muted crew-nowrap">{pack.createdBy}</span> },
    { title: 'Ngày', key: 'date', responsive: ['lg'], width: 120, render: (_, pack) => <span className="rv-muted ds-num crew-nowrap">{when(pack.createdAt)}</span> },
    { title: <span className="ds-sr-only">Thao tác</span>, key: 'act', align: 'right', render: (_, pack) => nextStep(pack) },
  ]

  let body
  if (!packs.length) {
    body = <EmptyState title="Chưa có bộ giấy tờ nào" description="Tạo bộ giấy theo giai đoạn: tuyển dụng, lên tàu, rời tàu." action={<Button icon={<PlusOutlined />} onClick={() => setPicking(true)}>Tạo bộ giấy tờ</Button>} />
  } else if (!rows.length) {
    body = search.trim()
      ? <EmptyState title={`Không có bộ giấy nào khớp "${search.trim()}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
      : <EmptyState title="Không có bộ giấy nào trong mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((pack) => (
          <li key={pack.id}>
            <div role="link" tabIndex={0} className="crew-list__row" onClick={() => open(pack)} onKeyDown={(e) => e.key === 'Enter' && open(pack)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{pack.seafarerName}</span>
                <span className="ds-cell2__sub">{stageOf(pack)} · {pack.docs.length} giấy · #{pack.id} · {when(pack.createdAt)}</span>
              </span>
              <span className="ex-row__end" style={{ justifyContent: 'space-between' }}>
                <StatusBadge group="export" value={pack.status} />
                {nextStep(pack)}
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
      <div role="status" className="ds-banner ds-banner--warning">
        <ExclamationCircleOutlined className="ds-banner__icon" aria-hidden />
        <div className="ds-banner__body">
          <p className="ds-banner__title">Bộ giấy tạm, chưa lưu</p>
          <p className="ds-banner__text">Xuất bộ giấy và ký chưa có backend. Các bộ dưới đây là dữ liệu mẫu và bộ bạn vừa tạo, tải lại trang là mất.</p>
        </div>
      </div>

      <div className="ds-toolbar crew-toolbar">
        <StatusTabs tabs={PACK_TABS.map((t) => ({ ...t, count: counts[t.value] }))} value={tab} onChange={setTab} />
        <Input className="ds-toolbar__search" allowClear prefix={<SearchOutlined />} placeholder="Tìm thuyền viên, mã bộ" aria-label="Tìm bộ giấy tờ" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="ds-toolbar__end">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setPicking(true)}>Tạo bộ giấy tờ</Button>
        </span>
      </div>

      <div className="ds-card">
        {body}
        {rows.length > 0 && (
          <div className="ds-table-foot">
            <span className="ds-num">{rows.length} bộ</span>
          </div>
        )}
      </div>

      <PickSeafarer open={picking} onClose={() => setPicking(false)} onPick={(id) => navigate(`/exports/new?seafarer=${id}`)} />
    </div>
  )
}
