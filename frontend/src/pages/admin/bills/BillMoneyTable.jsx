import MoneyInput from '../../../components/ds/MoneyInput'
import { formatUsd } from '../../../utils/format'
import { round2 } from './billView'
import '../contracts/contracts.css'

const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng', total: 'Tổng hằng tháng' },
  { kind: 'ONE_TIME', title: 'Một lần', total: 'Tổng một lần' },
]

// Bảng dòng tiền của yêu cầu thanh toán, mỗi nhóm một bảng như bảng khoản của hợp đồng (ct-table, hai cột).
// Đủ 14 khoản cố định, luôn hiện cả hai nhóm; chỉ sửa số (≥ 0), không thêm / xoá dòng.
// `initial`: dòng lúc mở form, để đánh dấu ô đã sửa.
export default function BillMoneyTable({ value = [], onChange, initial = [], readOnly = false }) {
  const before = new Map(initial.map((item) => [item.item_code, item]))
  const update = (index, patch) => onChange?.(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return GROUPS.map((group) => {
    const entries = value.map((row, index) => ({ row, index })).filter(({ row }) => row.kind === group.kind)
    const total = round2(entries.reduce((s, { row }) => s + Number(row.amount_usd || 0), 0))
    return (
      <section key={group.kind} className="ct-block" aria-label={group.title}>
        <h3 className="ct-block__title">{group.title} <span className="ct-block__unit">USD</span></h3>
        <div className="ct-table-wrap">
          <table className="ct-table ct-table--two">
            <colgroup><col style={{ width: '60%' }} /><col style={{ width: '40%' }} /></colgroup>
            <thead><tr><th scope="col">Khoản</th><th scope="col">Số tiền</th></tr></thead>
            <tbody>
              {entries.map(({ row, index }) => {
                const old = before.get(row.item_code)
                const changed = !readOnly && old && round2(old.amount_usd ?? 0) !== round2(row.amount_usd ?? 0)
                return (
                  <tr key={row.item_code}>
                    <th scope="row" className="ct-name">{row.name}{changed ? <span className="sf-chip">Đã sửa</span> : null}</th>
                    <td className={changed ? 'sf-changed' : undefined}>
                      {readOnly ? (
                        <span className="ct-ro">{formatUsd(row.amount_usd, { fixed: true })}</span>
                      ) : (
                        <span className="bl-amount">
                          <MoneyInput value={row.amount_usd} onChange={(v) => update(index, { amount_usd: v })} aria-label={`Số tiền: ${row.name}`} />
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
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
