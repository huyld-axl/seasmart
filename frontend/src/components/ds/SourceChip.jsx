import SparkIcon from './SparkIcon'
import './ds.css'

// Chip cạnh nhãn trường cho biết giá trị đến từ đâu (cùng kiểu chip "Đã sửa"):
// catalog = điền từ danh mục tàu thế giới, smart = Lấy thông tin thông minh, created = loại vừa thêm nhanh.
const SOURCES = { catalog: 'Từ danh mục', smart: 'Thông minh', created: 'Loại mới' }

export default function SourceChip({ source }) {
  if (!SOURCES[source]) return null
  return (
    <span className={`ds-source-chip ds-source-chip--${source}`}>
      {source === 'smart' ? <SparkIcon aria-hidden /> : null}
      {SOURCES[source]}
    </span>
  )
}
