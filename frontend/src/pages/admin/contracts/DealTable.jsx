import { Button, Input } from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import MoneyInput from '../../../components/ds/MoneyInput'
import { DEFAULT_ITEMS } from '../../../constants/voyageContract'
import { formatUsd } from '../../../utils/format'
import './contracts.css'

const MAX_ITEMS = 40
const NAME_OF = Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.name]))
const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng', unit: 'USD/tháng', addLabel: 'Thêm khoản hằng tháng' },
  { kind: 'ONE_TIME', title: 'Một lần', unit: 'USD', addLabel: 'Thêm khoản một lần' },
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
export default function DealTable({ value = [], onChange, ownerName, seafarerName, readOnly = false }) {
  const rows = value
  const update = (index, patch) => onChange?.(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const add = (kind) => onChange?.([...rows, { kind, item_code: null, custom_name: '', receivable_usd: null, payable_usd: null }])
  const remove = (index) => onChange?.(rows.filter((_, i) => i !== index))

  const money = (row, index, field, label) =>
    readOnly ? (
      <span className="ct-ro">{row[field] == null ? <span className="ct-ro__empty">—</span> : formatUsd(row[field], { fixed: true })}</span>
    ) : (
      <MoneyInput value={row[field]} onChange={(v) => update(index, { [field]: v })} aria-label={label} />
    )

  return (
    <div className="ct-table-wrap">
      <table className="ct-table">
        <colgroup><col style={{ width: '24%' }} /><col style={{ width: '38%' }} /><col style={{ width: '38%' }} /></colgroup>
        <thead>
          <tr>
            <th scope="col">Khoản</th>
            <th scope="col"><SideHead tag="Phải thu" tone="receivable" name={ownerName} /></th>
            <th scope="col"><SideHead tag="Phải chi" tone="payable" name={seafarerName} /></th>
          </tr>
        </thead>
        {GROUPS.map((group) => {
          const entries = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.kind === group.kind)
          const only = entries.map(({ row }) => row)
          return (
            <tbody key={group.kind}>
              <tr className="ct-group"><th colSpan={3} scope="colgroup">{group.title} <span className="ct-group__unit">{group.unit}</span></th></tr>
              {entries.map(({ row, index }) => {
                const custom = !row.item_code
                return (
                  <tr key={`${group.kind}-${index}`}>
                    <th scope="row" className="ct-name">
                      {custom && !readOnly ? (
                        <span className="ct-name__edit">
                          <Input value={row.custom_name} maxLength={100} placeholder="Tên khoản" aria-label="Tên khoản" onChange={(event) => update(index, { custom_name: event.target.value })} />
                          <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Xoá khoản ${row.custom_name || ''}`} onClick={() => remove(index)} />
                        </span>
                      ) : (
                        custom ? row.custom_name : NAME_OF[row.item_code]
                      )}
                    </th>
                    <td>{money(row, index, 'receivable_usd', `Phải thu: ${custom ? row.custom_name || 'khoản tự đặt tên' : NAME_OF[row.item_code]}`)}</td>
                    <td>{money(row, index, 'payable_usd', `Phải chi: ${custom ? row.custom_name || 'khoản tự đặt tên' : NAME_OF[row.item_code]}`)}</td>
                  </tr>
                )
              })}
              {readOnly ? null : (
                <tr className="ct-add">
                  <td colSpan={3}>
                    <Button type="link" icon={<PlusOutlined />} disabled={rows.length >= MAX_ITEMS} onClick={() => add(group.kind)}>{group.addLabel}</Button>
                  </td>
                </tr>
              )}
              <tr className={group.kind === 'MONTHLY' ? 'ct-total' : 'ct-total ct-total--once'}>
                <th scope="row">{group.kind === 'MONTHLY' ? 'Tổng mỗi tháng' : 'Tổng một lần'}</th>
                <td className="ds-num">{formatUsd(sum(only, 'receivable_usd'), { fixed: true })}</td>
                <td className="ds-num">{formatUsd(sum(only, 'payable_usd'), { fixed: true })}</td>
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
