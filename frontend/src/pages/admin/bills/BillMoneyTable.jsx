import { Button, Input } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import MoneyInput from '../../../components/ds/MoneyInput'
import { formatUsd } from '../../../utils/format'
import { round2 } from './billView'
import '../contracts/contracts.css'

const MAX_ADJUSTMENTS = 20
const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng', total: 'Tổng hằng tháng' },
  { kind: 'ONE_TIME', title: 'Một lần', total: 'Tổng một lần' },
  { kind: 'ADJUSTMENT', title: 'Điều chỉnh', unit: 'USD, được âm', total: 'Tổng điều chỉnh' },
]

// Bảng dòng tiền của yêu cầu thanh toán, mỗi nhóm một bảng như bảng khoản của hợp đồng (ct-table, hai cột).
// Chỉ đọc: bỏ nhóm trống. Sửa (`onChange`): khoản hợp đồng chỉ sửa số; dòng điều chỉnh sửa tên, số, xoá; luôn hiện nhóm Điều chỉnh.
// `initial`: dòng lúc mở form, để đánh dấu ô đã sửa.
export default function BillMoneyTable({ value = [], onChange, initial = [], readOnly = false }) {
  const before = new Map(initial.map((item) => [item.id, item]))
  const update = (index, patch) => onChange?.(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index) => onChange?.(value.filter((_, i) => i !== index))
  const add = () => onChange?.([...value, { kind: 'ADJUSTMENT', name: '', amount_usd: null }])
  const adjustments = value.filter((row) => row.kind === 'ADJUSTMENT').length

  return GROUPS.map((group) => {
    const entries = value.map((row, index) => ({ row, index })).filter(({ row }) => row.kind === group.kind)
    if (!entries.length && (readOnly || group.kind !== 'ADJUSTMENT')) return null
    const total = round2(entries.reduce((s, { row }) => s + Number(row.amount_usd || 0), 0))
    return (
      <section key={group.kind} className="ct-block" aria-label={group.title}>
        <h3 className="ct-block__title">{group.title} <span className="ct-block__unit">{group.unit || 'USD'}</span></h3>
        <div className="ct-table-wrap">
          <table className="ct-table ct-table--two">
            <colgroup><col style={{ width: '60%' }} /><col style={{ width: '40%' }} /></colgroup>
            <thead><tr><th scope="col">Khoản</th><th scope="col">Số tiền</th></tr></thead>
            <tbody>
              {entries.map(({ row, index }) => {
                const old = row.id ? before.get(row.id) : null
                const changedAmount = !readOnly && (!old || round2(old.amount_usd ?? 0) !== round2(row.amount_usd ?? 0))
                const changedName = !readOnly && row.kind === 'ADJUSTMENT' && (!old || (old.name || '') !== (row.name || ''))
                return (
                  <tr key={row.id || `new-${index}`}>
                    <th scope="row" className={`ct-name${changedName ? ' sf-changed' : ''}`}>
                      {row.kind === 'ADJUSTMENT' && !readOnly ? (
                        <span className="ct-name__edit">
                          <Input value={row.name} maxLength={100} placeholder="Tên dòng điều chỉnh" aria-label="Tên dòng điều chỉnh" onChange={(event) => update(index, { name: event.target.value })} />
                        </span>
                      ) : (
                        <>{row.name}{changedAmount && old ? <span className="sf-chip">Đã sửa</span> : null}</>
                      )}
                    </th>
                    <td className={changedAmount ? 'sf-changed' : undefined}>
                      {readOnly ? (
                        <span className="ct-ro">{formatUsd(row.amount_usd, { fixed: true })}</span>
                      ) : (
                        <span className="bl-amount">
                          <MoneyInput value={row.amount_usd} allowNegative={row.kind === 'ADJUSTMENT'} onChange={(v) => update(index, { amount_usd: v })} aria-label={`Số tiền: ${row.name || 'dòng điều chỉnh'}`} />
                          {row.kind === 'ADJUSTMENT' ? <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Xoá dòng ${row.name || 'điều chỉnh'}`} onClick={() => remove(index)} /> : null}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!readOnly && group.kind === 'ADJUSTMENT' ? (
                <tr className="ct-add">
                  <td colSpan={2}>
                    <Button type="link" icon={<PlusOutlined />} disabled={adjustments >= MAX_ADJUSTMENTS} onClick={add}>Thêm dòng điều chỉnh</Button>
                  </td>
                </tr>
              ) : null}
              <tr className="ct-total">
                <th scope="row">{group.total}</th>
                <td className="ds-num">{formatUsd(total, { fixed: true })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    )
  })
}
