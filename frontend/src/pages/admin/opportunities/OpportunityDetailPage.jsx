import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Input, Modal, Skeleton } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, RollbackOutlined, StopOutlined, CloseCircleOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import { EmptyState } from '../../../components/ds/Controls'
import DescriptionList from '../../../components/ds/DescriptionList'
import RequirementFit from '../../../components/ds/RequirementFit'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useOpportunity, useOpportunityMutations } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatUsd } from '../../../utils/format'
import { Crumb, FleetTile } from '../fleet/FleetParts'
import CandidateTable from './CandidateTable'
import useSendToOwner from './useSendToOwner'
import PlaceModal from './PlaceModal'
import CandidatePanel from './CandidatePanel'
import { deadlineLabel, requirementName, requirementSummary } from './opportunityView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import '../voyages/voyages.css'
import './opportunities.css'

const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`
const FIT_STATE = { ok: 'Có', missing: 'Thiếu', expires_early: 'Hết hạn trước mốc' }

// Bảng đối chiếu từng mục hồ sơ yêu cầu của một ứng viên.
function FitModal({ candidate, requirements, onClose }) {
  const byId = new Map(requirements.map((r) => [r.id, r]))
  return (
    <Modal open onCancel={onClose} footer={null} width={560} title={`Đối chiếu hồ sơ yêu cầu · ${candidate.full_name}`}>
      <RequirementFit fit={candidate.fit} />
      <table className="op-fit-table">
        <tbody>
          {candidate.fit.items.map((item) => {
            const r = byId.get(item.requirement_id) || {}
            return (
              <tr key={item.requirement_id}>
                <td>
                  {requirementName(r)}
                  <div className="vd-muted">{item.level === 'REQUIRED' ? 'Bắt buộc' : 'Nên có'}{item.needed_until ? ` · cần còn hạn tới ${formatDate(item.needed_until)}` : ''}</div>
                </td>
                <td className={item.state === 'ok' ? 'op-fit--ok' : 'op-issue--req'}>
                  {FIT_STATE[item.state]}{item.expiry ? ` · hạn ${formatDate(item.expiry)}` : ''}{item.value != null ? ` · ${item.value}` : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Modal>
  )
}

// Đóng cơ hội Không thành: bắt buộc lý do.
function CloseModal({ opportunity, onClose }) {
  const toast = useToast()
  const { close } = useOpportunityMutations()
  const [reason, setReason] = useState('')
  async function submit() {
    try {
      await close.mutateAsync({ id: opportunity.id, outcome: 'LOST', reason: reason.trim() })
      toast.success(`Đã đóng cơ hội ${opportunity.code}`)
      onClose()
    } catch (error) {
      toast.error(`Không đóng được cơ hội ${opportunity.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }
  return (
    <Modal
      open
      onCancel={onClose}
      width={480}
      title={`Đóng cơ hội ${opportunity.code} · Không thành?`}
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" danger loading={close.isPending} disabled={!reason.trim()} onClick={submit}>Đóng cơ hội</Button>,
      ]}
    >
      <p className="vt-desc">Ghi lý do để sau này xem lại, ví dụ "Chủ tàu không chọn" hoặc "Chủ tàu chọn agency khác".</p>
      <Input.TextArea rows={3} maxLength={1000} showCount autoFocus value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Lý do không thành" />
    </Modal>
  )
}

