import { Link } from 'react-router-dom'
import { Button, Dropdown, Table } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import RequirementFit from '../../../components/ds/RequirementFit'
import StatusBadge from '../../../components/ds/StatusBadge'
import { formatDate } from '../../../utils/format'
import { fitIssues } from './opportunityView'

// Bảng ứng viên của một cơ hội. selected / onSelect: chọn nhiều dòng (thanh "Đã chọn N").
// onMenu(action, candidate): 'select' | 'unselect' | 'submission' | 'send' | 'profile' | 'remove'. onOpenFit(candidate): mở bảng đối chiếu.
// onOpenSubmission(candidate): mở bảng trượt Hồ sơ nộp (giấy tờ + biểu mẫu của người đó).
export default function CandidateTable({ candidates, requirements, editable, selected, onSelect, onMenu, onOpenFit, onOpenSubmission }) {
  const columns = [
    {
      title: 'Ứng viên',
      key: 'name',
      render: (_, c) => (
        <span className="ds-cell2">
          <span className="ds-cell2__main op-cand">
            <Link to={`/seafarers/${c.seafarer_id}`} onClick={(e) => e.stopPropagation()}>{c.full_name}</Link>
            {c.owner_selected_at ? <span className="op-selected">Chủ tàu đã chọn</span> : null}
          </span>
          <span className="ds-cell2__sub">
            {c.status === 'PICKED' ? null : <><StatusBadge group="candidate" value={c.status} />{' '}</>}
            {c.seafarer_status === 'ON_VESSEL' ? `Đang trên tàu${c.onboard_until ? ` · rời dự kiến ${formatDate(c.onboard_until)}` : ''}` : c.seafarer_status === 'INACTIVE' ? 'Tạm ngưng' : 'Ở bờ'}
            {c.current_rank_name ? ` · ${c.current_rank_name}` : ''}
          </span>
        </span>
      ),
    },
    { title: 'Hồ sơ yêu cầu', key: 'fit', render: (_, c) => <RequirementFit fit={c.fit} onOpen={() => onOpenFit(c)} /> },
    {
      title: 'Thiếu hoặc sắp hết hạn',
      key: 'issues',
      responsive: ['lg'],
      render: (_, c) => {
        const issues = fitIssues(c.fit, requirements, formatDate)
        if (!issues.length) return <span className="vd-muted">—</span>
        return (
          <span className="ds-cell2">
            {issues.slice(0, 2).map((i) => <span key={i.text} className={i.required ? 'op-issue op-issue--req' : 'op-issue'}>{i.text}</span>)}
            {issues.length > 2 ? <span className="ds-cell2__sub">+{issues.length - 2} mục khác</span> : null}
          </span>
        )
      },
    },
    {
      title: 'Hồ sơ nộp',
      key: 'pack',
      render: (_, c) => (c.status === 'PICKED' || c.export_pack ? (
        <span className="ds-cell2">
          <Button size="small" onClick={(e) => { e.stopPropagation(); onOpenSubmission(c) }}>Hồ sơ nộp</Button>
          <span className="ds-cell2__sub">{c.export_pack ? `Ráp ${formatDate(c.export_pack.created_at)}` : 'Chưa điền biểu mẫu'}</span>
        </span>
      ) : null),
    },
    {
      title: 'Gửi chủ tàu',
      key: 'sent',
      render: (_, c) => (c.last_sent_at ? <span className="ds-num">{formatDate(c.last_sent_at)}</span> : <span className="vd-muted">Chưa gửi</span>),
    },
    {
      title: <span className="ds-sr-only">Thao tác</span>,
      key: 'menu',
      align: 'right',
      render: (_, c) => (editable && c.status === 'PICKED' ? (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              c.owner_selected_at ? { key: 'unselect', label: 'Bỏ nhãn chủ tàu đã chọn' } : { key: 'select', label: 'Đánh dấu chủ tàu đã chọn' },
              { key: 'submission', label: 'Mở hồ sơ nộp' },
              { key: 'send', label: 'Gửi cho chủ tàu' },
              { key: 'profile', label: 'Mở hồ sơ thuyền viên' },
              { type: 'divider' },
              { key: 'remove', label: 'Bỏ khỏi danh sách', danger: true },
            ],
            onClick: ({ key, domEvent }) => { domEvent.stopPropagation(); onMenu(key, c) },
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${c.full_name}`} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      ) : null),
    },
  ]

  return (
    <Table
      rowKey="seafarer_id"
      className="crew-table"
      dataSource={candidates}
      columns={columns}
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowSelection={editable ? {
        selectedRowKeys: selected,
        onChange: onSelect,
        getCheckboxProps: (c) => ({ disabled: c.status !== 'PICKED', 'aria-label': `Chọn ${c.full_name}` }),
      } : undefined}
    />
  )
}
