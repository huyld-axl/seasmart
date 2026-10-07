import './ds.css'

// Khối nhãn và giá trị của trang chi tiết (components/description-list.md). Đổi khuôn theo bề rộng
// chính khối (container query): hẹp thì nhãn trên giá trị dưới, rộng thì hai cột.
// item: { label, value } — value trống thì hiện "—" màu chữ phụ.
export default function DescriptionList({ items }) {
  return (
    <dl className="ds-dl">
      {items.map((item) => (
        <div key={item.label} className="ds-dl__row">
          <dt className="ds-dl__label">{item.label}</dt>
          <dd className={`ds-dl__value${item.value == null || item.value === '' ? ' ds-dl__value--empty' : ''}`}>
            {item.value == null || item.value === '' ? '—' : item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
