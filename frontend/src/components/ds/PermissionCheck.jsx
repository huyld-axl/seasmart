import './ds.css'

// Ô tích quyền trong lưới nhiều cột (ma trận vai trò). Kiểu duy nhất của MCAH cho việc này; một thuộc tính có / không
// ngoài lưới thì dùng ToggleRow. `checked`: true | false | 'mixed' (có một phần). `changed`: đã sửa, chưa lưu.
export default function PermissionCheck({ checked = false, disabled, changed, label, title, onChange }) {
  const state = checked === 'mixed' ? 'mixed' : checked ? 'true' : 'false'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={changed ? 'pc is-changed' : 'pc'}
      onClick={() => onChange?.(state === 'true' ? false : true)}
    >
      <span className="pc__box" aria-hidden="true">
        {state === 'true' && (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
        {state === 'mixed' && (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12" /></svg>
        )}
      </span>
    </button>
  )
}
