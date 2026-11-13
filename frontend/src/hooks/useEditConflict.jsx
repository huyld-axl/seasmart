import { useState } from 'react'
import dayjs from 'dayjs'
import ConflictDialog from '../components/ds/ConflictDialog'
import { conflictRows } from '../components/ds/conflictMerge'

// Chống ghi đè cho form sửa (docs/mcah-ke-hoach-desktop-gd3.md 3.4). Lưu bị 409 CONFLICT → tải bản mới nhất,
// so ba bản (lúc mở / đang nhập / mới nhất) và hiện ConflictDialog. Chọn xong: đặt lại form theo bản mới rồi điền
// lại các ô giữ phần của mình — các ô đó hiện "Đã sửa" như thường.
//   form: Form antd; initial: giá trị form lúc mở (đổi khi nạp bản mới);
//   reload(): tải bản mới nhất, cập nhật cache của trang và trả giá trị form của bản đó.
export const formatFormValue = (key, value) => {
  if (value === null || value === undefined || value === '') return ''
  if (dayjs.isDayjs(value)) return value.format('DD/MM/YYYY')
  if (Array.isArray(value)) return `${value.length} dòng`
  if (typeof value === 'object') return '(đã đổi)'
  if (/_id$/.test(key)) return '(đã đổi)'
  return String(value)
}

// onApplied(): gọi sau khi đã đặt lại form (trang tự đếm thay đổi thì đếm lại; setFieldsValue không bắn onValuesChange).
export default function useEditConflict({ form, initial, reload, labels, format = formatFormValue, onApplied }) {
  const [state, setState] = useState(null)

  const handleError = async (err) => {
    if (err?.response?.status !== 409 || err.response.data?.code !== 'CONFLICT') return false
    const latest = await reload()
    const info = err.response.data.conflict || {}
    setState({ stamp: Date.now(), by: info.changed_by, at: info.changed_at, rows: conflictRows({ base: initial, mine: form.getFieldsValue(true), theirs: latest }) })
    return true
  }

  // reload() đã nạp bản mới vào cache nên initialValues của Form đã là bản mới: đặt lại form theo đó rồi điền phần giữ.
  const finish = (keep) => {
    form.resetFields()
    if (Object.keys(keep).length) form.setFieldsValue(keep)
    setState(null)
    onApplied?.()
  }

  const dialog = (
    <ConflictDialog
      key={state?.stamp || 0}
      open={Boolean(state)}
      by={state?.by}
      at={state?.at}
      rows={state?.rows || []}
      labels={labels}
      format={format}
      onKeep={finish}
      onDiscard={() => finish({})}
      onClose={() => finish(Object.fromEntries((state?.rows || []).filter((r) => r.kind !== 'theirs').map((r) => [r.key, r.mine])))}
    />
  )
  return { handleError, dialog }
}
