import { useState } from 'react'
import { DatePicker, Form } from 'antd'
import { CalendarOutlined, CloseCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import useViewport from '../../hooks/useViewport'
import './ds.css'

// Ô ngày (kế hoạch responsive mục 4.3). Desktop: DatePicker / RangePicker của antd như cũ. Điện thoại (< 640px): bảng
// chọn ngày của máy — một <input type="date"> trong suốt phủ lên ô hiện ngày theo `format` — vì bảng lịch của antd rộng
// hơn màn (khoảng ngày 744px) và kéo giãn cả trang. Giá trị vào ra là dayjs như DatePicker, dùng thẳng trong Form.Item.
// Ở điện thoại `disabledDate` chỉ kiểm sau khi chọn (bảng của máy không tô xám từng ngày); `minDate` / `maxDate` thì chặn ngay.
const NATIVE = {
  date: { type: 'date', iso: 'YYYY-MM-DD', show: 'DD/MM/YYYY' },
  month: { type: 'month', iso: 'YYYY-MM', show: 'MM/YYYY' },
}

const BLOCKED = 'Ngày này không chọn được'

export default function DateField(props) {
  const { isPhone } = useViewport()
  if (!isPhone || !NATIVE[props.picker || 'date'] || props.showTime) return <DatePicker {...props} />
  return <NativeDate {...props} />
}

export function DateRangeField(props) {
  const { isPhone } = useViewport()
  if (!isPhone || props.showTime) return <DatePicker.RangePicker {...props} />
  return <NativeRange {...props} />
}

const showFormat = (format, kind) => (typeof format === 'string' ? format : NATIVE[kind].show)
const isoOf = (value, kind) => (value ? dayjs(value).format(NATIVE[kind].iso) : '')

function NativeDate({ id, value, onChange, onBlur, picker = 'date', format, placeholder, disabled, allowClear = true, minDate, maxDate, disabledDate, status, className = '', style, 'aria-label': ariaLabel }) {
  const [error, setError] = useState(null)
  // Trong Form.Item: lấy trạng thái lỗi của ô (thiếu trường bắt buộc…) để viền đỏ như ô của antd.
  const itemStatus = Form.Item.useStatus().status
  const invalid = status === 'error' || itemStatus === 'error' || !!error
  const shown = showFormat(format, picker)
  const pick = (event) => {
    const raw = event.target.value
    if (!raw) {
      setError(null)
      onChange?.(null, '')
      return
    }
    const next = dayjs(raw)
    if (disabledDate?.(next, { type: picker })) {
      setError(BLOCKED)
      return
    }
    setError(null)
    onChange?.(next, next.format(shown))
  }
  const classes = ['ds-date', invalid ? 'ds-date--error' : '', disabled ? 'ds-date--disabled' : '', className].filter(Boolean).join(' ')
  return (
    <span className="ds-date-wrap" style={style}>
      <span className={classes}>
        <span className={value ? 'ds-date__text' : 'ds-date__text ds-date__text--empty'}>{value ? dayjs(value).format(shown) : placeholder || shown}</span>
        <CalendarOutlined className="ds-date__icon" aria-hidden />
        <input
          id={id}
          type={NATIVE[picker].type}
          className="ds-date__native"
          value={isoOf(value, picker)}
          min={isoOf(minDate, picker) || undefined}
          max={isoOf(maxDate, picker) || undefined}
          disabled={disabled}
          aria-label={ariaLabel || placeholder || shown}
          aria-invalid={invalid || undefined}
          onChange={pick}
          onBlur={onBlur}
        />
        {allowClear && value && !disabled ? (
          <button type="button" className="ds-date__clear" aria-label="Xoá ngày" onClick={() => { setError(null); onChange?.(null, '') }}>
            <CloseCircleFilled />
          </button>
        ) : null}
      </span>
      {error ? <span className="ds-date__err" role="alert">{error}</span> : null}
    </span>
  )
}

// Khoảng ngày ở điện thoại: hai ô Từ / Đến. Chỉ báo onChange khi có đủ hai đầu (hoặc xoá cả hai), như RangePicker.
function NativeRange({ id, value, onChange, format, placeholder = ['Từ ngày', 'Đến ngày'], disabled, allowClear = true, minDate, maxDate, disabledDate, status, style }) {
  const [partial, setPartial] = useState(null)
  const [start, end] = partial || value || [null, null]
  const shown = showFormat(format, 'date')
  const set = (index) => (next) => {
    const range = index === 0 ? [next, end] : [start, next]
    if (range[0] && range[1]) {
      setPartial(null)
      onChange?.(range, range.map((day) => day.format(shown)))
    } else if (!range[0] && !range[1]) {
      setPartial(null)
      onChange?.(null, ['', ''])
    } else {
      setPartial(range)
    }
  }
  const common = { format, disabled, allowClear, disabledDate, status }
  return (
    <span className="ds-date-range" style={style}>
      <NativeDate {...common} id={id} value={start} onChange={set(0)} placeholder={placeholder[0]} minDate={minDate} maxDate={end || maxDate} aria-label={placeholder[0]} />
      <NativeDate {...common} value={end} onChange={set(1)} placeholder={placeholder[1]} minDate={start || minDate} maxDate={maxDate} aria-label={placeholder[1]} />
    </span>
  )
}