export default function OpportunityDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const { data: o, isLoading, isError, refetch } = useOpportunity(id)
  const m = useOpportunityMutations()
  const [selected, setSelected] = useState([])
  const [fitFor, setFitFor] = useState(null)
  const [closing, setClosing] = useState(false)
  const [panel, setPanel] = useState(null)
  const [placing, setPlacing] = useState(false)
  const sendToOwner = useSendToOwner()

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !o) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được cơ hội' : 'Không tìm thấy cơ hội'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Cơ hội có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/opportunities')}>Về danh sách</Button>}
      />
    )
  }

  const isOpen = o.status === 'OPEN'
  const editable = isOpen && can('opportunity.update')
  const flag = isOpen ? deadlineLabel(o.deadline_flag) : null
  const summary = requirementSummary(o.requirements)
  const candidates = o.candidates || []
  const live = candidates.filter((c) => c.status === 'PICKED')
  const run = async (promise, ok, fail) => {
    try {
      await promise
      if (ok) toast.success(ok)
    } catch (error) {
      toast.error(fail, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  function onCandidateMenu(action, c) {
    if (action === 'profile') return navigate(`/seafarers/${c.seafarer_id}`)
    if (action === 'pack') return makePacks([c])
    if (action === 'send') return sendToOwner(o, [c])
    if (action === 'select' || action === 'unselect') {
      const selectedNow = action === 'select'
      return run(
        m.setOwnerSelected.mutateAsync({ id: o.id, seafarerId: c.seafarer_id, selected: selectedNow }),
        selectedNow ? `Đã đánh dấu chủ tàu đã chọn ${c.full_name}` : `Đã bỏ nhãn của ${c.full_name}`,
        'Không đổi được nhãn',
      )
    }
    if (action === 'remove') {
      return modal.confirm({
        title: `Bỏ ${c.full_name} khỏi danh sách?`,
        content: 'Thêm lại được sau từ Đề xuất ứng viên.',
        okText: 'Bỏ khỏi danh sách',
        okType: 'danger',
        cancelText: 'Huỷ',
        onOk: () => run(m.removeCandidate.mutateAsync({ id: o.id, seafarerId: c.seafarer_id }), `Đã bỏ ${c.full_name}`, `Không bỏ được ${c.full_name}`),
      })
    }
    return undefined
  }

  const picked = live.filter((c) => selected.includes(c.seafarer_id))
  const unpacked = picked.filter((c) => !c.export_pack)
  const packed = picked.filter((c) => c.export_pack)
  function makePacks(people) {
    navigate(`/exports/new?opportunity=${o.id}&seafarers=${people.map((c) => c.seafarer_id).join(',')}`)
  }

  function removeSelected() {
    const names = live.filter((c) => selected.includes(c.seafarer_id)).map((c) => c.full_name)
    modal.confirm({
      title: `Bỏ ${names.length} người khỏi danh sách?`,
      content: names.join(', '),
      okText: 'Bỏ khỏi danh sách',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        for (const seafarerId of selected) await m.removeCandidate.mutateAsync({ id: o.id, seafarerId }).catch(() => null)
        setSelected([])
        toast.success(`Đã bỏ ${names.length} người khỏi danh sách`)
      },
    })
  }

  async function duplicate() {
    try {
      const row = await m.duplicate.mutateAsync({ id: o.id })
      toast.success(`Đã nhân bản thành ${row.code}`, { description: 'Đổi chức danh và budget cho vị trí mới.' })
      navigate(`/opportunities/${row.id}/edit`)
    } catch (error) {
      toast.error('Không nhân bản được cơ hội', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  function confirmCancel() {
    modal.confirm({
      title: `Huỷ cơ hội ${o.code}?`,
      content: 'Dùng khi chủ tàu rút yêu cầu. Mở lại được sau.',
      okText: 'Huỷ cơ hội',
      okType: 'danger',
      cancelText: 'Đóng',
      onOk: () => run(m.close.mutateAsync({ id: o.id, outcome: 'CANCELLED' }), `Đã huỷ cơ hội ${o.code}`, `Không huỷ được cơ hội ${o.code}`),
    })
  }

  function confirmDelete() {
    modal.confirm({
      title: `Xoá cơ hội ${o.code}?`,
      content: 'Chỉ xoá được khi chưa gửi chủ tàu. Đã gửi thì đóng cơ hội thay vì xoá.',
      okText: 'Xoá cơ hội',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await m.remove.mutateAsync(o.id)
          toast.success(`Đã xoá cơ hội ${o.code}`)
          navigate('/opportunities')
        } catch (error) {
          toast.error(`Không xoá được cơ hội ${o.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }

  const menuItems = [
    can('opportunity.create') && { key: 'duplicate', icon: <CopyOutlined />, label: 'Nhân bản cho vị trí khác' },
    isOpen && can('opportunity.close') && { key: 'lost', icon: <CloseCircleOutlined />, label: 'Đóng cơ hội · Không thành' },
    isOpen && can('opportunity.close') && { key: 'cancel', icon: <StopOutlined />, label: 'Huỷ cơ hội' },
    ['LOST', 'CANCELLED'].includes(o.status) && can('opportunity.close') && { key: 'reopen', icon: <RollbackOutlined />, label: 'Mở lại cơ hội' },
    isOpen && !o.sends?.length && can('opportunity.close') && { type: 'divider' },
    isOpen && !o.sends?.length && can('opportunity.close') && { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá cơ hội', danger: true },
  ].filter(Boolean)
  const onMenu = ({ key }) => ({
    duplicate,
    lost: () => setClosing(true),
    cancel: confirmCancel,
    reopen: () => run(m.reopen.mutateAsync(o.id), `Đã mở lại cơ hội ${o.code}`, `Không mở lại được cơ hội ${o.code}`),
    delete: confirmDelete,
  })[key]?.()

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Cơ hội', to: '/opportunities' }, { label: o.code }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <FleetTile large />
          <div className="crew-head__text">
            <h1 className="crew-head__title">{o.rank_name} · {o.vessel_name || 'Chưa rõ tàu'} · {o.code}</h1>
            <p className="crew-head__desc">{o.ship_owner_name} · phụ trách {o.owner_user_email || '—'}</p>
            <div className="crew-head__badges">
              <StatusBadge group="opportunity" value={o.display_status} />
              {flag ? <span className={`op-flag op-flag--${flag.tone}`}>Hạn chốt {flag.text}</span> : null}
            </div>
          </div>
        </div>
        <div className="crew-head__actions">
          {menuItems.length ? (
            <Dropdown menu={{ items: menuItems, onClick: onMenu }} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
            </Dropdown>
          ) : null}
          {editable ? <Button icon={<EditOutlined />} onClick={() => navigate(`/opportunities/${o.id}/edit`)}>Sửa cơ hội</Button> : null}
          {isOpen && live.length && can('opportunity.close') ? <Button type="primary" onClick={() => setPlacing(true)}>Chốt người</Button> : null}
          {o.voyage && can('voyage.view') ? <Button type="primary" onClick={() => navigate(`/voyages/${o.voyage.id}`)}>Mở chuyến {o.voyage.code}</Button> : null}
        </div>
      </div>

      {o.status === 'LOST' && o.close_reason ? <Banner tone="neutral" title="Không thành" description={o.close_reason} /> : null}

      <section className="crew-panel crew-panel__body">
        <DescriptionList items={[
          { label: 'Xuống tàu dự kiến', value: `${formatDate(o.planned_join_date)}${o.planned_join_port_name ? ` · ${o.planned_join_port_name}` : ''}` },
          { label: 'Rời tàu dự kiến', value: `${formatDate(o.planned_leave_date)}${o.planned_leave_port_name ? ` · ${o.planned_leave_port_name}` : ''} · ${formatMonths(o.months)}` },
          { label: 'Budget', value: `${formatUsd(o.budget_monthly_usd)} USD/tháng · ${formatUsd(o.budget_total_usd)} USD cả chuyến` },
          { label: 'Hạn chốt', value: formatDate(o.deadline) },
          {
            label: 'Hồ sơ yêu cầu',
            value: o.requirements.length
              ? `${summary.required} bắt buộc · ${summary.preferred} nên có${summary.templates ? ` · ${summary.templates} mẫu giấy` : ''}`
              : null,
          },
          { label: 'Ghi chú', value: o.notes },
        ]} />
      </section>

      <section className="crew-panel">
        <div className="crew-panel__head">
          <h2 className="crew-panel__title">Ứng viên <span className="vd-count">{candidates.length}</span></h2>
          {editable ? (
            <span className="op-panel-actions">
              <Button onClick={() => setPanel('suggest')}>Đề xuất nhanh</Button>
              <Button type="text" icon={<PlusOutlined />} onClick={() => setPanel('search')}>Thêm ứng viên</Button>
            </span>
          ) : null}
        </div>
        {editable && selected.length ? (
          <div className="op-bulk">
            <b>Đã chọn {selected.length}</b>
            {unpacked.length && can('export.create') ? <Button size="small" onClick={() => makePacks(unpacked)}>Tạo bản xuất cho {unpacked.length} người</Button> : null}
            {packed.length && can('opportunity.send') ? <Button size="small" onClick={() => sendToOwner(o, packed)}>Gửi cho chủ tàu ({packed.length})</Button> : null}
            <Button size="small" danger onClick={removeSelected}>Bỏ khỏi danh sách</Button>
            <Button size="small" type="text" onClick={() => setSelected([])}>Bỏ chọn</Button>
          </div>
        ) : null}
        {candidates.length ? (
          <CandidateTable
            candidates={candidates}
            requirements={o.requirements}
            editable={editable}
            selected={selected}
            onSelect={setSelected}
            onMenu={onCandidateMenu}
            onOpenFit={setFitFor}
          />
        ) : (
          <EmptyState title="Chưa có ứng viên" description="Bấm Đề xuất nhanh để xem người hợp với hồ sơ yêu cầu, hoặc Thêm ứng viên để tìm theo tên." action={editable ? <Button type="primary" onClick={() => setPanel('suggest')}>Đề xuất nhanh</Button> : undefined} />
        )}
      </section>

      {o.sends?.length ? (
        <section className="crew-panel">
          <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử gửi chủ tàu <span className="vd-count">{o.sends.length}</span></h2></div>
          <ul className="op-sends">
            {o.sends.map((s) => (
              <li key={s.id}>
                <b>{s.subject}</b>
                <span className="vd-muted">{formatDate(s.sent_at)} · {s.sent_by_email} gửi tới {s.to_email} · {s.candidate_ids.length} người</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fitFor ? <FitModal candidate={fitFor} requirements={o.requirements} onClose={() => setFitFor(null)} /> : null}
      {panel ? <CandidatePanel opportunity={o} mode={panel} onClose={() => setPanel(null)} /> : null}
      {closing ? <CloseModal opportunity={o} onClose={() => setClosing(false)} /> : null}
      {placing ? <PlaceModal opportunity={o} onClose={() => setPlacing(false)} /> : null}
    </div>
  )
}
