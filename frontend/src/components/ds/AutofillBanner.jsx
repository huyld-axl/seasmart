import { AutofillIcon } from './ScanButton'
import './ds.css'

// Dòng tóm tắt đầu khối sau khi AI điền (components/scan-button.md): nói có bao nhiêu ô vừa điền, kèm nút bỏ đánh dấu.
// Ô được điền còn có nhãn "AI" trong ô, nên không chỉ dựa vào màu.
export default function AutofillBanner({ text, onClear }) {
  return (
    <div className="ds-aibanner" role="status">
      <AutofillIcon size={18} />
      <p className="ds-aibanner__text">{text}</p>
      <button type="button" className="ds-aibanner__clear" onClick={onClear}>Bỏ đánh dấu</button>
    </div>
  )
}
