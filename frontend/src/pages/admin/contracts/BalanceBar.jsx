import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import { formatDiff, formatUsd } from '../../../utils/format'
import { balanceNotes } from './contractView'
import './contracts.css'

function Figure({ label, value, ok, note, bad }) {
  return (
    <div className="ct-fig" title={note}>
      <span className="ct-fig__label">{label}</span>
      <span className="ct-fig__value">
        {ok ? <CheckCircleFilled className="ct-ok" aria-label="Đạt" /> : <ExclamationCircleFilled className={`ct-bad ct-bad--${bad}`} aria-label="Cần xem lại" />}
        <b>{value}</b> <span className="ct-fig__unit">USD</span>
      </span>
    </div>
  )
}

// Thanh cân đối dính đáy màn tạo / sửa hợp đồng: budget của vị trí và ba số thu, chi, chênh lệch theo tháng.
// `children` là các nút (Huỷ, Tạo hợp đồng). Cùng khung với thanh lưu của các form khác.
export default function BalanceBar({ balance, budgetTotal, children }) {
  const notes = balanceNotes(balance)
  return (
    <div className="sf-savebar ct-bar">
      <div className="ct-budget" title={`Tổng chuyến ${formatUsd(budgetTotal)} USD`}>
        <span className="ct-budget__label">Budget dự kiến/tháng</span>
        <span className="ct-budget__value"><b>{formatUsd(balance.budgetMonthly)}</b> <span className="ct-fig__unit">USD</span></span>
      </div>
      <div className="ct-figs">
        <Figure label="Phải thu/tháng" value={formatUsd(balance.receivableMonthly)} ok={balance.receivableOk} note={notes.receivable} bad="warning" />
        <Figure label="Phải chi/tháng" value={formatUsd(balance.payableMonthly)} ok={balance.payableOk} note={notes.payable} bad="error" />
        <Figure label="Chênh lệch/tháng" value={formatDiff(balance.diffMonthly)} ok={balance.diffOk} note={notes.diff} bad="error" />
      </div>
      <div className="sf-savebar__actions">{children}</div>
    </div>
  )
}
