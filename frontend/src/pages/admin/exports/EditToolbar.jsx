import { Button, ColorPicker, Select, Tooltip } from 'antd'
import {
  AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined, ClearOutlined, FontColorsOutlined,
  ItalicOutlined, MenuOutlined, RedoOutlined, StrikethroughOutlined, UnderlineOutlined, UndoOutlined,
} from '@ant-design/icons'

// Thanh định dạng kiểu trình soạn thảo của WordPress cho ô đang sửa trên trang giấy.
// active: định dạng tại chỗ con trỏ ({ cell, bold, italic, underline, strike, align, size, color }) hoặc null khi chưa chọn ô.
// onCommand(lệnh, giá trị): FormPreview thực hiện trên ô đang sửa.

const SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28]
const COLORS = ['#000000', '#404040', '#7f7f7f', '#c00000', '#e46c0a', '#00b050', '#0070c0', '#002060', '#7030a0']
const HISTORY = [
  { command: 'undo', label: 'Hoàn tác (Ctrl+Z)', icon: <UndoOutlined /> },
  { command: 'redo', label: 'Làm lại (Ctrl+Y)', icon: <RedoOutlined /> },
]
const MARKS = [
  { command: 'bold', label: 'In đậm (Ctrl+B)', icon: <BoldOutlined /> },
  { command: 'italic', label: 'In nghiêng (Ctrl+I)', icon: <ItalicOutlined /> },
  { command: 'underline', label: 'Gạch chân (Ctrl+U)', icon: <UnderlineOutlined /> },
  { command: 'strike', label: 'Gạch ngang', icon: <StrikethroughOutlined /> },
]
const ALIGN_BUTTONS = [
  { value: 'left', label: 'Căn trái', icon: <AlignLeftOutlined /> },
  { value: 'center', label: 'Căn giữa', icon: <AlignCenterOutlined /> },
  { value: 'right', label: 'Căn phải', icon: <AlignRightOutlined /> },
  { value: 'justify', label: 'Căn đều hai bên', icon: <MenuOutlined /> },
]

// onMouseDown chặn mất tiêu điểm để ô đang gõ giữ nguyên chỗ bôi đen.
const keepFocus = (event) => event.preventDefault()

function ToolButton({ label, icon, on = false, disabled, onClick }) {
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size="small"
        className={on ? 'fp-rt__btn is-on' : 'fp-rt__btn'}
        icon={icon}
        aria-label={label}
        aria-pressed={on}
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={onClick}
      />
    </Tooltip>
  )
}

export default function EditToolbar({ active, onCommand }) {
  const off = !active
  const color = active?.color || '#000000'
  return (
    <div className="fp-rt" role="toolbar" aria-label="Định dạng chữ">
      <span className="fp-rt__group">
        {HISTORY.map(({ command, label, icon }) => (
          <ToolButton key={command} label={label} icon={icon} disabled={off} onClick={() => onCommand(command)} />
        ))}
      </span>
      <span className="fp-rt__sep" />
      <Tooltip title="Cỡ chữ (pt)">
        <Select
          size="small"
          className="fp-rt__size"
          aria-label="Cỡ chữ"
          placeholder="Cỡ chữ"
          disabled={off}
          value={active?.size ?? null}
          options={[...new Set([...SIZES, active?.size].filter(Boolean))].sort((a, b) => a - b).map((pt) => ({ value: pt, label: `${pt} pt` }))}
          onChange={(pt) => onCommand('size', pt)}
          popupMatchSelectWidth={false}
        />
      </Tooltip>
      <span className="fp-rt__sep" />
      <span className="fp-rt__group">
        {MARKS.map(({ command, label, icon }) => (
          <ToolButton key={command} label={label} icon={icon} on={!!active?.[command]} disabled={off} onClick={() => onCommand(command)} />
        ))}
        <ColorPicker
          size="small"
          disabled={off}
          disabledAlpha
          value={color}
          presets={[{ label: 'Màu hay dùng', colors: COLORS }]}
          onChangeComplete={(value) => onCommand('color', value.toHexString())}
        >
          <span>
            <Tooltip title="Màu chữ">
              <Button type="text" size="small" className="fp-rt__btn fp-rt__color" aria-label="Màu chữ" disabled={off} onMouseDown={keepFocus}>
                <FontColorsOutlined />
                <span className="fp-rt__swatch" style={{ background: color }} />
              </Button>
            </Tooltip>
          </span>
        </ColorPicker>
      </span>
      <span className="fp-rt__sep" />
      <span className="fp-rt__group">
        {ALIGN_BUTTONS.map(({ value, label, icon }) => (
          <ToolButton key={value} label={label} icon={icon} on={active?.align === value} disabled={off} onClick={() => onCommand('align', value)} />
        ))}
      </span>
      <span className="fp-rt__sep" />
      <ToolButton label="Xoá định dạng" icon={<ClearOutlined />} disabled={off} onClick={() => onCommand('clear')} />
      <span className="fp-rt__hint">
        {active ? <>Đang sửa ô <strong>{active.cell}</strong>. Chưa bôi đen thì định dạng cả ô.</> : 'Bấm vào một ô trên giấy để sửa'}
      </span>
    </div>
  )
}
