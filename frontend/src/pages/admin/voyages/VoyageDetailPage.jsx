import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Dropdown, Skeleton, Table } from 'antd'
import { DeleteOutlined, DollarOutlined, EditOutlined, FileTextOutlined, MoreOutlined, PlayCircleOutlined, PlusOutlined, StopOutlined, WalletOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import { EmptyState } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useVoyage, useVoyageMutations } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatDiff, formatUsd } from '../../../utils/format'
import { Crumb, FleetTile } from '../fleet/FleetParts'
import VoyageTransitionModal from './VoyageTransitionModal'
import { DueTag } from './VoyageParts'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import '../fleet/fleet.css'
import './voyages.css'

const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`
const NOT_EFFECTIVE = ['DRAFT', 'PENDING', 'REJECTED']

function Fact({ label, value, sub, subTone }) {
  return (
    <div className="vd-fact">
      <dt className="vd-fact__label">{label}</dt>
      <dd className="vd-fact__value">{value || <span className="vd-muted">—</span>}</dd>
      <dd className={`vd-fact__sub${subTone === 'error' ? ' vd-fact__sub--error' : ''}`}>{sub}</dd>
    </div>
  )
}

function SumCard({ icon, label, children, sub }) {
  return (
    <div className="vd-sum">
      <span className="vd-sum__icon" aria-hidden>{icon}</span>
      <div className="vd-sum__body">
        <p className="vd-sum__label">{label}</p>
        <p className="vd-sum__value">{children}</p>
        <p className="vd-sum__sub">{sub}</p>
      </div>
    </div>
  )
}

export default function VoyageDetailPage() {
  const can = useCan()
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const [transition, setTransition] = useState(null)
  const { data: voyage, isLoading, isError, refetch } = useVoyage(id)
  const { remove } = useVoyageMutations()

  if (isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-head"><Skeleton active title paragraph={{ rows: 1 }} /></div>
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 4 }} /></div>
      </div>
    )
  }
  if (isError || !voyage) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được chuyến tàu' : 'Không tìm thấy chuyến tàu'}
        description={isError ? 'Mất kết nối tới máy chủ.' : 'Chuyến có thể đã bị xoá.'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/voyages')}>Về danh sách</Button>}
      />
    )
  }

  const { summary, positions } = voyage
  const planning = voyage.status === 'PLANNING'
  const onboard = voyage.status === 'ONBOARD'
  const ended = voyage.status === 'ENDED'
  const canDelete = planning && summary.contracts_total === 0 && can('voyage.delete')
  const late = voyage.due?.kind === 'LATE' ? voyage.due : null
  const pendingPeople = onboard ? positions.filter((p) => p.contract && NOT_EFFECTIVE.includes(p.contract.status)) : []
  const byStatus = summary.contracts_by_status
  const fixCount = (byStatus.DRAFT || 0) + (byStatus.REJECTED || 0)
  const diffVoyage = Math.round(summary.diff_monthly * voyage.months * 100) / 100

  function handleDelete() {
    modal.confirm({
      title: `Xoá chuyến ${voyage.code}?`,
      content: 'Chuyến và các vị trí dự kiến sẽ bị ẩn khỏi danh sách.',
      okText: 'Xoá chuyến',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await remove.mutateAsync(voyage.id)
          toast.success(`Đã xoá chuyến ${voyage.code}`)
          navigate('/voyages')
        } catch (error) {
          toast.error(`Không xoá được chuyến ${voyage.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }

  const moreMenu = {
    items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá chuyến', danger: true }],
    onClick: handleDelete,
  }

  const columns = [
    { title: '#', key: 'n', width: 40, render: (_, __, index) => <span className="vd-muted">{index + 1}</span> },
    { title: 'Vị trí', dataIndex: 'rank_name', render: (name) => <span className="vd-rank">{name}</span> },
    { title: 'Budget cả chuyến (USD)', dataIndex: 'budget_total_usd', align: 'right', render: (v) => <span className="ds-num">{formatUsd(v)}</span> },
    { title: 'Budget/tháng (USD)', dataIndex: 'budget_monthly_usd', align: 'right', render: (v) => <span className="ds-num vd-muted">{formatUsd(v)}</span> },
    {
      title: 'Thuyền viên · hợp đồng',
      key: 'crew',
      render: (_, row) =>
        row.contract ? (
          <span className="ds-cell2">
            <Link to={`/seafarers/${row.contract.seafarer_id}`} onClick={(event) => event.stopPropagation()}>{row.contract.seafarer_name}</Link>
            <span><StatusBadge group="contract" value={row.contract.status} /></span>
          </span>
        ) : (
          <span className="vd-muted">Chưa có người</span>
        ),
    },
    { title: 'Trạng thái', key: 'crew_status', render: (_, row) => (row.contract ? <StatusBadge group="crew" value={row.contract.seafarer_status} /> : <span className="vd-muted">—</span>) },
    { title: 'Phải chi (USD/tháng)', key: 'payable', align: 'right', render: (_, row) => (row.contract ? <span className="ds-num">{formatUsd(row.contract.payable_monthly)}</span> : <span className="vd-muted">—</span>) },
    {
      title: 'Chênh lệch',
      key: 'diff',
      align: 'right',
      render: (_, row) => {
        if (!row.contract) return <span className="vd-muted">—</span>
        const diff = Math.round((row.contract.receivable_monthly - row.contract.payable_monthly) * 100) / 100
        const percent = row.budget_monthly_usd > 0 ? Math.round((diff / row.budget_monthly_usd) * 100) : null
        return (
          <span className="ds-cell2 vd-diff">
            <b className="ds-num">{formatDiff(diff)}</b>
            {percent != null ? <span className="ds-cell2__sub">{percent}%</span> : null}
          </span>
        )
      },
    },
    {
      title: <span className="ds-sr-only">Hợp đồng</span>,
      key: 'action',
      align: 'right',
      render: (_, row) =>
        row.contract ? (
          can('contract.view') ? <Button type="link" onClick={() => navigate(`/contracts/${row.contract.id}`)}>Mở hợp đồng</Button> : null
        ) : ended || !can('contract.create') ? null : (
          <Button type="link" onClick={() => navigate(`/contracts/new?positionId=${row.id}&voyageId=${voyage.id}`)}>Tạo hợp đồng</Button>
        ),
    },
  ]

  return (
    <div className="ds-page crew-profile">
      <Crumb items={[{ label: 'Chuyến tàu', to: '/voyages' }, { label: voyage.code }]} />

      <div className="crew-head">
        <div className="crew-head__person">
          <FleetTile large />
          <div className="crew-head__text">
            <h1 className="crew-head__title">{voyage.vessel_name} · {voyage.code}</h1>
            <p className="crew-head__desc">
              {voyage.ship_owner_name}
              {voyage.embark_port_name || voyage.disembark_port_name ? ` · ${voyage.embark_port_name || '—'} → ${voyage.disembark_port_name || '—'}` : ''}
            </p>
            <div className="crew-head__badges">
              <StatusBadge group="voyage" value={voyage.display_status} />
              <DueTag due={voyage.due} />
            </div>
          </div>
        </div>
        <div className="crew-head__actions">
          {canDelete ? (
            <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Thao tác khác" loading={remove.isPending} />
            </Dropdown>
          ) : null}
          {can('voyage.update') ? <Button icon={<EditOutlined />} onClick={() => navigate(`/voyages/${voyage.id}/edit`)}>Sửa chuyến</Button> : null}
          {planning && can('voyage.run') ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setTransition('start')}>Bắt đầu chuyến</Button> : null}
          {onboard && can('voyage.run') ? <Button type="primary" icon={<StopOutlined />} onClick={() => setTransition('end')}>Kết thúc chuyến</Button> : null}
        </div>
      </div>

      {late ? (
        <Banner
          tone="warning"
          title={`Quá ngày xuống tàu dự kiến ${late.days} ngày`}
          description={`Dự kiến xuống tàu ${formatDate(voyage.planned_embark_date)} nhưng chuyến chưa bắt đầu. Thuyền viên đã lên tàu thì bấm Bắt đầu chuyến để ghi ngày và nơi xuống tàu thực tế.`}
        />
      ) : null}
      {pendingPeople.length ? (
        <Banner
          tone="warning"
          title={`${pendingPeople.length} hợp đồng chưa hiệu lực`}
          description={`${pendingPeople.map((p) => p.contract.seafarer_name).join(', ')} vẫn ở trạng thái Ở bờ. Khi duyệt hợp đồng, hộp thoại sẽ hỏi có chuyển người đó sang Đang trên tàu không.`}
        />
      ) : null}

      <section className="crew-panel crew-panel__body vd-facts-panel">
        <dl className="vd-facts">
          <Fact
            label="Xuống tàu"
            value={formatDate(voyage.actual_embark_date || voyage.planned_embark_date)}
            sub={voyage.actual_embark_date ? `Thực tế · dự kiến ${formatDate(voyage.planned_embark_date)}` : late ? `Dự kiến · đã quá ${late.days} ngày` : 'Dự kiến'}
            subTone={!voyage.actual_embark_date && late ? 'error' : undefined}
          />
          <Fact label="Nơi xuống tàu" value={voyage.embark_port_name} sub={planning ? 'Dự kiến' : 'Thực tế'} />
          <Fact
            label="Rời tàu"
            value={formatDate(voyage.actual_disembark_date || voyage.planned_disembark_date)}
            sub={voyage.actual_disembark_date ? `Thực tế · dự kiến ${formatDate(voyage.planned_disembark_date)}` : `Dự kiến · ${formatMonths(voyage.months)}`}
          />
          <Fact label="Nơi rời tàu" value={voyage.disembark_port_name} sub={ended ? 'Thực tế' : 'Dự kiến'} />
        </dl>
        <div className="vd-owner">
          <p className="vd-fact__label">Chủ tàu · ghi chú</p>
          <p className="vd-owner__text">
            <Link to={`/partners/${voyage.ship_owner_id}`}>{voyage.ship_owner_name}</Link>
            {voyage.notes ? ` · ${voyage.notes}` : ''}
          </p>
        </div>
      </section>

      <div className="vd-sums">
        <SumCard icon={<WalletOutlined />} label="Budget dự kiến" sub={`${formatUsd(summary.budget_monthly_usd)} USD/tháng · ${summary.positions_total} vị trí · ${formatMonths(voyage.months)}`}>
          <b>{formatUsd(summary.budget_total_usd)}</b> <span className="vd-unit">USD</span>
        </SumCard>
        <SumCard
          icon={<FileTextOutlined />}
          label="Hợp đồng"
          sub={`${byStatus.ACTIVE || 0} hiệu lực · ${byStatus.PENDING || 0} chờ duyệt · ${fixCount} cần sửa · ${summary.empty_positions} trống`}
        >
          <b>{summary.contracts_total}</b> <span className="vd-unit">/ {summary.positions_total}</span>
        </SumCard>
        <SumCard
          icon={<DollarOutlined />}
          label="Chênh lệch dự kiến"
          sub={summary.contracts_total ? `${formatUsd(diffVoyage)} USD cả chuyến · từ ${summary.contracts_total} hợp đồng` : 'Chưa có hợp đồng nào'}
        >
          {summary.contracts_total ? <><b>{formatUsd(summary.diff_monthly)}</b> <span className="vd-unit">USD/tháng</span></> : <b>—</b>}
        </SumCard>
      </div>

      <section className="crew-panel">
        <div className="crew-panel__head">
          <h2 className="crew-panel__title">Vị trí dự kiến <span className="vd-count">{positions.length}</span></h2>
          {ended || !can('voyage.update') ? null : <Button type="text" icon={<PlusOutlined />} onClick={() => navigate(`/voyages/${voyage.id}/edit`)}>Thêm vị trí</Button>}
        </div>
        <Table rowKey="id" columns={columns} dataSource={positions} pagination={false} scroll={{ x: 'max-content' }} className="vd-table ds-table--tint" />
        <div className="vd-foot">
          <p>Trạng thái thuyền viên đổi khi bấm Bắt đầu chuyến và Kết thúc chuyến, chỉ với người có hợp đồng Hiệu lực.</p>
          <p className="ds-num">Phải thu {formatUsd(summary.receivable_monthly)} · phải chi {formatUsd(summary.payable_monthly)} · chênh lệch {formatUsd(summary.diff_monthly)} USD/tháng</p>
        </div>
      </section>

      {transition ? <VoyageTransitionModal kind={transition} voyage={voyage} open onClose={() => setTransition(null)} /> : null}
    </div>
  )
}
