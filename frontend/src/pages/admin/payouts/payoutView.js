import dayjs from 'dayjs'
import { DEFAULT_ITEMS } from '../../../constants/voyageContract'

// Trả lương thuyền viên (docs/mcah-ke-hoach-tra-luong.md phần B): hàm thuần cho trang Trả lương.

export const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
export const sumAmounts = (amounts = {}) => round2(Object.values(amounts).reduce((total, value) => total + Number(value || 0), 0))

// Tháng mặc định: tháng trước (lương tháng M trả trong tháng M+1).
export const previousMonth = (today = dayjs()) => dayjs(today).subtract(1, 'month').format('YYYY-MM')
export const shiftMonth = (month, step) => dayjs(`${month}-01`).add(step, 'month').format('YYYY-MM')
export const monthLabel = (month) => dayjs(`${month}-01`).format('MM/YYYY')
export const isMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

// Số dòng Trả đang hiện: số đang sửa (chưa chốt) nếu có, không thì số đã lưu / mặc định từ máy chủ.
export const shownAmounts = (row, edits) => edits[row.bill.id] || row.payout.amounts

// Sửa một ô: trả bảng sửa mới; dòng về đúng số ban đầu thì bỏ khỏi bảng sửa.
export function applyEdit(edits, row, code, value) {
  const next = { ...shownAmounts(row, edits), [code]: round2(value ?? 0) }
  const same = DEFAULT_ITEMS.every((item) => round2(next[item.code]) === round2(row.payout.amounts[item.code]))
  const rest = { ...edits }
  delete rest[row.bill.id]
  return same ? rest : { ...rest, [row.bill.id]: next }
}

export const isChanged = (row, edits, code) => Boolean(edits[row.bill.id]) && round2(edits[row.bill.id][code]) !== round2(row.payout.amounts[code])

// Bill bị sửa tổng sau khi chốt trả lương.
export const billChanged = (row) => row.payout.status === 'PAID' && row.payout.bill_total_usd != null && round2(row.payout.bill_total_usd) !== round2(row.bill.total_usd)

// Một dòng gửi lên POST /payouts/pay.
export const payRow = (row, edits) => ({ bill_id: row.bill.id, version: row.payout.version ?? null, amounts: shownAmounts(row, edits) })

// "Đã trả 18/11"
export const paidLabel = (row) => (row.payout.status === 'PAID' && row.payout.paid_date ? `Đã trả ${dayjs(row.payout.paid_date).format('DD/MM')}` : undefined)
