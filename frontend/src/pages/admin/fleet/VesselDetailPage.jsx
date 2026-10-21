import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Skeleton, Table } from 'antd'
import { DeleteOutlined, EditOutlined, MoreOutlined, RightOutlined, SwapOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { vesselApi } from '../../../api/fleetApi'
import { useFleetItem, useFleetMutations } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { VESSEL_STATUS_OPTIONS, vesselSections, filled } from './fleetView'
import { Crumb, FleetTile, ReadPanel, SidePanel } from './FleetParts'
import '../seafarers/SeafarerListPage.css'

const date = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '—')
const KEY_FIELDS = ['Số IMO', 'Call Sign', 'Cảng đăng ký', 'Trạng thái đăng kiểm', 'GRT', 'DWT']

function PeopleTable({ rows, showStatus, loading }) {
  return (
    <section className="crew-panel">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState title={showStatus ? 'Chưa có chuyến đi tàu nào khớp với tàu này' : 'Hiện chưa có thuyền viên nào trên tàu'} /> }}
        columns={[
          { title: 'Thuyền viên', key: 'who', render: (_, row) => <Link to={`/seafarers/${row.seafarer_id}`}>{row.seafarer_name}</Link> },
          { title: 'Chức danh', dataIndex: 'rank_name', render: (value) => value || '—' },
          { title: 'Ngày lên tàu', dataIndex: 'sign_on_date', render: (value) => <span className="ds-num">{date(value)}</span> },
          ...(showStatus
            ? [
                { title: 'Ngày rời tàu', dataIndex: 'sign_off_date', render: (value) => <span className="ds-num">{date(value)}</span> },
                { title: 'Tình trạng', key: 'state', render: (_, row) => row.on_board ? <StatusBadge group="seaService" value="ONGOING" /> : <span className="ds-role">Đã rời tàu</span> },
              ]
            : []),
        ]}
      />
    </section>
  )
}

