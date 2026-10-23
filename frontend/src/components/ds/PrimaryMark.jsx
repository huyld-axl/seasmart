import { StarFilled, StarOutlined } from '@ant-design/icons'
import './ds.css'

// Chọn MỘT mục chính trong một danh sách nhiều dòng (liên hệ chính của đối tác). Mỗi dòng một nút sao: sao đặc là mục chính.
// Chọn một dòng thì dòng đang chính tự bỏ, trang tự giữ đúng một mục chính. Dùng làm control của Form.Item (value, onChange).
export default function PrimaryMark({ value, onChange, label = 'Liên hệ chính' }) {
  return (
    <button
      type="button"
      className={value ? 'ds-primary-mark is-primary' : 'ds-primary-mark'}
      aria-pressed={!!value}
      title={value ? label : `Đặt làm ${label.toLowerCase()}`}
      onClick={() => !value && onChange?.(true)}
    >
      {value ? <StarFilled aria-hidden /> : <StarOutlined aria-hidden />}
      <span>{value ? label : 'Đặt làm chính'}</span>
    </button>
  )
}
