import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Skeleton, Table } from 'antd'
import { EmptyState, StatusTabs } from '../../components/ds/Controls'
import StatusBadge from '../../components/ds/StatusBadge'
import { dashboardApi } from '../../api'
import { formatDate } from '../../utils/format'
import { useOpportunityList } from '../../hooks/useOpportunities'
import { useCan } from '../../hooks/usePermission'
import { deadlineLabel } from './opportunities/opportunityView'
import './seafarers/SeafarerListPage.css'
import './opportunities/opportunities.css'
import { CATEGORY } from './seafarers/certificateView'

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'EXPIRED', label: 'Quá hạn' },
  { value: 'EXPIRING', label: 'Sắp hết hạn' },
]

const countdown = (row) => {
  if (row.days_left < 0) return `Quá hạn ${-row.days_left} ngày`
  return row.days_left === 0 ? 'Hết hạn hôm nay' : `Còn ${row.days_left} ngày`
}

// Thông báo 2: cơ hội đang mở đã quá hạn chốt hoặc sắp tới hạn (bản thô, sẽ thiết kế lại).
function DeadlineAlerts() {
  const navigate = useNavigate()
  const list = useOpportunityList({ tab: 'open', limit: 100 })
  const rows = (list.data?.data || []).filter((row) => row.deadline_flag)
  return (
    <section className="ds-card">
      <h2 className="crew-panel__title" style={{ padding: '16px 20px 0' }}>Cơ hội sắp đến hạn chốt</h2>
      {list.isError ? (
        <EmptyState isError title="Không tải được cơ hội" action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
      ) : list.isLoading ? (
        <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 3 }} /></div>
      ) : !rows.length ? (
        <EmptyState title="Không có cơ hội nào sắp đến hạn chốt" />
      ) : (
        <Table
          rowKey="id"
          className="crew-table"
          dataSource={rows}
          pagination={false}
          onRow={(row) => ({ onClick: () => navigate(`/opportunities/${row.id}`), tabIndex: 0 })}
          columns={[
            { title: 'Cơ hội', key: 'code', render: (_, row) => <span className="ds-cell2"><span className="ds-cell2__main">{row.rank_name}</span><span className="ds-cell2__sub ds-mono">{row.code}</span></span> },
            { title: 'Tàu · chủ tàu', key: 'vessel', render: (_, row) => <span className="ds-cell2"><span className="ds-cell2__main">{row.vessel_name || 'Chưa rõ tàu'}</span><span className="ds-cell2__sub">{row.ship_owner_name}</span></span> },
            { title: 'Hạn chốt', dataIndex: 'deadline', render: (value) => <span className="ds-num">{formatDate(value)}</span> },
            { title: 'Cảnh báo', key: 'flag', render: (_, row) => { const flag = deadlineLabel(row.deadline_flag); return <span className={`crew-docs crew-docs--${flag.tone}`}>{flag.text}</span> } },
          ]}
        />
      )}
    </section>
  )
}

// Tổng quan: thông báo 1 là chứng chỉ thuyền viên quá hạn / sắp hết hạn, thông báo 2 là hạn chốt cơ hội. Các khối khác thêm sau.
export default function DashboardPage() {
  const navigate = useNavigate()
  const can = useCan()
  const isMobile = !Grid.useBreakpoint().md
  const [tab, setTab] = useState('all')
  const alerts = useQuery({ queryKey: ['dashboard', 'certificate-alerts'], queryFn: dashboardApi.certificateAlerts })
  const all = alerts.data?.data || []
  const rows = tab === 'all' ? all : all.filter((row) => row.state === tab)
  const counts = { all: all.length, EXPIRED: all.filter((r) => r.state === 'EXPIRED').length, EXPIRING: all.filter((r) => r.state === 'EXPIRING').length }
  const tabs = TABS.map((item) => ({ ...item, count: counts[item.value] }))
  const open = (row) => navigate(`/seafarers/${row.seafarer_id}`)

  const columns = [
    {
      title: 'Thuyền viên',
      key: 'seafarer',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.seafarer_name}</span>
          <span className="ds-cell2__sub">{[row.seafarer_code, row.rank_name].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    {
      title: 'Chứng chỉ',
      key: 'cert',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{row.certificate_name}</span>
          <span className="ds-cell2__sub">{[CATEGORY[row.certificate_category], row.certificate_number].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { title: 'Hết hạn', dataIndex: 'expiry_date', render: (value) => <span className="ds-num">{formatDate(value)}</span> },
    {
      title: 'Cảnh báo',
      key: 'alert',
      render: (_, row) => (
        <span className="ds-ctable__state">
          <StatusBadge group="cert" value={row.state} />
          <span className={`ds-ctable__alert ds-ctable__alert--${row.state === 'EXPIRED' ? 'expired' : 'expiring'}`}>{countdown(row)}</span>
        </span>
      ),
    },
  ]

  let body
  if (alerts.isError) {
    body = <EmptyState isError title="Không tải được thông báo" description="Mất kết nối tới máy chủ." action={<Button onClick={() => alerts.refetch()}>Thử lại</Button>} />
  } else if (alerts.isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 5 }} /></div>
  } else if (!all.length) {
    body = <EmptyState title="Không có chứng chỉ nào cần chú ý" description="Chưa có chứng chỉ quá hạn hay sắp hết hạn trong 60 ngày tới." />
  } else if (!rows.length) {
    body = <EmptyState title="Không có chứng chỉ nào ở mục này" action={<Button onClick={() => setTab('all')}>Xem tất cả</Button>} />
  } else if (isMobile) {
    body = (
      <ul className="crew-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="crew-list__row" onClick={() => open(row)}>
              <span className="ds-cell2">
                <span className="ds-cell2__main">{row.seafarer_name}</span>
                <span className="ds-cell2__sub">{row.certificate_name}</span>
                <span className="ds-cell2__sub">Hết hạn {formatDate(row.expiry_date)}</span>
              </span>
              <span className="crew-list__meta">
                <StatusBadge group="cert" value={row.state} />
                <span className={`ds-ctable__alert ds-ctable__alert--${row.state === 'EXPIRED' ? 'expired' : 'expiring'}`}>{countdown(row)}</span>
              </span>
            </button>
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
        onRow={(row) => ({ onClick: () => open(row), onKeyDown: (event) => event.key === 'Enter' && open(row), tabIndex: 0 })}
      />
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Tổng quan</h1>
          <p className="ds-page__desc">Chứng chỉ của thuyền viên đã quá hạn hoặc sắp hết hạn trong 60 ngày tới.</p>
        </div>
      </div>
      <StatusTabs tabs={tabs} value={tab} onChange={setTab} mobileLabel="Mục:" />
      <div className="ds-card">{body}</div>
      {can('opportunity.view') ? <DeadlineAlerts /> : null}
    </div>
  )
}
