import { CheckCircleOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { DEFAULT_ITEMS, DEFAULT_TERMS } from '../../../constants/voyageContract'
import { formatDiff, formatUsd } from '../../../utils/format'
import { balanceNotes, termLabel } from './contractView'
import './contracts.css'

const NAME_OF = Object.fromEntries(DEFAULT_ITEMS.map((item) => [item.code, item.name]))
const GROUPS = [
  { kind: 'MONTHLY', title: 'Hằng tháng', total: 'Tổng mỗi tháng' },
  { kind: 'ONE_TIME', title: 'Một lần', total: 'Tổng một lần' },
]
const TERM_ROWS = [['Ngày chốt sổ', 'closing'], ['Ngày thanh toán', 'pay'], ['Gặp ngày nghỉ', 'holiday']]
const nameOf = (row) => NAME_OF[row.item_code] || row.item_code
const sum = (rows, field) => Math.round(rows.reduce((total, row) => total + Number(row[field] || 0), 0) * 100) / 100
const money = (v) => formatUsd(v ?? 0, { fixed: true })

// Một nhóm: khung kẻ ô; dòng đầu là tên nhóm (cấp 2, nền xám), các dòng khoản (cấp 3, nền trắng).
// Khung đầu mang luôn hàng Khoản | Phải thu | Phải chi (cấp 1).
const Box = ({ title, unit, head, children }) => (
  <div className="ct-deal ct-deal--sides ct-deal-box">
    <table>
      <Cols />
      {head}
      <tbody>
        <tr className="ct-deal__group"><th colSpan={3} scope="colgroup">{title}{unit ? <span className="ct-block__unit">{unit}</span> : null}</th></tr>
        {children}
      </tbody>
    </table>
  </div>
)
const Cols = () => <colgroup><col className="ct-deal__c-name" /><col className="ct-deal__c-side" /><col className="ct-deal__c-side" /></colgroup>

// Màn xem hợp đồng: ba khung tách nhau (Hằng tháng, Một lần, Kỳ thanh toán), cùng cột cố định
// Khoản | Phải thu | Phải chi để hai bên dóng thẳng. Khoản chưa có tiền hiện 0,00.
export function DealView({ items = [], terms, ownerName, seafarerName }) {
  const label = {
    RECEIVABLE: termLabel({ ...DEFAULT_TERMS.RECEIVABLE, ...terms?.RECEIVABLE }),
    PAYABLE: termLabel({ ...DEFAULT_TERMS.PAYABLE, ...terms?.PAYABLE }),
  }
  const head = (
    <thead>
      <tr>
        <th scope="col">Khoản</th>
        <th scope="col"><span className="ct-tag ct-tag--receivable">Phải thu</span> <span className="ct-deal__who">{ownerName}</span></th>
        <th scope="col"><span className="ct-tag ct-tag--payable">Phải chi</span> <span className="ct-deal__who">{seafarerName}</span></th>
      </tr>
    </thead>
  )
  return (
    <section className="ct-deal-split" aria-label="Thoả thuận">
        {GROUPS.map((group, index) => {
          const rows = items.filter((row) => row.kind === group.kind)
          return (
            <Box key={group.kind} title={group.title} unit={group.kind === 'MONTHLY' ? 'USD/tháng' : 'USD'} head={index === 0 ? head : null}>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{nameOf(row)}</th>
                      <td className="ct-deal__num">{money(row.receivable_usd)}</td>
                      <td className="ct-deal__num">{money(row.payable_usd)}</td>
                    </tr>
                  ))}
                  <tr className="ct-deal__total">
                    <th scope="row">{group.total}</th>
                    <td className="ct-deal__num">{money(sum(rows, 'receivable_usd'))}</td>
                    <td className="ct-deal__num">{money(sum(rows, 'payable_usd'))}</td>
                  </tr>
            </Box>
          )
        })}
        <Box title="Kỳ thanh toán">
              {TERM_ROWS.map(([title, key]) => (
                <tr key={key}><th scope="row">{title}</th><td className="ct-deal__num">{label.RECEIVABLE[key]}</td><td className="ct-deal__num">{label.PAYABLE[key]}</td></tr>
              ))}
        </Box>
    </section>
  )
}

const Mark = ({ ok, bad }) => (ok ? <CheckCircleOutlined className="ct-ok" aria-label="Đạt" /> : <ExclamationCircleFilled className={`ct-bad ct-bad--${bad}`} aria-label="Cần xem lại" />)

// Cân đối: bảng nhỏ ở cột phải, cùng kiểu bảng "Các kỳ" của yêu cầu thanh toán.
export function BalanceTable({ balance, budgetTotal }) {
  if (!balance) return null
  const notes = balanceNotes(balance)
  const rows = [
    ['Budget/tháng', formatUsd(balance.budgetMonthly), null, budgetTotal != null ? `${formatUsd(budgetTotal)} cả chuyến` : null],
    ['Phải thu/tháng', formatUsd(balance.receivableMonthly), <Mark key="m" ok={balance.receivableOk} bad="warning" />, notes.receivable],
    ['Phải chi/tháng', formatUsd(balance.payableMonthly), <Mark key="m" ok={balance.payableOk} bad="error" />, notes.payable],
    ['Chênh lệch/tháng', formatDiff(balance.diffMonthly), <Mark key="m" ok={balance.diffOk} bad="error" />, `${formatUsd(balance.diffContract)} cả hợp đồng`],
  ]
  return (
    <section className="crew-panel crew-panel--table" aria-label="Cân đối">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Cân đối</h2><span className="ct-block__unit">USD</span></div>
      <div className="ct-deal">
        <table>
          <tbody>
            {rows.map(([title, value, mark, note]) => (
              <tr key={title}>
                <th scope="row">{title}{note ? <span className="ct-deal__note">{note}</span> : null}</th>
                <td className="ct-deal__num"><span className="ct-deal__fig">{mark}{value}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
