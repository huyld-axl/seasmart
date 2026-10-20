import { Select } from 'antd'
import { DEFAULT_TERMS } from '../../../constants/voyageContract'
import { CLOSING_OPTIONS, HOLIDAY_OPTIONS, parsePayValue, payOptions, payValue, termLabel } from './contractView'
import './contracts.css'

const PAY_OPTIONS = payOptions()

// Bảng kỳ thanh toán, cùng kiểu kẻ ô và đầu cột với DealTable. Control của Form.Item (value { RECEIVABLE, PAYABLE }) hoặc chỉ đọc.
export default function TermsTable({ value, onChange, ownerName, seafarerName, readOnly = false }) {
  const terms = { RECEIVABLE: { ...DEFAULT_TERMS.RECEIVABLE, ...value?.RECEIVABLE }, PAYABLE: { ...DEFAULT_TERMS.PAYABLE, ...value?.PAYABLE } }
  const set = (side, patch) => onChange?.({ ...terms, [side]: { ...terms[side], ...patch } })

  const cell = (side, kind) => {
    const term = terms[side]
    const label = termLabel(term)
    if (readOnly) return <span className="ct-ro">{kind === 'closing' ? label.closing : kind === 'pay' ? label.pay : label.holiday}</span>
    const aria = `${side === 'RECEIVABLE' ? 'Phải thu' : 'Phải chi'}: ${{ closing: 'ngày chốt sổ', pay: 'ngày thanh toán', holiday: 'gặp ngày nghỉ' }[kind]}`
    if (kind === 'closing') return <Select value={term.closing_day} options={CLOSING_OPTIONS} onChange={(v) => set(side, { closing_day: v })} aria-label={aria} />
    if (kind === 'pay') return <Select value={payValue(term)} options={PAY_OPTIONS} onChange={(v) => set(side, parsePayValue(v))} aria-label={aria} />
    return <Select value={term.holiday_rule} options={HOLIDAY_OPTIONS} onChange={(v) => set(side, { holiday_rule: v })} aria-label={aria} />
  }

  return (
    <section className="ct-block" aria-label="Kỳ thanh toán">
      <h3 className="ct-block__title">Kỳ thanh toán <span className="ct-block__unit">chốt sổ, ngày trả tiền</span></h3>
      <div className="ct-table-wrap">
      <table className="ct-table ct-table--terms">
        <colgroup><col style={{ width: '24%' }} /><col style={{ width: '38%' }} /><col style={{ width: '38%' }} /></colgroup>
        <thead>
          <tr>
            <th scope="col">Khoản</th>
            <th scope="col"><span className="ct-side"><span className="ct-tag ct-tag--receivable">Phải thu</span><span className="ct-side__name">{ownerName}</span></span></th>
            <th scope="col"><span className="ct-side"><span className="ct-tag ct-tag--payable">Phải chi</span><span className="ct-side__name">{seafarerName}</span></span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="ct-name">Ngày chốt sổ</th>
            <td>{cell('RECEIVABLE', 'closing')}</td>
            <td>{cell('PAYABLE', 'closing')}</td>
          </tr>
          <tr>
            <th scope="row" className="ct-name">Ngày thanh toán</th>
            <td>{cell('RECEIVABLE', 'pay')}</td>
            <td>{cell('PAYABLE', 'pay')}</td>
          </tr>
          <tr>
            <th scope="row" className="ct-name">Gặp ngày nghỉ<span className="ct-name__hint">Ngày nghỉ, lễ của ngân hàng</span></th>
            <td>{cell('RECEIVABLE', 'holiday')}</td>
            <td>{cell('PAYABLE', 'holiday')}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>
  )
}
