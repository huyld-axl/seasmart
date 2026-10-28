import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Input, Modal, Skeleton } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, RollbackOutlined, StopOutlined, CloseCircleOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import { ReadLayout } from '../seafarers/ReadSections'
import RequirementFit from '../../../components/ds/RequirementFit'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useOpportunity, useOpportunityMutations } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatUsd } from '../../../utils/format'
import { Crumb, FleetTile, TargetSvg } from '../fleet/FleetParts'
import CandidateTable from './CandidateTable'
import useSendToOwner from './useSendToOwner'
import PlaceModal from './PlaceModal'
import CandidatePanel from './CandidatePanel'
import SubmissionPanel from './SubmissionPanel'
import { opportunityApi } from '../../../api/opportunityApi'
import { exportApi } from '../../../api/exportApi'
import { saveBlob, downloadError } from '../exports/download'
import { deadlineLabel, requirementName } from './opportunityView'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import '../seafarers/SeafarerForm.css'
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
  const [submissionFor, setSubmissionFor] = useState(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const queryClient = useQueryClient()
  const [fitFor, setFitFor] = useState(null)
  const [closing, setClosing] = useState(false)
  const [panel, setPanel] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [tab, setTab] = useState('overview')
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
  const candidates = o.candidates || []
  const live = candidates.filter((c) => c.status === 'PICKED')
  const tabs = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'candidates', label: 'Ứng viên', count: candidates.length },
    ...(o.sends?.length ? [{ value: 'sends', label: 'Lịch sử gửi chủ tàu', count: o.sends.length }] : []),
  ]
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
    if (action === 'submission') return setSubmissionFor(c)
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
  // Tải hồ sơ nộp của những người đã chọn, mỗi người một .zip (người chưa có bộ biểu mẫu thì tạo trước).
  async function downloadPicked(people) {
    setDownloadingAll(true)
    try {
      for (const c of people) {
        const packId = c.export_pack?.id || (await opportunityApi.ensurePack(o.id, c.seafarer_id)).pack.id
        saveBlob(await exportApi.download(packId, 'pdf'), `${c.full_name}.zip`)
      }
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'item', String(o.id)] })
    } catch (e) {
      toast.error('Không tải được hồ sơ', { description: await downloadError(e) })
    } finally {
      setDownloadingAll(false)
    }
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

  const place = (date, port) => `${formatDate(date)}${port ? ` · ${port}` : ''}`
  const names = (list) => list.map(requirementName).join(' · ') || null
  const reqs = o.requirements
  const sections = [
    {
      key: 'position',
      title: 'Vị trí',
      fields: [
        ['Mã cơ hội', o.code, 4],
        ['Chức danh', o.rank_name, 4],
        ['Người phụ trách', o.owner_user_email, 4],
        ['Chủ tàu', can('partner.view') ? <Link to={`/partners/${o.ship_owner_id}`}>{o.ship_owner_name}</Link> : o.ship_owner_name, 6],
        ['Tàu', o.vessel_name ? (can('vessel.view') ? <Link to={`/vessels/${o.vessel_id}`}>{o.vessel_name}</Link> : o.vessel_name) : null, 6],
        ['Budget/tháng', `${formatUsd(o.budget_monthly_usd)} USD`, 6],
        ['Budget cả chuyến', `${formatUsd(o.budget_total_usd)} USD`, 6],
      ],
    },
    {
      key: 'time',
      title: 'Thời gian dự kiến',
      fields: [
        ['Xuống tàu', place(o.planned_join_date, o.planned_join_port_name), 6],
        ['Rời tàu', place(o.planned_leave_date, o.planned_leave_port_name), 6],
        ['Thời gian', formatMonths(o.months), 4],
        ['Hạn chốt', formatDate(o.deadline), 4],
        ['Ghi chú', o.notes, 12],
      ],
    },
    {
      key: 'requirements',
      title: 'Hồ sơ yêu cầu',
      fields: [
        ['Bắt buộc', names(reqs.filter((r) => r.kind !== 'TEMPLATE' && r.level === 'REQUIRED')), 12],
        ['Nên có', names(reqs.filter((r) => r.kind !== 'TEMPLATE' && r.level === 'PREFERRED')), 12],
        ['Mẫu giấy xuất kèm', names(reqs.filter((r) => r.kind === 'TEMPLATE')), 12],
      ],
    },
  ]

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Cơ hội', to: '/opportunities' }, { label: o.code }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <div className="crew-head__photo crew-head__photo--logo">
            <FleetTile large icon={TargetSvg} />
          </div>
          <div className="crew-head__text">
            <div className="crew-head__titlerow">
              <h1 className="crew-head__title">{o.rank_name}</h1>
              <StatusBadge group="opportunity" value={o.display_status} />
              {flag ? <span className={`crew-docs crew-docs--${flag.tone}`}>Hạn chốt {flag.text}</span> : null}
            </div>
            <dl className="crew-head__meta">
              <dt>Tàu</dt>
              <dd>{o.vessel_name ? (can('vessel.view') ? <Link to={`/vessels/${o.vessel_id}`}>{o.vessel_name}</Link> : o.vessel_name) : 'Chưa rõ tàu'}</dd>
              <dt>Chủ tàu</dt>
              <dd>{can('partner.view') ? <Link to={`/partners/${o.ship_owner_id}`}>{o.ship_owner_name}</Link> : o.ship_owner_name}</dd>
              <dt>Phụ trách</dt>
              <dd>{o.owner_user_email || '—'}</dd>
            </dl>
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

      {tabs.length > 1 ? <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" /> : null}
      {tab === 'overview' ? <ReadLayout sections={sections} label="cơ hội" /> : null}
      {tab === 'candidates' ? (
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
              {picked.length && can('export.create') ? <Button size="small" loading={downloadingAll} onClick={() => downloadPicked(picked)}>Tải hồ sơ {picked.length} người</Button> : null}
              {picked.length && can('opportunity.send') ? <Button size="small" onClick={() => sendToOwner(o, picked)}>Gửi cho chủ tàu ({picked.length})</Button> : null}
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
              onOpenSubmission={setSubmissionFor}
            />
          ) : (
            <EmptyState title="Chưa có ứng viên" description="Bấm Đề xuất nhanh để xem người hợp với hồ sơ yêu cầu, hoặc Thêm ứng viên để tìm theo tên." action={editable ? <Button type="primary" onClick={() => setPanel('suggest')}>Đề xuất nhanh</Button> : undefined} />
          )}
        </section>
      ) : null}
      {tab === 'sends' && o.sends?.length ? (
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

      {submissionFor ? (
        <SubmissionPanel
          opportunityId={o.id}
          seafarerId={submissionFor.seafarer_id}
          onClose={() => setSubmissionFor(null)}
          onSend={editable ? () => sendToOwner(o, [o.candidates.find((c) => c.seafarer_id === submissionFor.seafarer_id) || submissionFor]) : undefined}
        />
      ) : null}
      {fitFor ? <FitModal candidate={fitFor} requirements={o.requirements} onClose={() => setFitFor(null)} /> : null}
      {panel ? <CandidatePanel opportunity={o} mode={panel} onClose={() => setPanel(null)} /> : null}
      {closing ? <CloseModal opportunity={o} onClose={() => setClosing(false)} /> : null}
      {placing ? <PlaceModal opportunity={o} onClose={() => setPlacing(false)} /> : null}
    </div>
  )
}
