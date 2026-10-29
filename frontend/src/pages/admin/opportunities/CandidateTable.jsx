import { Link } from 'react-router-dom'
import { Button, Table, Tooltip } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import RequirementFit from '../../../components/ds/RequirementFit'
import StageChips from '../../../components/ds/StageChips'
import StatusBadge from '../../../components/ds/StatusBadge'
import { actionColumn } from '../../../components/ds/actionColumn'
import { formatDate } from '../../../utils/format'
import { candidateStages, fitIssues } from './opportunityView'

// Bảng ứng viên của một cơ hội. selected / onSelect: chọn nhiều dòng (thanh "Đã chọn N").
// Cột Tiến trình: ba chặng Ráp hồ sơ → Gửi → Chủ tàu chọn, bấm chặng là làm việc. Chỉ một người được chủ tàu chọn: có người rồi thì các dòng khác mờ đi, chặng bị khoá cho tới khi bỏ chọn.
// Cột Thao tác chỉ còn nút Bỏ khỏi danh sách. onMenu(action, candidate): 'select' | 'unselect' | 'send' | 'remove'. onOpenFit(candidate): mở bảng đối chiếu.
// onOpenSubmission(candidate): mở bảng trượt Hồ sơ nộp (giấy tờ + biểu mẫu của người đó).
export default function CandidateTable({ candidates, requirements, editable, selected, onSelect, onMenu, onOpenFit, onOpenSubmission }) {
  const heldId = candidates.find((c) => c.status === 'PICKED' && c.owner_selected_at)?.seafarer_id
  const blocked = (c) => heldId != null && c.seafarer_id !== heldId
  const short = (value) => formatDate(value).slice(0, 5)
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
      title: 'Tiến trình',
      key: 'progress',
      render: (_, c) => {
        const { states, dates } = candidateStages(c)
        const live = c.status === 'PICKED'
        const canAct = editable && live
        const lock = blocked(c)
        const steps = [
          {
            key: 'pack', label: 'Ráp', state: states[0], onClick: live || c.export_pack ? () => onOpenSubmission(c) : undefined,
            hint: c.export_pack ? `Mở hồ sơ nộp · ráp ${formatDate(dates[0])}` : 'Mở hồ sơ nộp để điền biểu mẫu',
          },
          {
            key: 'send', label: 'Gửi', state: states[1], onClick: canAct ? () => onMenu('send', c) : undefined, disabled: lock,
            hint: c.last_sent_at ? `Đã gửi ${formatDate(dates[1])}, bấm để gửi lại` : 'Gửi cho chủ tàu',
          },
          {
            key: 'select', label: 'Chủ tàu chọn', state: states[2], onClick: canAct ? () => onMenu(c.owner_selected_at ? 'unselect' : 'select', c) : undefined, disabled: lock,
            hint: c.owner_selected_at ? 'Bỏ nhãn chủ tàu đã chọn' : 'Đánh dấu chủ tàu đã chọn',
          },
        ]
        let note = states.map((state, i) => (dates[i] ? short(dates[i]) : null)).filter(Boolean).join(' · ')
        if (lock) note = 'Đã có người được chọn'
        else if (states[0] === 'next') note = 'Chưa ráp hồ sơ'
        else if (states[1] === 'next') note = [note, 'chưa gửi'].filter(Boolean).join(' · ')
        else if (states[2] === 'next') note = [note, 'chờ chủ tàu'].filter(Boolean).join(' · ')
        return <StageChips steps={steps} note={note} />
      },
    },
    actionColumn((c) => (editable && c.status === 'PICKED' ? (
      <span className="ds-row-actions">
        <Tooltip title="Bỏ khỏi danh sách">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Bỏ khỏi danh sách: ${c.full_name}`} onClick={(e) => { e.stopPropagation(); onMenu('remove', c) }} />
        </Tooltip>
      </span>
    ) : null), { buttons: 1 }),
  ]

  return (
    <Table
      rowKey="seafarer_id"
      className="crew-table"
      dataSource={candidates}
      columns={columns}
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowClassName={(c) => (c.owner_selected_at && c.status === 'PICKED' ? 'op-row--chosen' : blocked(c) ? 'op-row--muted' : '')}
      rowSelection={editable ? {
        selectedRowKeys: selected,
        onChange: onSelect,
        getCheckboxProps: (c) => ({ disabled: c.status !== 'PICKED', 'aria-label': `Chọn ${c.full_name}` }),
      } : undefined}
    />
  )
}
