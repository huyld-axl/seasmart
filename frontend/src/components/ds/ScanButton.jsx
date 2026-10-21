import { useRef } from 'react'
import { Button } from 'antd'
import { CheckOutlined, LoadingOutlined } from '@ant-design/icons'
import './ds.css'

// Biểu tượng riêng: "Tự điền" là tờ giấy có tia sáng, "Quét" là khung quét. Khác nhau để không nhầm
// giữa quét một giấy và thả nhiều giấy.
const AUTO_PATH = [
  'M11.5 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H13l5 5v3',
  'M13 3v4a1 1 0 0 0 1 1h4',
  'M8.5 12H12',
  'M8.5 16h2',
]
const SCAN_PATH = ['M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2', 'M4 12h16']

export function AutofillIcon({ size = 16 }) {
  return (
    <svg className="ds-scan-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {AUTO_PATH.map((d) => <path key={d} d={d} />)}
      <path d="M17 13c.3 2.2 1.8 3.7 4 4-2.2.3-3.7 1.8-4 4-.3-2.2-1.8-3.7-4-4 2.2-.3 3.7-1.8 4-4z" fill="currentColor" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg className="ds-scan-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SCAN_PATH.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

// Nút chọn tệp để AI đọc và điền form (components/scan-button.md).
// variant "auto": nút chính duy nhất của màn, nhận nhiều tệp, AI tự nhận loại. variant "scan": nút nhỏ cho đúng một loại giấy.
// loading: đang đọc, nút khoá. doneText: có chữ thì hiện chip xanh thay nút (màn tự tắt sau vài giây).
export default function ScanButton({ label, variant = 'scan', loading = false, disabled = false, doneText, onPick, accept = '.pdf,.jpg,.jpeg,.png' }) {
  const input = useRef(null)
  const auto = variant === 'auto'
  if (doneText) {
    return (
      <span className="ds-scan-done" role="status">
        <CheckOutlined aria-hidden />
        {doneText}
      </span>
    )
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={auto}
        className="ds-sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          e.target.value = ''
          if (files.length) onPick?.(files)
        }}
      />
      <Button
        type={auto ? 'primary' : 'default'}
        size={auto ? 'middle' : 'small'}
        className={auto ? 'ds-scan ds-scan--auto' : 'ds-scan'}
        icon={loading ? <LoadingOutlined spin /> : auto ? <AutofillIcon size={20} /> : <ScanIcon />}
        disabled={disabled || loading}
        onClick={() => input.current?.click()}
      >
        {loading ? 'Đang đọc…' : label}
      </Button>
    </>
  )
}
