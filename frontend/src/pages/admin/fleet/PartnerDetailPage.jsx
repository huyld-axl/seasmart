import PartnerVessels from './PartnerVessels'
import { withFlag } from '../../../utils/flag'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Skeleton, Table } from 'antd'
import { DeleteOutlined, EditOutlined, MoreOutlined, PauseCircleOutlined, PlayCircleOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import CopyButton from '../../../components/ds/CopyButton'
import { DownloadIcon } from '../../../components/ds/TransferIcons'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { shipOwnerApi } from '../../../api/fleetApi'
import { exportApi } from '../../../api/exportApi'
import { useFleetItem, useFleetMutations, usePartnerLogo } from '../../../hooks/useFleet'
import { useCan } from '../../../hooks/usePermission'
import { initialsOfName, partnerSections } from './fleetView'
import { Crumb, FleetTile } from './FleetParts'
import { ReadLayout, NotePanel } from '../seafarers/ReadSections'
import { ZaloActions, EmailActions, LineActions, PhoneActions, QuickContact, WeChatActions, WhatsAppActions } from '../../../components/ds/ContactActions'
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
  const primary = owner.contacts?.find((contact) => Number(contact.is_primary) === 1) || owner.contacts?.[0]
  const sections = partnerSections(owner, {
    tax: (value) => value ? <span className="ds-contact-value">{value}<CopyButton value={value} label="Sao chép mã số thuế" /></span> : null,
    status: (value) => <StatusBadge group="partner" value={Number(value) === 1 ? 'ACTIVE' : 'INACTIVE'} />,
    fax: (value) => value ? <span className="ds-contact-value">{value}<CopyButton value={value} label="Sao chép số fax" /></span> : null,
    phone: (v) => (v ? <span className="ds-contact-value">{v}<PhoneActions phone={v} /></span> : null),
    mail: (v) => (v ? <span className="ds-contact-value">{v}<EmailActions email={v} /></span> : null),
    chat: {
      zalo: (v) => v ? <span className="ds-contact-value">{v}<ZaloActions value={v} /></span> : null,
      whatsapp: (v) => (v ? <span className="ds-contact-value">{v}<WhatsAppActions number={v} /></span> : null),
      line: (v) => (v ? <span className="ds-contact-value">{v}<LineActions id={v} /></span> : null),
      wechat: (v) => (v ? <span className="ds-contact-value">{v}<WeChatActions id={v} /></span> : null),
    },
    quick: (c) => <QuickContact zalo={c.zalo} phone={c.phone} email={c.email} whatsapp={c.whatsapp} line={c.line_id} wechat={c.wechat_id} />,
    link: (v) => (v ? <span className="ds-contact-value"><a href={/^https?:\/\//i.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">{v}</a><CopyButton value={v} label="Sao chép website" /></span> : null),
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
    { value: 'vessels', label: 'Tàu' },
    ...(can('export.view') ? [{ value: 'packs', label: 'Bộ giấy đã nộp', count: Number(owner.pack_count) }] : []),
  ]
  const descParts = [owner.country_name && withFlag(owner.country_code, owner.country_name, owner.country_flag_emoji)].filter(Boolean)

  const overview = <ReadLayout sections={sections} label="đối tác" />

  const vesselsTab = <PartnerVessels owner={owner} />

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
    <div className="ds-page crew-profile partner-profile">
      <Crumb items={[{ label: 'Đối tác', to: '/partners' }, { label: owner.company_name }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <div className="crew-head__photo crew-head__photo--logo">
            <FleetTile large text={initialsOfName(owner.company_name)} src={logo} />
            {logo && <Button size="small" className="crew-head__download" icon={<DownloadIcon />} href={logo} download={`${owner.company_name} - logo.${logo.split(';')[0].split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') || 'png'}`}>Tải logo</Button>}
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{owner.company_name}</h1>
              <StatusBadge group="partner" value={active ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            {descParts.length ? <p className="crew-head__desc">{descParts.join(' · ')}</p> : null}
            <dl className="crew-head__meta">
              {owner.phone && (
                <>
                  <dt>Điện thoại công ty</dt>
                  <dd>{owner.phone}<PhoneActions phone={owner.phone} /></dd>
                </>
              )}
              {owner.zalo && <><dt>Zalo công ty</dt><dd>{owner.zalo}<ZaloActions value={owner.zalo} /></dd></>}
              {owner.email && (
                <>
                  <dt>Email công ty</dt>
                  <dd>{owner.email}<EmailActions email={owner.email} /></dd>
                </>
              )}
            </dl>
            {primary && (
              <section className="partner-primary" aria-label="Người liên hệ chính">
                <h2>Người liên hệ chính</h2>
                <p className="partner-primary__identity"><span>{primary.name}</span>{primary.position && <span className="crew-muted">{primary.position}</span>}</p>
                <QuickContact zalo={primary.zalo} phone={primary.phone} email={primary.email} whatsapp={primary.whatsapp} line={primary.line_id} wechat={primary.wechat_id} />
              </section>
            )}
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
