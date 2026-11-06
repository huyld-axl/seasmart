import { Pagination, Select } from 'antd'
import useViewport from '../../hooks/useViewport'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

// Dòng chân danh sách: bên trái "Hiển thị 1–20 / 57 thuyền viên", bên phải trang và số dòng mỗi trang.
// Điện thoại (< 640px): "1–20 / 57 thuyền viên" + ‹ trang / tổng ›, bỏ ô số dòng mỗi trang.
// onChange(page, pageSize): đổi số dòng thì về trang 1.
export default function ListFooter({ total, page, pageSize, unit, note, onChange }) {
  const { isPhone } = useViewport()
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)
  return (
    <div className="ds-table-foot ds-list-foot">
      <span className="ds-list-foot__info">
        <span className="ds-num">{isPhone ? '' : 'Hiển thị '}{from}–{to} / {total} {unit}</span>
        {note ? <span className="ds-list-foot__note">{note}</span> : null}
      </span>
      <span className="ds-list-foot__nav">
        <Pagination simple={isPhone} current={page} pageSize={pageSize} total={total} showSizeChanger={false} onChange={(next) => onChange(next, pageSize)} />
        {isPhone ? null : (
          <span className="ds-list-foot__size">
            <span>Số dòng/trang</span>
            <Select
              size="small"
              value={pageSize}
              aria-label="Số dòng mỗi trang"
              options={PAGE_SIZE_OPTIONS.map((value) => ({ value, label: value }))}
              onChange={(size) => onChange(1, size)}
              popupMatchSelectWidth={false}
            />
          </span>
        )}
      </span>
    </div>
  )
}
