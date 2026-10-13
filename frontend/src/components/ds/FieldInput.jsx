import { useId } from 'react'
import { Button, Input } from 'antd'
import { CheckCircleOutlined, CheckOutlined } from '@ant-design/icons'
import './ds.css'

// Ô dữ liệu của một giấy ở màn duyệt từng giấy (T2): sửa ngay trên ô nhập, không có nút Chấp nhận hay Sửa.
// Bỏ qua ô = chấp nhận; gõ khác giá trị AI đọc = "Đã sửa" (dấu tích xanh lá).
// Chỉ ô cần xác nhận (ngày AI chưa chắc, số GCNKNCM) có một nút ✓ cam, bấm một lần là xong.
// state: PROPOSED | ACCEPTED | EDITED | UNKNOWN | UNKNOWN_KEPT | DATE_AMBIGUOUS (cùng khoá với statusMap.field)
// destination: 'profile' (vào hồ sơ) | 'compare' (chỉ để so). `children` là phần đi kèm, ví dụ VesselMatchChip.
const DESTINATION_TEXT = { profile: 'vào hồ sơ', compare: 'chỉ để so' }

export default function FieldInput({
  label,
  value,
  state = 'PROPOSED',
  destination,
  required = false,
  mono = false,
  half = false,
  hint,
  aiRead,
  needsConfirm = false,
  isActive = false,
  disabled = false,
  children,
  onChange,
  onFocus,
  onBlur,
  onConfirm,
}) {
  const id = useId()
  const isUnsure = state === 'DATE_AMBIGUOUS'
  const isUnknown = state === 'UNKNOWN'
  const isEdited = state === 'EDITED'
  const isConfirmed = state === 'ACCEPTED' && needsConfirm
  const showConfirm = needsConfirm && !disabled && !isEdited && !isConfirmed
  const note = hint || (isEdited && aiRead && aiRead !== value ? `AI đọc: ${aiRead}` : null)
  const className = [
    'ds-fin',
    half ? 'ds-fin--half' : '',
    isUnsure && !isConfirmed ? 'ds-fin--warn' : '',
    isEdited ? 'ds-fin--edited' : '',
    isActive ? 'ds-fin--active' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <div className="ds-fin__head">
        <label htmlFor={id} className="ds-fin__label">
          {label}
          {required ? <span className="ds-fin__req" aria-label="bắt buộc"> *</span> : null}
        </label>
        {DESTINATION_TEXT[destination] ? <i>{DESTINATION_TEXT[destination]}</i> : null}
        {isEdited ? <b className="ds-fin__edited"><CheckOutlined aria-hidden />Đã sửa</b> : null}
      </div>
      <div className="ds-fin__box">
        <Input
          id={id}
          className={mono ? 'ds-fin__input ds-fin__input--mono' : 'ds-fin__input'}
          value={isUnknown ? '' : value}
          placeholder={state === 'UNKNOWN_KEPT' ? 'Để trống' : 'Không đọc được'}
          disabled={disabled}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange?.(event.target.value)}
        />
        {showConfirm ? (
          <Button className="ds-fin__confirm" icon={<CheckOutlined />} aria-label="Đúng, giữ nguyên" title="Đúng, giữ nguyên" onClick={onConfirm} />
        ) : null}
        {isEdited || isConfirmed ? <CheckCircleOutlined className="ds-fin__done" aria-label={isEdited ? 'Đã sửa' : 'Đã xác nhận'} /> : null}
        {children}
      </div>
      {note ? <span className={`ds-fin__hint${isUnsure && !isConfirmed ? ' ds-fin__hint--warn' : ''}`}>{note}</span> : null}
    </div>
  )
}
