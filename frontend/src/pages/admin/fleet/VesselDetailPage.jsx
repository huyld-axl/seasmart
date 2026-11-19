import { withFlag } from '../../../utils/flag'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Skeleton } from 'antd'
import HeadActions from '../../../components/ds/HeadActions'
import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { vesselApi } from '../../../api/fleetApi'
import { useFleetItem, useFleetMutations } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { useVoyageList } from '../../../hooks/useVoyages'
import VesselCrewTab from './VesselCrewTab'
import { VESSEL_STATUS_OPTIONS, vesselSections, filled } from './fleetView'
import { Crumb, FleetTile } from './FleetParts'
import { NotePanel, ReadLayout } from '../seafarers/ReadSections'
import '../seafarers/SeafarerListPage.css'

const KEY_FIELDS = ['Số IMO', 'Call Sign', 'Cảng đăng ký', 'Trạng thái đăng kiểm', 'GRT', 'DWT']

export default function VesselDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [tab, setTab] = useState('overview')

  const { data: vessel, isLoading, isError, refetch } = useFleetItem('vessels', vesselApi, id)
  const { save, remove, restore } = useFleetMutations(vesselApi)
  // Đang trên tàu đọc từ chuyến (mỗi chuyến một thuyền viên), không còn từ lịch sử đi tàu khai báo.
  const crew = useVoyageList({ vessel_id: id, tab: 'onboard', limit: 100 }, { enabled: !!vessel && can('voyage.view') })

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

  const onBoard = crew.data?.data || []
  const inUse = vessel.usage?.total > 0
  const sections = vesselSections(vessel, {
    linkOwner: (v) => <Link to={`/partners/${v.ship_owner_id}`}>{v.ship_owner_name}</Link>,
  })
  const missing = sections.flatMap((section) => section.fields).filter(([label, value]) => KEY_FIELDS.includes(label) && !filled(value)).map(([label]) => label)
  // Cùng khuôn màn thuyền viên và đối tác: mục lục bên trái, các khối đánh số bên phải. Ghi chú nằm ở đầu trang (NotePanel), không thành khối.
  const readSections = [
    ...sections
      .filter((section) => section.key !== 'notes')
      .map((section) => ({ ...section, fields: section.fields.map(([label, value, span, kind]) => [label, kind === 'mono' && filled(value) ? <span className="fl-mono">{value}</span> : value, span]) })),
    {
      key: 'usage',
      title: 'Đang được dùng ở',
      countLabel: `${vessel.usage.total} mục`,
      content: (
        <>
          <ul className="fl-rows">
            <li><span className="fl-rows__main">Chuyến tàu</span><span className="ds-num">{vessel.usage.voyages}</span></li>
            <li><span className="fl-rows__main">Giấy tờ thuyền viên gắn với tàu</span><span className="ds-num">{vessel.usage.documents}</span></li>
          </ul>
          <p className="fl-note">Tàu đang được dùng thì không xoá được, chỉ đổi trạng thái (Nằm bờ, Phá dỡ).</p>
        </>
      ),
    },
  ]

  async function saveNotes(notes) {
    try {
      await save.mutateAsync({ id: vessel.id, notes })
      toast.success('Đã lưu ghi chú')
    } catch (error) {
      toast.error('Không lưu được ghi chú', { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
      throw error
    }
  }

  async function changeStatus(status) {
    try {
      await save.mutateAsync({ id: vessel.id, status })
      toast.success(`Đã chuyển ${vessel.vessel_name} sang ${VESSEL_STATUS_OPTIONS.find((o) => o.value === status).label}`)
    } catch (error) {
      toast.error(`Không đổi được trạng thái ${vessel.vessel_name}`, { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
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
            onAction: () => restore.mutate(vessel.id, { onError: (error) => toast.error(`Không khôi phục được ${vessel.vessel_name}`, { description: error?.response?.data?.error || 'Thử lại sau ít phút.' }) }),
          })
          navigate('/vessels')
        } catch (error) {
          toast.error(`Không xoá được ${vessel.vessel_name}`, { description: error?.response?.data?.error || error?.response?.data?.message || 'Thử lại sau ít phút.' })
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
    can('voyage.view') && { value: 'crew', label: 'Đội ngũ', count: crew.data?.counts?.onboard ?? onBoard.length },
  ].filter(Boolean)
  const description = [vessel.vessel_type_name, vessel.flag_name && `Cờ ${withFlag(vessel.flag_code, vessel.flag_name, vessel.flag_emoji)}`].filter(Boolean).join(' · ')

  const overview = <ReadLayout sections={readSections} label="tàu" />

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Tàu', to: '/vessels' }, { label: vessel.vessel_name }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <div className="crew-head__photo crew-head__photo--logo">
            <FleetTile large />
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{vessel.vessel_name}</h1>
              <StatusBadge group="vesselStatus" value={vessel.status} />
            </div>
            <dl className="crew-head__meta">
              {description ? (
                <>
                  <div className="crew-head__pair"><dt>Loại tàu</dt>
                  <dd>{description}</dd></div>
                </>
              ) : null}
              <div className="crew-head__pair"><dt>Chủ tàu</dt>
              <dd>{vessel.ship_owner_name ? <Link to={`/partners/${vessel.ship_owner_id}`}>{vessel.ship_owner_name}</Link> : '—'}</dd></div>
              <div className="crew-head__pair"><dt>Số IMO</dt>
              <dd>{vessel.imo_number ? <span className="fl-mono">{vessel.imo_number}</span> : 'Không có IMO'}</dd></div>
              <div className="crew-head__pair"><dt>Trên tàu</dt>
              <dd>{can('voyage.view') ? (crew.data?.counts?.onboard ?? onBoard.length) : Number(vessel.crew_on_board)} thuyền viên</dd></div>
            </dl>
          </div>
        </div>
        <NotePanel notes={vessel.notes} canEdit={can('vessel.update')} saving={save.isPending} onSave={saveNotes} className="sf-note--head" />
        <HeadActions>
          {moreItems.length > 0 && (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={remove.isPending || save.isPending} />
            </Dropdown>
          )}
          {can('voyage.create') && <Button icon={<PlusOutlined />} onClick={() => navigate(`/voyages/new?${new URLSearchParams({ vessel: vessel.id, owner: vessel.ship_owner_id || '' })}`)}>Tạo chuyến</Button>}
          {can('vessel.update') && <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/vessels/${vessel.id}/edit`)}>Sửa thông tin</Button>}
        </HeadActions>
      </div>

      {missing.length > 0 && (
        <Banner
          tone="warning"
          title="Thiếu thông tin chính"
          description={`Chưa có ${missing.join(', ')}.`}
          action={can('vessel.update') ? <Button onClick={() => navigate(`/vessels/${vessel.id}/edit`)}>Bổ sung</Button> : null}
        />
      )}

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" sticky />
      {tab === 'overview' && overview}
      {tab === 'crew' && <VesselCrewTab vessel={vessel} />}
    </div>
  )
}
