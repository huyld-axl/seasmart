import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Dropdown, Skeleton } from 'antd'
import { CalendarOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import AuditTimeline from '../../../components/ds/AuditTimeline'
import Banner from '../../../components/ds/Banner'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import apiErrorText from '../../../utils/apiError'
import { lookupApi } from '../../../api'
import { useVoyage, useVoyageMutations } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import { MANUAL_REASON_LABELS } from '../../../constants/opportunityVoyage'
import { formatDate, formatUsd } from '../../../utils/format'
import { AnchorSvg, Crumb, FleetTile } from '../fleet/FleetParts'
import { NotePanel, ReadLayout } from '../seafarers/ReadSections'
import LeaveModal from './LeaveModal'
import { EditDatesModal, LeavePlanModal, RemoveModal } from './VoyageModals'
import { deltaText, historyItems, leaveFlagLabel, monthsLeft } from './voyageList'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import '../seafarers/SeafarerForm.css'
import '../fleet/fleet.css'
import './voyages.css'

// Màn 11 · Chi tiết chuyến: một thuyền viên đi một tàu. Ghi rời, đổi ngày rời, sửa ngày đã ghi, huỷ chốt / xoá; thẻ hợp đồng của chuyến.
export default function VoyageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const { data: v, isLoading, isError, error, refetch } = useVoyage(id)
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const [tab, setTab] = useState('overview')
  const [dialog, setDialog] = useState(null)
  const toast = useToast()
  const { editNotes } = useVoyageMutations()

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !v) {
    const missing = error?.response?.status === 404
    return (
      <EmptyState
        isError={!missing}
        title={missing ? 'Không tìm thấy chuyến' : 'Không tải được chuyến'}
        description={missing ? 'Chuyến có thể đã bị huỷ chốt hoặc xoá.' : 'Mất kết nối tới máy chủ.'}
        action={missing ? <Button onClick={() => navigate('/voyages')}>Về danh sách</Button> : <Button onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  async function saveNotes(notes) {
    try {
      await editNotes.mutateAsync({ id: v.id, notes })
      toast.success('Đã lưu ghi chú')
    } catch (error) {
      toast.error('Không lưu được ghi chú', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      throw error
    }
  }

  const onboard = v.status === 'ONBOARD'
  const flag = leaveFlagLabel(v.leave_flag)
  const fromOpportunity = v.source === 'OPPORTUNITY'
  const portName = (pid) => (ports.data || []).find((p) => p.id === pid)?.name || null
  const replaceQuery = new URLSearchParams({ owner: v.ship_owner_id, vessel: v.vessel_id, rank: v.rank_id, join: String(v.planned_leave_date).slice(0, 10) })
  const menuItems = [
    can('voyage.update') && { key: 'dates', icon: <EditOutlined />, label: 'Sửa ngày đã ghi' },
    can('opportunity.create') && { key: 'replace', icon: <SearchOutlined />, label: 'Tạo cơ hội tìm người thay' },
    can('voyage.delete') && { type: 'divider' },
    can('voyage.delete') && { key: 'remove', icon: <DeleteOutlined />, label: fromOpportunity ? 'Huỷ chốt' : 'Xoá chuyến', danger: true },
  ].filter(Boolean)
  const onMenu = ({ key }) => ({
    dates: () => setDialog('dates'),
    replace: () => navigate(`/opportunities/new?${replaceQuery}`),
    remove: () => setDialog('remove'),
  })[key]?.()

  const link = (allowed, to, text) => (allowed ? <Link to={to}>{text}</Link> : text)
  const joinDelta = deltaText(v.join_delta_days)
  const leaveDelta = deltaText(v.leave_delta_days)
  const left = monthsLeft(v.planned_leave_date)
  const source = fromOpportunity
    ? <span>Từ cơ hội {v.opportunity ? link(can('opportunity.view'), `/opportunities/${v.opportunity.id}`, v.opportunity.code) : null}</span>
    : `Tạo tay · ${MANUAL_REASON_LABELS[v.manual_reason] || 'không rõ lý do'}`
  const c = v.contract
  const contract = c
    ? (
      <>
        {link(can('contract.view'), `/contracts/${c.id}`, c.contract_number)} <StatusBadge group="contract" value={c.status} />
      </>
    )
    : (
      <span>
        <span className="vd-muted">Chưa có</span>
        {can('contract.create') ? <> <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/contracts/new?voyage=${v.id}`)}>Tạo hợp đồng</Button></> : null}
      </span>
    )

  const sections = [
    {
      key: 'voyage',
      title: 'Chuyến',
      fields: [
        ['Mã chuyến', v.code, 4],
        ['Chức danh', v.rank_name, 4],
        ['Thuyền viên', link(can('seafarer.view'), `/seafarers/${v.seafarer_id}`, v.seafarer_name), 4],
        ['Tàu', link(can('vessel.view'), `/vessels/${v.vessel_id}`, v.vessel_name), 4],
        ['Chủ tàu', link(can('partner.view'), `/partners/${v.ship_owner_id}`, v.ship_owner_name), 4],
        ['Nguồn', source, 4],
        ['Budget/tháng', v.budget_monthly_usd != null ? `${formatUsd(v.budget_monthly_usd)} USD` : null, 4],
        ['Hợp đồng', contract, 4],
      ],
    },
    {
      key: 'join',
      title: 'Lên tàu',
      fields: [
        ['Ngày lên tàu', `${formatDate(v.join_date)}${joinDelta ? ` · ${joinDelta} so với cơ hội` : ''}`, 6],
        ['Nơi lên tàu', v.join_port_name, 6],
        ['Ngày xuống dự kiến của cơ hội', v.opportunity?.planned_join_date ? formatDate(v.opportunity.planned_join_date) : null, 6],
      ],
    },
    {
      key: 'leave',
      title: 'Rời tàu',
      fields: onboard
        ? [
            ['Rời tàu dự kiến', `${formatDate(v.planned_leave_date)}${left ? ` · còn ${left} tháng` : ''}`, 6],
            ['Nơi rời dự kiến', v.planned_leave_port_name, 6],
            ['Ngày rời gốc', v.original_leave_date && v.original_leave_date !== v.planned_leave_date ? formatDate(v.original_leave_date) : null, 6],
          ]
        : [
            ['Ngày rời tàu', `${formatDate(v.leave_date)}${leaveDelta ? ` · ${leaveDelta} so với dự kiến` : ''}`, 6],
            ['Nơi rời tàu', v.leave_port_name, 6],
            ['Rời tàu dự kiến', formatDate(v.original_leave_date || v.planned_leave_date), 6],
            ['Ghi chú rời', v.leave_note, 12],
          ],
    },
  ]
  const tabs = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'history', label: 'Lịch sử', count: v.history?.length || 0 },
  ]

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Chuyến tàu', to: '/voyages' }, { label: v.code }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <div className="crew-head__photo crew-head__photo--logo">
            <FleetTile large icon={AnchorSvg} />
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{v.seafarer_name}</h1>
              <StatusBadge group="voyage" value={v.status} />
              {flag ? <span className={`crew-docs crew-docs--${flag.tone}`}>{flag.text}</span> : null}
            </div>
            <dl className="crew-head__meta">
              <dt>Chuyến</dt>
              <dd className="ds-mono">{v.code}</dd>
              <dt>Vị trí</dt>
              <dd><span>{v.rank_name} trên {link(can('vessel.view'), `/vessels/${v.vessel_id}`, v.vessel_name)}</span></dd>
              <dt>Nguồn</dt>
              <dd>{source}</dd>
            </dl>
          </div>
        </div>
        <NotePanel notes={v.notes} canEdit={can('voyage.update')} saving={editNotes.isPending} onSave={saveNotes} className="sf-note--head" />
        <div className="crew-head__actions">
          {menuItems.length ? (
            <Dropdown menu={{ items: menuItems, onClick: onMenu }} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
            </Dropdown>
          ) : null}
          {onboard && can('voyage.update') ? <Button icon={<CalendarOutlined />} onClick={() => setDialog('plan')}>Đổi ngày rời dự kiến</Button> : null}
          {onboard && can('voyage.run') ? <Button type="primary" onClick={() => setDialog('leave')}>Ghi rời tàu</Button> : null}
        </div>
      </div>

      {v.date_mismatch && c ? (
        <Banner
          tone="warning"
          title={`Đã rời tàu ${formatDate(v.date_mismatch.leave_date)}, hợp đồng ${c.contract_number} còn tới ${formatDate(v.date_mismatch.end_date)}`}
          description="Bill vẫn sinh tới ngày kết thúc hợp đồng. Cần rút ngắn thì mở hợp đồng, đưa về Nháp, sửa ngày kết thúc rồi duyệt lại."
          action={can('contract.view') ? <Button onClick={() => navigate(`/contracts/${c.id}`)}>Mở hợp đồng</Button> : undefined}
        />
      ) : null}
      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      {tab === 'overview' ? <ReadLayout sections={sections} label="chuyến" /> : null}
      {tab === 'history' ? (
        <section className="crew-panel">
          <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử <span className="vd-count">{v.history?.length || 0}</span></h2></div>
          <div className="crew-panel__body">
            {v.history?.length
              ? <AuditTimeline items={historyItems(v.history, { formatDate, portName })} />
              : <EmptyState title="Chưa có thay đổi nào" />}
          </div>
        </section>
      ) : null}

      {dialog === 'leave' ? <LeaveModal voyages={[v]} onClose={() => setDialog(null)} /> : null}
      {dialog === 'plan' ? <LeavePlanModal voyage={v} onClose={() => setDialog(null)} /> : null}
      {dialog === 'dates' ? <EditDatesModal voyage={v} onClose={() => setDialog(null)} /> : null}
      {dialog === 'remove' ? <RemoveModal voyage={v} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}
