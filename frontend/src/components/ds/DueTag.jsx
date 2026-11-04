import './ds.css'

// Nhãn đếm ngày ở cuối dòng cảnh báo (Tổng quan). Quá hạn: viên đỏ "Quá n ngày". Chưa tới: chữ thường, không màu.
// text: thay chữ mặc định (vd. "2 việc"), vẫn theo late để chọn kiểu.
export default function DueTag({ days, late, text }) {
  const label = text ?? (late ? `Quá ${days} ngày` : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`)
  return <span className={`ds-due${late ? ' ds-due--late' : ''}`}>{label}</span>
}
