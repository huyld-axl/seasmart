// Hàm thuần cho màn yêu cầu thanh toán: nhãn, nhóm dòng tiền, so thay đổi, payload lưu.
import dayjs from 'dayjs'

// "Quá hạn 9 ngày" cho badge; trạng thái khác giữ nhãn mặc định.
export function overdueLabel(bill, today = dayjs()) {
  if (bill.display_status !== 'OVERDUE') return undefined
  const days = today.startOf('day').diff(dayjs(bill.due_date), 'day')
  return days > 0 ? `Quá hạn ${days} ngày` : undefined
}

export const closingLabel = (day) => (day === 31 ? 'Cuối tháng' : `Ngày ${day}`)

export function payLabel(term) {
  if (!term) return ''
  const day = term.pay_day === 31 ? 'Cuối tháng' : `Ngày ${term.pay_day}`
  return `${day} ${term.pay_month_offset === 1 ? 'tháng sau' : `sau ${term.pay_month_offset} tháng`}`
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const sum = (rows) => round2(rows.reduce((total, row) => total + Number(row.amount_usd || 0), 0))

// Ba nhóm dòng tiền và tổng từng nhóm.
export function groupItems(items) {
  const monthly = items.filter((item) => item.kind === 'MONTHLY')
  const once = items.filter((item) => item.kind === 'ONE_TIME')
  const adjust = items.filter((item) => item.kind === 'ADJUSTMENT')
  return { monthly, once, adjust, totals: { monthly: sum(monthly), once: sum(once), adjust: sum(adjust), all: sum(items) } }
}

// Giá trị form từ dữ liệu chi tiết.
export function toFormValues(data) {
  return {
    note: data.bill.note || '',
    due_date: dayjs(data.bill.due_date),
    items: data.items.map((item) => ({ id: item.id, kind: item.kind, name: item.name, default_usd: item.default_usd, amount_usd: item.amount_usd })),
  }
}

// Payload PUT /bills/:id: khoản hợp đồng gửi id + số; dòng điều chỉnh gửi thêm tên (dòng mới không có id).
export function toPayload(values) {
  return {
    note: values.note?.trim() ? values.note.trim() : null,
    ...(values.due_date ? { due_date: dayjs(values.due_date).format('YYYY-MM-DD') } : {}),
    items: values.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      ...(item.kind === 'ADJUSTMENT' ? { name: (item.name || '').trim() } : {}),
      amount_usd: round2(item.amount_usd ?? 0),
    })),
  }
}

export const dueChanged = (initial, values) => Boolean(initial.due_date && values.due_date && !dayjs(values.due_date).isSame(initial.due_date, 'day'))

// Số thay đổi so với lúc mở form: mỗi dòng đổi số hoặc tên, dòng thêm, dòng xoá, ghi chú.
export function countChanges(initial, values) {
  const before = new Map(initial.items.map((item) => [item.id, item]))
  let count = 0
  for (const item of values.items) {
    const old = item.id ? before.get(item.id) : null
    if (!old) count += 1
    else if (round2(old.amount_usd ?? 0) !== round2(item.amount_usd ?? 0) || (old.name || '') !== (item.name || '')) count += 1
  }
  const kept = new Set(values.items.map((item) => item.id).filter(Boolean))
  count += initial.items.filter((item) => !kept.has(item.id)).length
  if ((initial.note || '').trim() !== (values.note || '').trim()) count += 1
  if (dueChanged(initial, values)) count += 1
  return count
}
