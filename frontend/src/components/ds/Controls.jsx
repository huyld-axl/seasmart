import { Select } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import './ds.css'

// Các control nhỏ dùng chung (components/small-controls.md, charts.md, loading.md, empty-state.md, list-row.md).

// Tab trạng thái trên bảng, variant `boxed`: đang chọn nền --secondary, mọi tab luôn có viền trong suốt.
// Dưới sm hàng tab thành nút dropdown có nhãn "Trạng thái:" (luật chốt #7, layouts/app.md "Bảng dữ liệu").
export function StatusTabs({ tabs, value, onChange, mobileLabel = 'Trạng thái:' }) {
  return (
    <>
      <div className="ds-tabs-boxed" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          className="ds-tabs-boxed__tab"
          onClick={() => onChange?.(tab.value)}
        >
          {tab.label}
          {tab.count != null ? <span className="ds-tabs-boxed__count">{tab.count}</span> : null}
        </button>
      ))}
      </div>
      <Select
        className="ds-tabs-select"
        prefix={<span className="ds-tabs-select__prefix">{mobileLabel}</span>}
        value={value}
        onChange={onChange}
        popupMatchSelectWidth={false}
        options={tabs.map((tab) => ({ value: tab.value, label: tab.count != null ? `${tab.label} · ${tab.count}` : tab.label }))}
      />
    </>
  )
}

// Chip lọc chính của màn: h-9, viên mờ foreground/5, chọn rồi tô màu nhấn. Bật/tắt nên có aria-pressed.
export function FilterChips({ chips, selected = [], onToggle }) {
  return (
    <div className="ds-chips">
      <div className="ds-chips__row">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          aria-pressed={selected.includes(chip.value)}
          className="ds-chip"
          title={chip.label}
          onClick={() => onToggle?.(chip.value)}
        >
          <span className="ds-chip__label">{chip.label}</span>
        </button>
      ))}
      </div>
    </div>
  )
}

// Thanh tiến độ đứng riêng: rãnh foreground/5, thanh màu nhấn, số ở đầu dòng (charts.md).
export function ProgressBar({ label, done, total }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="ds-progress-block">
      <div className="ds-progress-block__head">
        <p className="ds-progress-block__label">{label}</p>
        <p className="ds-progress-block__value">{done} / {total}</p>
      </div>
      <div className="ds-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={label}>
        <div className="ds-progress__bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

// Tự lưu (loading.md): chỉ chữ xám, không spinner, "Đã lưu" không xanh lá.
export function SaveStatus({ state }) {
  if (state === 'saving') return <span role="status" className="ds-save">Đang lưu…</span>
  if (state === 'failed') {
    return (
      <span role="status" className="ds-save ds-save--failed">
        Chưa lưu được · <button type="button" className="ds-link">Thử lại</button>
      </span>
    )
  }
  return (
    <span role="status" className="ds-save">
      <CheckOutlined aria-hidden /> Đã lưu
    </span>
  )
}

// Trạng thái rỗng và lỗi tải (empty-state.md): câu chữ giữa khối, có hành động thì là link chữ hoặc nút viền.
export function EmptyState({ title, description, action, isError = false }) {
  return (
    <div role={isError ? 'alert' : undefined} className="ds-empty">
      <p className={isError ? 'ds-empty__title ds-empty__title--error' : 'ds-empty__title'}>{title}</p>
      {description ? <p className="ds-empty__text">{description}</p> : null}
      {action ? <div className="ds-empty__action">{action}</div> : null}
    </div>
  )
}

// Dòng danh sách (list-row.md): trái là chữ chính + dòng phụ, phải là giá trị hoặc hành động.
export function ListRow({ leading, title, meta, trailing }) {
  return (
    <li className="ds-row">
      {leading ? <span className="ds-row__leading">{leading}</span> : null}
      <div className="ds-row__body">
        <p className="ds-row__title">{title}</p>
        {meta ? <p className="ds-row__meta">{meta}</p> : null}
      </div>
      {trailing ? <span className="ds-row__trailing">{trailing}</span> : null}
    </li>
  )
}
