import { Button } from 'antd'
import BottomSheet from './BottomSheet'
import useViewport from '../../hooks/useViewport'
import './ds.css'

// Bộ lọc nâng cao của trang danh sách. Desktop: hàng lọc mở ngay dưới thanh công cụ (như cũ). Điện thoại (< 640px):
// sheet "Bộ lọc" từ đáy, các ô xếp dọc, chân có "Xoá lọc" và "Xem {n} {đơn vị}" (đóng sheet; điều kiện áp ngay khi đổi
// như ở desktop nên số luôn đúng). children: các ô `crew-filterbar__field`. count: số điều kiện đang bật.
export default function ListFilters({ open, onClose, count = 0, onClear, total, unit, loading, id = 'crew-filter-bar', children }) {
  const { isPhone } = useViewport()
  if (isPhone) {
    return (
      <BottomSheet
        open={open}
        title="Bộ lọc"
        onClose={onClose}
        footer={
          <>
            <Button disabled={!count} onClick={onClear}>Xoá lọc</Button>
            <Button type="primary" onClick={onClose}>{loading || total == null ? 'Xem kết quả' : `Xem ${total} ${unit}`}</Button>
          </>
        }
      >
        <div className="ds-filter-sheet" id={id}>{children}</div>
      </BottomSheet>
    )
  }
  if (!open) return null
  return (
    <div className="crew-filterbar" id={id}>
      {children}
      <Button className="crew-filterbar__clear" disabled={!count} onClick={onClear}>Xoá bộ lọc</Button>
    </div>
  )
}
