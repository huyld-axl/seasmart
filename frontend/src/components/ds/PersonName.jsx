import './PersonName.css'

// Giữ tên đầy đủ trong tooltip, giới hạn chiều rộng ở các trang liên quan.
export default function PersonName({ children }) {
  return <span className="ds-person-name" title={children}>{children}</span>
}
