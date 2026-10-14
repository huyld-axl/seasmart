import { Button, Select } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import './exports.css'

// Chuyển qua lại trong một danh sách (giấy trong bộ, người trong đợt): nút trước/sau và ô chọn thẳng.
// options = [{ value, label }]; name dùng cho nhãn đọc màn hình ("giấy", "người").
export default function PreviewNav({ name, options, value, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const step = (by) => onChange(options[(index + by + options.length) % options.length].value)
  const alone = options.length < 2
  return (
    <span className="pv-nav">
      <Button icon={<LeftOutlined />} aria-label={`${name} trước`} disabled={alone} onClick={() => step(-1)} />
      <Select
        className="pv-nav__pick"
        aria-label={`Chọn ${name} để xem`}
        popupMatchSelectWidth={false}
        value={options[index]?.value}
        onChange={onChange}
        options={options}
        labelRender={({ label }) => <span>{label}<span className="rv-muted"> · {index + 1}/{options.length}</span></span>}
      />
      <Button icon={<RightOutlined />} aria-label={`${name} sau`} disabled={alone} onClick={() => step(1)} />
    </span>
  )
}
