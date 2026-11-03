import './ds.css'

// Bảng bản ghi cùng kiểu bảng Giấy tờ (ds-ctable): rộng thì bảng, hẹp thì thẻ.
// columns: [{ key, title, render(row), mono?, right?, card?: 'title' | 'note' | 'end' | false }]
//   card 'title' = dòng chữ đậm đầu thẻ, 'end' = cạnh tiêu đề bên phải, 'note' (mặc định) = dòng chú nhỏ "tiêu đề giá trị"; false = ẩn ở thẻ.
// Không có dòng thì không vẽ bảng, chỉ hiện `empty` (thường là EmptyState): tiêu đề cột không đứng một mình.
export default function RecordTable({ rows = [], columns = [], rowKey = (row) => row.id, empty = null }) {
  if (!rows.length) return empty
  const cardCols = (kind) => columns.filter((c) => c.card === kind)
  const notes = columns.filter((c) => c.card === undefined && !c.right)
  const actions = columns.filter((c) => c.right)
  return (
    <div className="ds-ctable">
      <table className="ds-ctable__table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.right ? 'ds-ctable__r' : undefined}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.right ? 'ds-ctable__r' : c.mono ? 'ds-ctable__mono' : undefined}>{c.right ? <span className="ds-ctable__src">{c.render(row)}</span> : c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="ds-ccards">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div className="ds-ccards__top">
              <b>{cardCols('title').map((c) => c.render(row))}</b>
              {cardCols('end').map((c) => <span key={c.key}>{c.render(row)}</span>)}
            </div>
            {notes.map((c) => <span key={c.key} className="ds-ctable__note">{c.title}: {c.render(row)}</span>)}
            {actions.length ? <span className="ds-ctable__src">{actions.map((c) => <span key={c.key}>{c.render(row)}</span>)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