export default function VesselDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [tab, setTab] = useState('overview')

  const { data: vessel, isLoading, isError, refetch } = useFleetItem('vessels', vesselApi, id)
  const service = useQuery({ queryKey: ['fleet', 'vessels', 'service', id], queryFn: () => vesselApi.service(id), enabled: !!vessel })
  const { save, remove, restore } = useFleetMutations(vesselApi)

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !vessel) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được thông tin tàu' : 'Không tìm thấy tàu'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Tàu có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/vessels')}>Về danh sách</Button>}
      />
    )
  }

  const serviceRows = service.data?.data || []
  const onBoard = serviceRows.filter((row) => row.on_board)
  const inUse = vessel.usage?.total > 0
  const sections = vesselSections(vessel, {
    linkOwner: (v) => <Link to={`/partners/${v.ship_owner_id}`}>{v.ship_owner_name}</Link>,
  })
  const missing = sections.flatMap((section) => section.fields).filter(([label, value]) => KEY_FIELDS.includes(label) && !filled(value)).map(([label]) => label)

  async function changeStatus(status) {
    try {
      await save.mutateAsync({ id: vessel.id, status })
      toast.success(`Đã chuyển ${vessel.vessel_name} sang ${VESSEL_STATUS_OPTIONS.find((o) => o.value === status).label}`)
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Không đổi được trạng thái')
    }
  }

  function handleDelete() {
    modal.confirm({
      title: `Xoá tàu ${vessel.vessel_name}?`,
      content: 'Tàu sẽ bị ẩn khỏi danh sách và khi chọn tàu. Có thể hoàn tác ngay sau khi xoá.',
      okText: 'Xoá tàu',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await remove.mutateAsync(vessel.id)
          toast.success(`Đã xoá ${vessel.vessel_name}`, {
            actionLabel: 'Hoàn tác',
            onAction: () => restore.mutate(vessel.id, { onError: (error) => toast.error(error?.response?.data?.error || 'Không hoàn tác được') }),
          })
          navigate('/vessels')
        } catch (error) {
          toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Không xoá được')
        }
      },
    })
  }

  const moreItems = [
    ...(can('vessel.update')
      ? [
          {
            key: 'status',
            icon: <SwapOutlined />,
            label: 'Đổi trạng thái',
            children: VESSEL_STATUS_OPTIONS.map((option) => ({ key: `status:${option.value}`, label: option.label, disabled: option.value === vessel.status })),
          },
        ]
      : []),
    ...(can('vessel.update') && can('vessel.delete') ? [{ type: 'divider' }] : []),
    ...(can('vessel.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: inUse ? 'Xoá (tàu đang được dùng)' : 'Xoá tàu', danger: true, disabled: inUse }] : []),
  ]
  const moreMenu = {
    items: moreItems,
    onClick: ({ key }) => (key === 'delete' ? handleDelete() : changeStatus(key.replace('status:', ''))),
  }

  const tabs = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'crew', label: 'Thuyền viên', count: onBoard.length },
    { value: 'service', label: 'Đi tàu', count: serviceRows.length },
  ]
  const description = [vessel.vessel_type_name, vessel.flag_name && `Cờ ${vessel.flag_name}`].filter(Boolean).join(' · ')

  const attention = missing.length ? (
    <ul className="fl-attn">
      <li>
        <span className="ds-role">Thiếu</span>
        <span>Chưa có {missing.join(', ')}</span>
        <Link to={`/vessels/${vessel.id}/edit`}>Bổ sung</Link>
      </li>
    </ul>
  ) : (
    <p className="crew-muted">Các thông tin chính đã đủ.</p>
  )

  const overview = (
    <div className="crew-two-col">
      <div style={{ display: 'grid', gap: 16 }}>
        {sections.map((section) => <ReadPanel key={section.key} section={section} />)}
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <SidePanel title="Cần chú ý">{attention}</SidePanel>
        <SidePanel title="Đang trên tàu" action={onBoard.length > 5 ? <Button size="small" type="text" onClick={() => setTab('crew')}>Xem tất cả <RightOutlined /></Button> : null}>
          {service.isError ? (
            <p className="crew-muted">Không tải được danh sách thuyền viên.</p>
          ) : onBoard.length ? (
            <ul className="fl-rows">
              {onBoard.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <span className="fl-rows__main">
                    <Link to={`/seafarers/${row.seafarer_id}`}>{row.seafarer_name}</Link>
                    <span className="ds-cell2__sub">{row.rank_name || 'Chưa có chức danh'}</span>
                  </span>
                  <span className="fl-rows__end">Lên tàu {date(row.sign_on_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="crew-muted">Hiện chưa có thuyền viên nào trên tàu.</p>
          )}
        </SidePanel>
        <SidePanel title="Đang được dùng ở">
          <ul className="fl-rows">
            <li><span className="fl-rows__main">Chuyến đi tàu đã khớp</span><span className="ds-num">{vessel.usage.sea_service}</span></li>
            <li><span className="fl-rows__main">Chuyến tàu</span><span className="ds-num">{vessel.usage.voyages}</span></li>
            <li><span className="fl-rows__main">Giấy tờ thuyền viên gắn với tàu</span><span className="ds-num">{vessel.usage.documents}</span></li>
          </ul>
          <p className="fl-note">Tàu đang được dùng thì không xoá được, chỉ đổi trạng thái (Nằm bờ, Phá dỡ).</p>
        </SidePanel>
      </div>
    </div>
  )

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Tàu', to: '/vessels' }, { label: vessel.vessel_name }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <FleetTile large />
          <div className="crew-head__text">
            <h1 className="crew-head__title">{vessel.vessel_name}</h1>
            {description || vessel.ship_owner_name ? (
              <p className="crew-head__desc">
                {description}
                {description && vessel.ship_owner_name ? ' · ' : ''}
                {vessel.ship_owner_name ? <Link to={`/partners/${vessel.ship_owner_id}`}>{vessel.ship_owner_name}</Link> : null}
              </p>
            ) : null}
            <div className="crew-head__badges">
              <StatusBadge group="vesselStatus" value={vessel.status} />
              <span className="ds-role">{vessel.imo_number ? <span className="fl-mono" style={{ fontSize: 12 }}>IMO {vessel.imo_number}</span> : 'Không có IMO'}</span>
              <span className="fl-head-meta">{Number(vessel.crew_on_board)} thuyền viên đang trên tàu</span>
            </div>
          </div>
        </div>
        <div className="crew-head__actions">
          {moreItems.length > 0 && (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={remove.isPending || save.isPending} />
            </Dropdown>
          )}
          {can('vessel.update') && <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/vessels/${vessel.id}/edit`)}>Sửa thông tin</Button>}
        </div>
      </div>

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      {tab === 'overview' && overview}
      {tab === 'crew' && <PeopleTable rows={onBoard} loading={service.isLoading} />}
      {tab === 'service' && <PeopleTable rows={serviceRows} showStatus loading={service.isLoading} />}
    </div>
  )
}
