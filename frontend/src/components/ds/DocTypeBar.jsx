import { Select } from 'antd'
import { BookOutlined, FileOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import './ds.css'

// Đầu khung bên phải ở màn duyệt từng giấy (T2): loại giấy AI nhận ra và nút "Đổi loại".
// Đổi loại nghĩa là AI đọc lại giấy đó (khoảng 30 giây), nên chỉ phát onChangeType, việc đọc lại do màn nối.
// kind: book | certificate | other
const KINDS = {
  book: { label: 'Sổ thuyền viên', icon: <BookOutlined aria-hidden /> },
  certificate: { label: 'Chứng chỉ', icon: <SafetyCertificateOutlined aria-hidden /> },
  other: { label: 'Khác', icon: <FileOutlined aria-hidden /> },
}

export default function DocTypeBar({ kind = 'book', subtitle, disabled = false, onChangeType }) {
  const current = KINDS[kind] || KINDS.other
  return (
    <header className="ds-typebar">
      <span className={`ds-typebar__kind ds-typebar__kind--${kind}`}>{current.icon}{current.label}</span>
      <Select
        className="ds-typebar__change"
        variant="borderless"
        size="small"
        value={null}
        placeholder="Đổi loại"
        disabled={disabled}
        popupMatchSelectWidth={false}
        options={Object.entries(KINDS).map(([value, item]) => ({ value, label: item.label, disabled: value === kind }))}
        onChange={onChangeType}
        aria-label="Đổi loại giấy: AI đọc lại giấy này, khoảng 30 giây"
      />
      {subtitle ? <span className="ds-typebar__sub">{subtitle}</span> : null}
    </header>
  )
}
