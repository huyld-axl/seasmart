// Dấu của MCAH: chữ M dựng từ hai thanh và một khối treo giữa (hướng 1, chọn ngày 2026-10-06).
// Một màu currentColor, viewBox 24, vẽ trong vùng 4–20. Có logo thật thì thay path ở đây và ở public/favicon.svg.
export default function ProductMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="4" y="4.5" width="3.5" height="15" rx="1" />
      <rect x="16.5" y="4.5" width="3.5" height="15" rx="1" />
      <path d="M8.75 4.5h6.5L12 13.5z" />
    </svg>
  )
}
