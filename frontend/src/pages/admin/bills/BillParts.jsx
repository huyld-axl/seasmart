import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import StatusBadge from '../../../components/ds/StatusBadge'
import { formatUsd } from '../../../utils/format'
import { round2 } from './billView'
import '../contracts/contracts.css'
import './bills.css'

const KIND = { MONTHLY: 'Hằng tháng', ONE_TIME: 'Một lần', ADJUSTMENT: 'Điều chỉnh' }
const ORDER = ['MONTHLY', 'ONE_TIME', 'ADJUSTMENT']
const short = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

// Khoản tiền của yêu cầu thanh toán, chỉ đọc: một bảng, cột Loại, tổng ở chân bảng.
export function BillMoneyView({ items = [], ownerName }) {
  const rows = [...items].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  const total = round2(rows.reduce((s, row) => s + Number(row.amount_usd || 0), 0))
  return (
    <section className="crew-panel crew-panel--table" aria-label="Khoản tiền">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Khoản tiền</h2><span className="ct-block__unit">USD</span></div>
      <div className="ct-deal">
        <table>
          <thead><tr><th scope="col">Khoản</th><th scope="col">Loại</th><th scope="col" className="ct-deal__num">Số tiền</th></tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i}><th scope="row">{row.name}</th><td>{KIND[row.kind]}</td><td className="ct-deal__num">{formatUsd(row.amount_usd, { fixed: true })}</td></tr>
            ))}
            <tr className="ct-deal__total"><th scope="row" colSpan={2}>Tổng yêu cầu{ownerName ? ` · ${ownerName}` : ''}</th><td className="ct-deal__num">{formatUsd(total, { fixed: true })}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Các kỳ của hợp đồng (thay lịch tháng): mặc định hiện kỳ đang xem và hai kỳ trước, một kỳ sau; bấm "Hiện cả" để xem hết.
export function BillPeriods({ periods = [], currentId }) {
  const [all, setAll] = useState(false)
  const navigate = useNavigate()
  const at = Math.max(0, periods.findIndex((p) => p.id === currentId))
  const from = Math.max(0, at - 2)
  const shown = all ? periods : periods.slice(from, at + 2)
  return (
    <section className="crew-panel crew-panel--table" aria-label="Các kỳ của hợp đồng">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Các kỳ của hợp đồng</h2><span className="ct-block__unit">{periods.length} kỳ</span></div>
      <div className="ct-deal bl-periods">
        <table>
          <thead><tr><th scope="col">Kỳ</th><th scope="col">Từ – đến</th><th scope="col" className="ct-deal__num">USD</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.id === currentId ? 'bl-periods__cur' : undefined} aria-current={p.id === currentId ? 'true' : undefined} onClick={p.id === currentId ? undefined : () => navigate(`/bills/${p.id}`)}>
                <th scope="row">{p.id === currentId ? p.seq : <Link to={`/bills/${p.id}`} aria-label={`Mở kỳ ${p.seq}`}>{p.seq}</Link>}</th>
                <td className="ds-num">{short(p.period_start)} – {short(p.period_end)}</td>
                <td className="ct-deal__num">{formatUsd(p.total_usd)}</td>
                <td><StatusBadge group="bill" value={p.display_status} /></td>
              </tr>
            ))}
            {periods.length > shown.length || all ? (
              <tr className="ct-deal__empty"><td colSpan={4}><Button type="link" size="small" onClick={() => setAll(!all)}>{all ? 'Thu gọn' : `Hiện cả ${periods.length} kỳ`}</Button></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
