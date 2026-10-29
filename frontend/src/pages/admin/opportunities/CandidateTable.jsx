import { Link } from 'react-router-dom'
import { Button, Table, Tooltip } from 'antd'
import { DeleteOutlined, EyeOutlined, FileTextOutlined, SendOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import RequirementFit from '../../../components/ds/RequirementFit'
import StatusBadge from '../../../components/ds/StatusBadge'
import { actionColumn } from '../../../components/ds/actionColumn'
import { formatDate } from '../../../utils/format'
import { fitIssues } from './opportunityView'

// Bảng ứng viên của một cơ hội. selected / onSelect: chọn nhiều dòng (thanh "Đã chọn N").
// Thao tác nằm ngoài dòng thành nút biểu tượng (cột Thao tác, theo RowActions). onMenu(action, candidate): 'select' | 'unselect' | 'submission' | 'send' | 'profile' | 'remove'. onOpenFit(candidate): mở bảng đối chiếu.
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
      title: 'Gửi chủ tàu',
      key: 'sent',
      render: (_, c) => (c.last_sent_at ? <span className="ds-num">{formatDate(c.last_sent_at)}</span> : <span className="vd-muted">Chưa gửi</span>),
    },
    actionColumn((c) => {
      const stop = (fn) => (e) => { e.stopPropagation(); fn() }
      const act = (title, icon, onClick, props = {}) => (
        <Tooltip title={title}>
          <Button type="text" size="small" icon={icon} aria-label={`${title}: ${c.full_name}`} onClick={stop(onClick)} {...props} />
        </Tooltip>
      )
      const live = c.status === 'PICKED'
      const submission = live || c.export_pack
        ? act(c.export_pack ? `Hồ sơ nộp · ráp ${formatDate(c.export_pack.created_at)}` : 'Hồ sơ nộp · chưa điền biểu mẫu', <FileTextOutlined />, () => onOpenSubmission(c))
        : null
      return (
        <span className="ds-row-actions">
          {editable && live ? (c.owner_selected_at
            ? act('Bỏ nhãn chủ tàu đã chọn', <StarFilled />, () => onMenu('unselect', c), { className: 'op-star-on' })
            : act('Đánh dấu chủ tàu đã chọn', <StarOutlined />, () => onMenu('select', c))) : null}
          {submission}
          {editable && live ? act('Gửi cho chủ tàu', <SendOutlined />, () => onMenu('send', c)) : null}
          {act('Mở hồ sơ thuyền viên', <EyeOutlined />, () => onMenu('profile', c))}
          {editable && live ? act('Bỏ khỏi danh sách', <DeleteOutlined />, () => onMenu('remove', c), { danger: true }) : null}
        </span>
      )
    }, { buttons: 5 }),
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
