import { CheckCircleOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { formatDiff, formatUsd } from '../../../utils/format'
import { balanceNotes } from './contractView'
import './contracts.css'

function Row({ label, value, ok, note, bad }) {
  return (
    <div className="ct-card-row">
      <span className="ct-card-row__label">{label}</span>
      <span className="ct-card-row__end">
        <span className="ct-card-row__value">
          {ok ? <CheckCircleOutlined className="ct-ok" aria-label="Đạt" /> : <ExclamationCircleFilled className={`ct-bad ct-bad--${bad}`} aria-label="Cần xem lại" />}
          <b>{value}</b> <span className="ct-fig__unit">USD</span>
        </span>
        <span className="ct-card-row__note">{note}</span>
      </span>
    </div>
  )
}

// Thẻ "Cân đối" ở cột phải màn chi tiết hợp đồng: budget nổi bật và ba số thu, chi, chênh lệch theo tháng.
export default function BalanceCard({ balance, budgetTotal }) {
  const notes = balanceNotes(balance)
  return (
    <section className="crew-panel">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Cân đối</h2></div>
      <div className="crew-panel__body ct-card">
        <div className="ct-budget ct-budget--card">
          <span className="ct-budget__label">Budget dự kiến/tháng</span>
          <span className="ct-budget__value"><b>{formatUsd(balance.budgetMonthly)}</b> <span className="ct-fig__unit">USD</span></span>
          <span className="ct-budget__sub">{formatUsd(budgetTotal)} USD cả chuyến</span>
        </div>
        <Row label="Phải thu/tháng" value={formatUsd(balance.receivableMonthly)} ok={balance.receivableOk} note={notes.receivable} bad="warning" />
        <Row label="Phải chi/tháng" value={formatUsd(balance.payableMonthly)} ok={balance.payableOk} note={notes.payable} bad="error" />
        <Row label="Chênh lệch/tháng" value={formatDiff(balance.diffMonthly)} ok={balance.diffOk} note={`${formatUsd(balance.diffContract)} USD cả hợp đồng`} bad="error" />
      </div>
    </section>
  )
}
