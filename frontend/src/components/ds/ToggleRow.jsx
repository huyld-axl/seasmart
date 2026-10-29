import { Switch } from 'antd'
import './ds.css'

// Công tắc bật / tắt MỘT thuộc tính có / không (nồi hơi, lạnh, người thân là liên lạc...). Kiểu duy nhất của MCAH.
// Dùng làm control của Form.Item (value, onChange). Chọn một trong nhiều giá trị thì dùng nhóm nút (ChoiceGroup), không dùng cái này.
// `compact`: bỏ chữ Có / Không cạnh công tắc và hạ chiều cao, cho cột lọc hẹp.
// `changed`: đã sửa, chưa lưu (viền màu nhấn + chip "Đã sửa"), dùng ở màn có thanh lưu như Vai trò và quyền trên điện thoại.
export default function ToggleRow({ label, hint, value, onChange, disabled, changed, compact }) {
  const className = ['ds-toggle-row', changed && 'is-changed', compact && 'ds-toggle-row--compact'].filter(Boolean).join(' ')
  return (
    <div className={className}>
      <span className="ds-toggle-row__text">
        <span>
          {label}
          {changed ? <span className="ds-toggle-row__chip">Đã sửa</span> : null}
        </span>
        {hint ? <span className="ds-toggle-row__hint">{hint}</span> : null}
      </span>
      <span className="ds-toggle-row__end">
        {compact ? null : <span className="ds-toggle-row__state" aria-hidden="true">{value ? 'Có' : 'Không'}</span>}
        <Switch checked={!!value} onChange={onChange} disabled={disabled} aria-label={label} />
      </span>
    </div>
  )
}
