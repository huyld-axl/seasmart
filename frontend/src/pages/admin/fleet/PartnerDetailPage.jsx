import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Skeleton, Table } from 'antd'
import { DeleteOutlined, EditOutlined, MoreOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { shipOwnerApi } from '../../../api/fleetApi'
import { exportApi } from '../../../api/exportApi'
import { useFleetItem, useFleetMutations, usePartnerLogo } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { initialsOfName, partnerSections } from './fleetView'
import { Crumb, FleetTile, ReadPanel, SidePanel } from './FleetParts'
import '../seafarers/SeafarerListPage.css'

const when = (value) => (dayjs(value).isSame(dayjs(), 'day') ? `${dayjs(value).format('HH:mm')} hôm nay` : dayjs(value).format('DD/MM/YYYY'))
const packCode = (id) => `B${String(id).padStart(4, '0')}`

export default function PartnerDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [tab, setTab] = useState('overview')

  const { data: owner, isLoading, isError, refetch } = useFleetItem('ship-owners', shipOwnerApi, id)
  const packs = useQuery({
    queryKey: ['exports', { ship_owner_id: Number(id) }],
    queryFn: () => exportApi.list({ ship_owner_id: Number(id), limit: 50 }),
    enabled: tab === 'packs',
  })
  const { save, remove, restore } = useFleetMutations(shipOwnerApi)
  const logo = usePartnerLogo(owner)

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !owner) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được thông tin đối tác' : 'Không tìm thấy đối tác'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Đối tác có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/partners')}>Về danh sách</Button>}
      />
    )
  }

  const active = Number(owner.is_active) === 1
  const inUse = owner.usage?.total > 0
  const sections = partnerSections(owner)

  async function toggleActive() {
    try {
      await save.mutateAsync({ id: owner.id, is_active: active ? 0 : 1 })
      toast.success(active ? `Đã chuyển ${owner.company_name} sang Ngừng hợp tác` : `Đã chuyển ${owner.company_name} về Đang hợp tác`)
    } catch (error) {
      toast.error(`Không đổi được tình trạng ${owner.company_name}`, { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
    }
  }

  function handleDelete() {
    modal.confirm({
      title: `Xoá đối tác ${owner.company_name}?`,
      content: 'Đối tác sẽ bị ẩn khỏi danh sách và khi chọn “Nộp cho”. Có thể hoàn tác ngay sau khi xoá.',
      okText: 'Xoá đối tác',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await remove.mutateAsync(owner.id)
          toast.success(`Đã xoá ${owner.company_name}`, {
            actionLabel: 'Hoàn tác',
            onAction: () => restore.mutate(owner.id, { onError: (error) => toast.error(`Không khôi phục được ${owner.company_name}`, { description: error?.response?.data?.error || 'Thử lại sau ít phút.' }) }),
          })
          navigate('/partners')
        } catch (error) {
          toast.error(`Không xoá được ${owner.company_name}`, { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
        }
      },
    })
  }

  const moreItems = [
    ...(can('partner.update')
      ? [
          active
            ? { key: 'toggle', icon: <PauseCircleOutlined />, label: 'Ngừng hợp tác' }
            : { key: 'toggle', icon: <PlayCircleOutlined />, label: 'Hợp tác trở lại' },
        ]
      : []),
    ...(can('partner.update') && can('partner.delete') ? [{ type: 'divider' }] : []),
    ...(can('partner.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: inUse ? 'Xoá (đối tác đang được dùng)' : 'Xoá đối tác', danger: true, disabled: inUse }] : []),
  ]
  const moreMenu = {
    items: moreItems,
    onClick: ({ key }) => (key === 'delete' ? handleDelete() : toggleActive()),
  }

  const tabs = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'vessels', label: 'Tàu', count: owner.vessels.length },
    ...(can('export.view') ? [{ value: 'packs', label: 'Bộ giấy đã nộp', count: Number(owner.pack_count) }] : []),
  ]
  const descParts = [owner.country_name].filter(Boolean)

  const vesselList = owner.vessels.length ? (
    <ul className="fl-rows">
      {owner.vessels.map((vessel) => (
        <li key={vessel.id}>
          <FleetTile />
          <span className="fl-rows__main">
            <Link to={`/vessels/${vessel.id}`}>{vessel.vessel_name}</Link>
            <span className="ds-cell2__sub">{[vessel.vessel_type_name, vessel.imo_number && `IMO ${vessel.imo_number}`].filter(Boolean).join(' · ') || 'Chưa có loại tàu'}</span>
          </span>
          <span className="fl-rows__end">{Number(vessel.crew_on_board)} trên tàu</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="crew-muted">Chưa có tàu nào thuộc đối tác này.</p>
  )

  const overview = (
    <div className="crew-two-col">
      <div style={{ display: 'grid', gap: 16 }}>
        {sections.map((section) => <ReadPanel key={section.key} section={section} />)}
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <SidePanel title="Đội tàu" action={can('vessel.create') ? <Button size="small" icon={<PlusOutlined />} onClick={() => navigate('/vessels/new')}>Thêm tàu</Button> : null}>
          {vesselList}
        </SidePanel>
        {can('export.view') && (
        <SidePanel title="Bộ giấy đã nộp gần đây" action={owner.recent_packs.length ? <Button size="small" type="text" onClick={() => setTab('packs')}>Xem tất cả <RightOutlined /></Button> : null}>
          {owner.recent_packs.length ? (
            <ul className="fl-rows">
              {owner.recent_packs.map((pack) => (
                <li key={pack.id}>
                  <span className="fl-rows__main">
                    <Link to={`/exports/${pack.id}`}>{pack.seafarer_name}</Link>
                    <span className="ds-cell2__sub">{pack.title} · #{packCode(pack.id)}</span>
                  </span>
                  <span className="fl-rows__end">{when(pack.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="crew-muted">Chưa nộp bộ giấy nào cho đối tác này.</p>
          )}
        </SidePanel>
        )}
        <SidePanel title="Đang được dùng ở">
          <ul className="fl-rows">
            <li><span className="fl-rows__main">Tàu thuộc đối tác</span><span className="ds-num">{owner.usage.vessels}</span></li>
            <li><span className="fl-rows__main">Chuyến tàu</span><span className="ds-num">{owner.usage.voyages}</span></li>
            <li><span className="fl-rows__main">Bộ giấy đã nộp</span><span className="ds-num">{owner.usage.packs}</span></li>
          </ul>
          <p className="fl-note">Đối tác đang được dùng thì không xoá được, chỉ chuyển sang Ngừng hợp tác.</p>
        </SidePanel>
      </div>
    </div>
  )

  const vesselsTab = (
    <section className="crew-panel crew-panel__body">{vesselList}</section>
  )

  const packsTab = (
    <section className="crew-panel">
      <Table
        rowKey="id"
        loading={packs.isLoading}
        dataSource={packs.data?.data || []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState isError={packs.isError} title={packs.isError ? 'Không tải được danh sách bộ giấy' : 'Chưa nộp bộ giấy nào cho đối tác này'} /> }}
        onRow={(pack) => ({ onClick: () => navigate(`/exports/${pack.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Thuyền viên', dataIndex: 'seafarer_name' },
          { title: 'Bộ giấy', key: 'title', render: (_, pack) => <span className="rv-muted">{pack.title} · {pack.docs.length} giấy · #{pack.code}</span> },
          { title: 'Người tạo', dataIndex: 'created_by_email', responsive: ['lg'] },
          { title: 'Ngày', dataIndex: 'created_at', render: (value) => <span className="ds-num">{when(value)}</span> },
        ]}
      />
    </section>
  )

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Đối tác', to: '/partners' }, { label: owner.company_name }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <FleetTile large text={initialsOfName(owner.company_name)} src={logo} />
          <div className="crew-head__text">
            <h1 className="crew-head__title">{owner.company_name}</h1>
            {descParts.length ? <p className="crew-head__desc">{descParts.join(' · ')}</p> : null}
            <div className="crew-head__badges">
              <StatusBadge group="partner" value={active ? 'ACTIVE' : 'INACTIVE'} />
              <span className="fl-head-meta">{owner.vessels.length} tàu</span>
            </div>
          </div>
        </div>
        <div className="crew-head__actions">
          {moreItems.length > 0 && (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={remove.isPending || save.isPending} />
            </Dropdown>
          )}
          {can('partner.update') && <Button icon={<EditOutlined />} onClick={() => navigate(`/partners/${owner.id}/edit`)}>Sửa thông tin</Button>}
          {can('export.create') && (
            <Button type="primary" icon={<SendOutlined />} disabled={!active} title={active ? undefined : 'Đối tác đã ngừng hợp tác'} onClick={() => navigate(`/exports/new?owner=${owner.id}`)}>
              Tạo bộ giấy nộp đối tác
            </Button>
          )}
        </div>
      </div>

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      {tab === 'overview' && overview}
      {tab === 'vessels' && vesselsTab}
      {tab === 'packs' && packsTab}
    </div>
  )
}
