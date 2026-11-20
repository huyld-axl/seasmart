import MoneyInput from '../../../components/ds/MoneyInput'
import { DEFAULT_ITEMS } from '../../../constants/voyageContract'
import { formatUsd } from '../../../utils/format'
import './contracts.css'

const NAME_OF = Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.name]))
const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng', unit: 'USD/tháng' },
  { kind: 'ONE_TIME', title: 'Một lần', unit: 'USD' },
]

const sum = (rows, field) => Math.round(rows.reduce((total, row) => total + Number(row[field] || 0), 0) * 100) / 100

function SideHead({ tag, tone, name }) {
  return (
    <span className="ct-side">
      <span className={`ct-tag ct-tag--${tone}`}>{tag}</span>
      <span className="ct-side__name">{name}</span>
    </span>
  )
}

// Bảng khoản tiền hai cột của hợp đồng: trái là khoản, giữa là phải thu (chủ tàu), phải là phải chi (thuyền viên).
// Dùng như control của Form.Item (value là mảng dòng, onChange trả mảng mới) hoặc chỉ đọc (readOnly).
// Khoản cố định (DEFAULT_ITEMS): không thêm, không xoá, chỉ nhập số.
export default function DealTable({ value = [], onChange, ownerName, seafarerName, readOnly = false }) {
  const rows = value
  const update = (index, patch) => onChange?.(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const money = (row, index, field, label) =>
    readOnly ? (
      <span className="ct-ro">{row[field] == null ? <span className="ct-ro__empty">—</span> : formatUsd(row[field], { fixed: true })}</span>
    ) : (
      <MoneyInput value={row[field]} onChange={(v) => update(index, { [field]: v })} aria-label={label} />
    )

  const head = (
    <thead>
      <tr>
        <th scope="col">Khoản</th>
        <th scope="col"><SideHead tag="Phải thu" tone="receivable" name={ownerName} /></th>
        <th scope="col"><SideHead tag="Phải chi" tone="payable" name={seafarerName} /></th>
      </tr>
    </thead>
  )

  // Mỗi nhóm một bảng riêng, tên bảng đặt bên ngoài phía trên.
  return GROUPS.map((group) => {
    const entries = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.kind === group.kind)
    const only = entries.map(({ row }) => row)
    return (
      <section key={group.kind} className="ct-block" aria-label={group.title}>
        <h3 className="ct-block__title">{group.title} <span className="ct-block__unit">{group.unit}</span></h3>
        <div className="ct-table-wrap">
          <table className="ct-table">
            <colgroup><col style={{ width: '24%' }} /><col style={{ width: '38%' }} /><col style={{ width: '38%' }} /></colgroup>
            {head}
            <tbody>
              {entries.map(({ row, index }) => (
                <tr key={row.item_code}>
                  <th scope="row" className="ct-name">{NAME_OF[row.item_code]}</th>
                  <td data-label="Phải thu">{money(row, index, 'receivable_usd', `Phải thu: ${NAME_OF[row.item_code]}`)}</td>
                  <td data-label="Phải chi">{money(row, index, 'payable_usd', `Phải chi: ${NAME_OF[row.item_code]}`)}</td>
                </tr>
              ))}
              <tr className={group.kind === 'MONTHLY' ? 'ct-total' : 'ct-total ct-total--once'}>
                <th scope="row">{group.kind === 'MONTHLY' ? 'Tổng mỗi tháng' : 'Tổng một lần'}</th>
                <td className="ds-num" data-label="Phải thu">{formatUsd(sum(only, 'receivable_usd'), { fixed: true })}</td>
                <td className="ds-num" data-label="Phải chi">{formatUsd(sum(only, 'payable_usd'), { fixed: true })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    )
  })
}
