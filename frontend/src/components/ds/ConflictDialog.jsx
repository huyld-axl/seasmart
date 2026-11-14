import { useState } from 'react'
import { Button, Modal } from 'antd'
import { SegmentedPick } from '../../pages/admin/fleet/FleetParts'
import { conflictTitle, keptValues } from './conflictMerge'

// Hộp xung đột dùng chung cho mọi form sửa (wireframe docs/design/wireframes/desktop-gd3.html màn 4).
// rows: từ conflictRows(); labels: tên ô; format(key, value): chữ hiện cho một giá trị.
const show = (format, key, value) => {
  const text = format ? format(key, value) : value
  return text === null || text === undefined || text === '' ? '(trống)' : String(text)
}

export function ConflictBody({ by, rows, labels = {}, format, choices, onChoose }) {
  const who = by || 'người khác'
  return (
    <div className="ds-conflict">
      <p>Phần bạn đang nhập chưa được lưu và vẫn còn trong form. {rows.length ? 'Những ô đã đổi:' : `${who} không đổi ô nào bạn đang thấy.`}</p>
      {rows.length ? (
        <table className="ds-conflict__table">
          <thead>
            <tr><th>Ô</th><th>Của {who}</th><th>Của bạn</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{labels[row.key] || row.key}</td>
                <td>{row.kind === 'mine' ? <span className="ds-conflict__same">(không đổi)</span> : show(format, row.key, row.theirs)}</td>
                <td>
                  {row.kind === 'theirs' ? <span className="ds-conflict__same">(không đổi)</span> : show(format, row.key, row.mine)}
                  {row.kind === 'both' ? (
                    <SegmentedPick size="small" label={`Giữ giá trị nào cho ${labels[row.key] || row.key}`} value={choices?.[row.key] || 'mine'} onChange={(v) => onChoose?.(row.key, v)}
                      options={[{ value: 'theirs', label: `Của ${who}` }, { value: 'mine', label: 'Của tôi' }]} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

// Mỗi lần mở dùng `key` mới (useEditConflict) để lựa chọn cũ không sót lại.
// onKeep(values): lấy bản mới, đặt lại các ô giữ phần của mình (values); onDiscard: lấy bản mới, bỏ phần của mình.
export default function ConflictDialog({ open, by, at, rows = [], labels, format, onKeep, onDiscard, onClose }) {
  const [choices, setChoices] = useState({})
  return (
    <Modal
      open={open}
      title={conflictTitle(by, at)}
      onCancel={onClose}
      width={640}
      footer={
        <div className="dsp-modal__footer">
          <Button color="default" variant="filled" onClick={onDiscard}>Huỷ phần của tôi</Button>
          <Button type="primary" onClick={() => onKeep(keptValues(rows, choices))}>Lấy bản mới, giữ phần tôi đã đổi</Button>
        </div>
      }
    >
      <ConflictBody by={by} rows={rows} labels={labels} format={format} choices={choices} onChoose={(key, v) => setChoices((c) => ({ ...c, [key]: v }))} />
    </Modal>
  )
}
