import { withFlag } from '../../../utils/flag'
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
import { Crumb, FleetTile } from './FleetParts'
import { ReadLayout, NotePanel } from '../seafarers/ReadSections'
import { EmailActions, PhoneActions } from '../../../components/ds/ContactActions'
import '../seafarers/SeafarerListPage.css'

const when = (value) => (dayjs(value).isSame(dayjs(), 'day') ? `${dayjs(value).format('HH:mm')} hôm nay` : dayjs(value).format('DD/MM/YYYY'))

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
  const primary = owner.contacts?.[0]
  const headPhone = primary?.phone || owner.phone
  const headEmail = primary?.email || owner.email
  const sections = partnerSections(owner, {
    phone: (v) => (v ? <span>{v}<PhoneActions phone={v} /></span> : null),
    mail: (v) => (v ? <span>{v}<EmailActions email={v} /></span> : null),
    link: (v) => (v ? <a href={/^https?:\/\//i.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">{v}</a> : null),
  })

  async function toggleActive() {
    try {
      await save.mutateAsync({ id: owner.id, is_active: active ? 0 : 1 })
      toast.success(active ? `Đã chuyển ${owner.company_name} sang Ngừng hợp tác` : `Đã chuyển ${owner.company_name} về Đang hợp tác`)
    } catch (error) {
      toast.error(`Không đổi được tình trạng ${owner.company_name}`, { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
    }
  }

  async function saveNotes(notes) {
    try {
      await save.mutateAsync({ id: owner.id, notes })
      toast.success('Đã lưu ghi chú')
    } catch (error) {
      toast.error('Không lưu được ghi chú', { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
      throw error
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
  const descParts = [owner.country_name && withFlag(owner.country_code, owner.country_name)].filter(Boolean)

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

  const overview = <ReadLayout sections={sections} label="đối tác" />

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
          <div className="crew-head__photo crew-head__photo--logo">
            <FleetTile large text={initialsOfName(owner.company_name)} src={logo} />
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{owner.company_name}</h1>
              <StatusBadge group="partner" value={active ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            {descParts.length ? <p className="crew-head__desc">{descParts.join(' · ')}</p> : null}
            <dl className="crew-head__meta">
              {primary && (
                <>
                  <dt>Liên hệ chính</dt>
                  <dd>{[primary.name, primary.position].filter(Boolean).join(' · ')}</dd>
                </>
              )}
              {headPhone && (
                <>
                  <dt>Điện thoại</dt>
                  <dd>{headPhone}<PhoneActions phone={headPhone} /></dd>
                </>
              )}
              {headEmail && (
                <>
                  <dt>Email</dt>
                  <dd>{headEmail}<EmailActions email={headEmail} /></dd>
                </>
              )}
              <dt>Tàu</dt>
              <dd>{owner.vessels.length} tàu</dd>
            </dl>
          </div>
        </div>
        <NotePanel notes={owner.notes} canEdit={can('partner.update')} saving={save.isPending} onSave={saveNotes} className="sf-note--head" />
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
