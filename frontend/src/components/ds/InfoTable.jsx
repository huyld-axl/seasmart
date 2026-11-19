import { Tag } from 'antd'
import './ds.css'

const filled = (v) => v !== undefined && v !== null && v !== ''
const Empty = () => <span className="ds-info__empty">Chưa có</span>
const show = (v) => (filled(v) ? v : <Empty />)

// Gom trường thành dòng bảng: hai cặp nhãn | giá trị mỗi dòng; trường rộng (span ≥ 8) hoặc trường lẻ cuối thì trải cả dòng.
// { sub } chèn một dòng tiêu đề nhóm.
function toRows(fields, pairs) {
  const rows = []
  let pending = null
  const flush = () => { if (pending) rows.push({ cells: [pending] }); pending = null }
  for (const field of fields) {
    if (field.sub) { flush(); rows.push({ sub: field.sub }); continue }
    if (pairs === 1 || (field[2] || 0) >= 8) { flush(); rows.push({ cells: [field] }); continue }
    if (pending) { rows.push({ cells: [pending, field] }); pending = null } else pending = field
  }
  flush()
  return rows
}

// Bảng nhãn | giá trị gọn cho màn chi tiết (thay lưới 12 cột). Điện thoại: mỗi dòng một cặp.
// fields: [nhãn, giá trị, độ rộng 12 cột] hoặc { sub: 'Tên nhóm' }. pairs={1} cho khối hẹp (nửa cột).
export default function InfoTable({ fields, pairs = 2 }) {
  const span = pairs === 1 ? 1 : 3
  return (
    <table className={pairs === 1 ? 'ds-info ds-info--single' : 'ds-info'}>
      <colgroup><col className="ds-info__lc" /><col />{pairs === 2 && <><col className="ds-info__lc" /><col /></>}</colgroup>
      <tbody>
        {toRows(fields, pairs).map((row, i) => (row.sub ? (
          <tr key={`sub-${row.sub}`} className="ds-info__sub"><th colSpan={pairs * 2} scope="colgroup">{row.sub}</th></tr>
        ) : (
          <tr key={row.cells.map((c) => c[0]).join('|') || i}>
            {row.cells.map(([label, value], j) => [
              <th key={`l${j}`} scope="row">{label}</th>,
              <td key={`v${j}`} colSpan={row.cells.length === 1 && span > 1 ? span : undefined}>{show(value)}</td>,
            ])}
          </tr>
        )))}
      </tbody>
    </table>
  )
}

// Danh sách bản ghi lặp (tài khoản, người thân, người liên hệ): mỗi bản ghi một dòng, cột là nhãn trường.
// Cột trống ở mọi dòng thì bỏ. Điện thoại: mỗi bản ghi thành một InfoTable có tiêu đề.
// actions (nút liên hệ nhanh) chỉ hiện ở thẻ điện thoại; trên bảng mỗi ô liên hệ đã có nút riêng.
// items: [{ title, tags?, actions?, fields }]
export function InfoList({ items }) {
  const labels = []
  for (const item of items) for (const [label] of item.fields) if (!labels.includes(label)) labels.push(label)
  const columns = labels.filter((label) => items.some((item) => filled(item.fields.find((f) => f[0] === label)?.[1])))
  const hasExtra = items.some((item) => item.tags?.length)
  const tags = (item) => item.tags?.map((tag) => <Tag key={tag} color={tag === 'Bảo lãnh' ? 'orange' : 'blue'}>{tag}</Tag>)
  return (
    <>
      <div className="ds-info-list">
        <table>
          <thead><tr>{columns.map((label) => <th key={label} scope="col">{label}</th>)}{hasExtra && <th aria-label="Ghi chú" />}</tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i}>
                {columns.map((label) => <td key={label}>{show(item.fields.find((f) => f[0] === label)?.[1])}</td>)}
                {hasExtra && <td className="ds-info-list__extra">{tags(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ds-info-cards">
        {items.map((item, i) => (
          <div key={item.id || i} className="ds-info-card">
            <div className="ds-info-card__head"><b>{item.title}</b>{tags(item)}{item.actions}</div>
            <InfoTable fields={item.fields} />
          </div>
        ))}
      </div>
    </>
  )
}
