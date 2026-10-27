import { Link } from 'react-router-dom'
import { Table } from 'antd'
import StatusBadge from '../../../components/ds/StatusBadge'
import RowActions from '../../../components/ds/RowActions'
import { actionColumn } from '../../../components/ds/actionColumn'
import { useCan } from '../../../hooks/usePermission'
import { formatDate } from '../../../utils/format'
import { joinDeltaLabel, leaveCell, leaveFlagLabel, sourceText } from './voyageList'

// Liên kết trong ô của dòng: bấm vào liên kết thì không mở chi tiết chuyến.
function RowLink({ to, children }) {
  return <Link to={to} onClick={(event) => event.stopPropagation()}>{children}</Link>
}

function Dates({ date, sub, flag }) {
  return (
    <span className="ds-cell2">
      <span className="ds-num">{formatDate(date)}</span>
      <span className="ds-cell2__sub">{sub}</span>
      {flag ? <span className={`crew-docs crew-docs--${flag.tone}`}>{flag.text}</span> : null}
    </span>
  )
}

// Bảng chuyến (Màn 8), dùng ở danh sách chuyến và thẻ Đội ngũ trên trang tàu.
// selected = null thì không có ô chọn; có thì chỉ chọn được chuyến đang trên tàu (để ghi rời).
export default function VoyageTable({ rows, scroll, selected = null, onSelect, onOpen, hideVessel = false }) {
  const can = useCan()
  const open = onOpen
  const columns = [
    {
      title: 'Thuyền viên · chuyến',
      key: 'person',
      render: (_, row) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main">{can('seafarer.view') ? <RowLink to={`/seafarers/${row.seafarer_id}`}>{row.seafarer_name}</RowLink> : row.seafarer_name}</span>
          <span className="ds-cell2__sub ds-mono">{row.code}</span>
        </span>
      ),
    },
    { title: 'Vị trí', dataIndex: 'rank_name' },
    !hideVessel && {
      title: 'Tàu',
      key: 'vessel',
      render: (_, row) => (can('vessel.view') ? <RowLink to={`/vessels/${row.vessel_id}`}>{row.vessel_name}</RowLink> : row.vessel_name),
    },
    !hideVessel && {
      title: 'Chủ tàu',
      key: 'owner',
      responsive: ['lg'],
      render: (_, row) => (can('partner.view') ? <RowLink to={`/partners/${row.ship_owner_id}`}>{row.ship_owner_name}</RowLink> : row.ship_owner_name),
    },
    {
      title: 'Lên tàu',
      key: 'join',
      render: (_, row) => {
        const delta = joinDeltaLabel(row.join_delta_days)
        return <Dates date={row.join_date} sub={[row.join_port_name || '—', delta].filter(Boolean).join(' · ')} />
      },
    },
    {
      title: 'Rời tàu',
      key: 'leave',
      render: (_, row) => {
        const cell = leaveCell(row, formatDate)
        return <Dates date={cell.date} sub={cell.sub} flag={leaveFlagLabel(row.leave_flag)} />
      },
    },
    {
      title: 'Nguồn',
      key: 'source',
      responsive: ['xl'],
      render: (_, row) => (row.source === 'OPPORTUNITY' && row.opportunity_id && can('opportunity.view')
        ? <RowLink to={`/opportunities/${row.opportunity_id}`}><span className="ds-mono">{row.opportunity_code}</span></RowLink>
        : <span className={row.source === 'OPPORTUNITY' ? 'ds-mono' : 'vd-muted'}>{sourceText(row)}</span>),
    },
    { title: 'Trạng thái', dataIndex: 'status', render: (value) => <StatusBadge group="voyage" value={value} /> },
    actionColumn((row) => <RowActions name={`chuyến ${row.code}`} onView={() => open(row)} />),
  ].filter(Boolean)


  return (
    <Table
      rowKey="id"
      className="crew-table"
      dataSource={rows}
      columns={columns}
      pagination={false}
      scroll={scroll}
      rowSelection={selected ? {
        selectedRowKeys: selected,
        onChange: (keys) => onSelect(keys),
        getCheckboxProps: (row) => ({ disabled: row.status !== 'ONBOARD', 'aria-label': `Chọn ${row.seafarer_name}` }),
      } : undefined}
      onRow={(row) => ({ onClick: () => open(row), onKeyDown: (event) => event.key === 'Enter' && open(row), tabIndex: 0 })}
    />
  )
}
