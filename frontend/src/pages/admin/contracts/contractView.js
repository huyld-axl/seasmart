// Hàm thuần của màn Hợp đồng: cân đối, danh sách khoản, kỳ thanh toán, đổi dữ liệu form <-> API.
// `balance` phải cho cùng kết quả với contractBalance ở backend/src/utils/voyage_math.js.
import dayjs from 'dayjs'
import { DEFAULT_ITEMS, DEFAULT_TERMS, CLOSING_DAYS, PAY_DAYS, PAY_MONTH_OFFSETS } from '../../../constants/voyageContract'
import { formatUsd } from '../../../utils/format'

const API_DATE = 'YYYY-MM-DD'
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v))
const fromDay = (value) => (value ? dayjs(value).format(API_DATE) : null)

const sum = (items, kind, field) => round2(items.filter((i) => i.kind === kind).reduce((s, i) => s + num(i[field]), 0))

// Cân đối: *Ok là true khi đạt (dấu ✓ xanh), false thì cảnh báo.
export function balance({ items, budgetMonthly, contractMonths }) {
  const budget = num(budgetMonthly)
  const receivableMonthly = sum(items, 'MONTHLY', 'receivable_usd')
  const payableMonthly = sum(items, 'MONTHLY', 'payable_usd')
  const receivableOnce = sum(items, 'ONE_TIME', 'receivable_usd')
  const payableOnce = sum(items, 'ONE_TIME', 'payable_usd')
  const diffMonthly = round2(receivableMonthly - payableMonthly)
  return {
    budgetMonthly: round2(budget),
    receivableMonthly,
    payableMonthly,
    diffMonthly,
    receivableOnce,
    payableOnce,
    diffOnce: round2(receivableOnce - payableOnce),
    diffContract: round2(diffMonthly * num(contractMonths)),
    receivableOk: receivableMonthly <= budget,
    payableOk: payableMonthly <= budget,
    diffOk: diffMonthly >= 0 && diffMonthly <= budget,
  }
}

// Dòng chú thích (title) cho ba số cân đối: bằng, bao nhiêu % budget, vượt bao nhiêu.
export function balanceNotes(b) {
  const budget = b.budgetMonthly
  const pct = (v) => (budget > 0 ? `${Math.round((v / budget) * 100)}% budget` : 'Chưa có budget')
  const side = (v) => (v === budget ? 'Bằng budget' : v < budget ? pct(v) : `Vượt budget ${formatUsd(round2(v - budget))}`)
  let diff
  if (b.diffMonthly < 0) diff = `Phải chi lớn hơn phải thu ${formatUsd(round2(-b.diffMonthly))}`
  else if (b.diffMonthly > budget) diff = `Vượt budget ${formatUsd(round2(b.diffMonthly - budget))}`
  else diff = pct(b.diffMonthly)
  return { receivable: side(b.receivableMonthly), payable: side(b.payableMonthly), diff }
}

const KIND_ORDER = ['MONTHLY', 'ONE_TIME']

// Các dòng của bảng khoản: đủ 12 khoản mặc định (thiếu thì thêm dòng trống) rồi dòng tự đặt tên, chia theo nhóm.
export function itemRows(items = []) {
  const byCode = Object.fromEntries(items.filter((i) => i.item_code).map((i) => [i.item_code, i]))
  const custom = items.filter((i) => !i.item_code)
  return Object.fromEntries(
    KIND_ORDER.map((kind) => [
      kind,
      [
        ...DEFAULT_ITEMS.filter((d) => d.kind === kind).map((d) => ({
          kind,
          item_code: d.code,
          custom_name: null,
          name: d.name,
          receivable_usd: byCode[d.code]?.receivable_usd ?? null,
          payable_usd: byCode[d.code]?.payable_usd ?? null,
        })),
        ...custom.filter((i) => i.kind === kind).map((i) => ({
          kind,
          item_code: null,
          custom_name: i.custom_name ?? '',
          name: i.custom_name ?? '',
          receivable_usd: i.receivable_usd ?? null,
          payable_usd: i.payable_usd ?? null,
        })),
      ],
    ])
  )
}

export const CLOSING_OPTIONS = CLOSING_DAYS.map((day) => ({ value: day, label: day === 31 ? 'Cuối tháng' : `Ngày ${day}` }))
export const HOLIDAY_OPTIONS = [
  { value: 'BEFORE', label: 'Làm trước' },
  { value: 'AFTER', label: 'Làm sau' },
]

const OFFSET_GROUPS = { 1: 'Tháng sau', 2: 'Sau 2 tháng', 3: 'Sau 3 tháng' }

function payLabel(day, offset) {
  if (offset === 1) return day === 31 ? 'Cuối tháng sau' : `Ngày ${day} tháng sau`
  return day === 31 ? `Cuối tháng, sau ${offset} tháng` : `Ngày ${day} sau ${offset} tháng`
}

// Giá trị một lựa chọn ngày thanh toán là `${pay_day}:${pay_month_offset}`.
export const payValue = (term) => `${term.pay_day}:${term.pay_month_offset}`
export const parsePayValue = (value) => {
  const [day, offset] = String(value).split(':').map(Number)
  return { pay_day: day, pay_month_offset: offset }
}

// Dropdown ngày thanh toán: 3 nhóm × 7 ngày = 21 lựa chọn.
export function payOptions() {
  return PAY_MONTH_OFFSETS.map((offset) => ({
    label: OFFSET_GROUPS[offset],
    options: PAY_DAYS.map((day) => ({ value: `${day}:${offset}`, label: payLabel(day, offset) })),
  }))
}

// Ba dòng chữ của một bên trong bảng kỳ thanh toán (dùng ở màn chỉ đọc).
export function termLabel(term) {
  const t = term || {}
  return {
    closing: CLOSING_OPTIONS.find((o) => o.value === t.closing_day)?.label ?? '—',
    pay: t.pay_day ? payLabel(t.pay_day, t.pay_month_offset) : '—',
    holiday: HOLIDAY_OPTIONS.find((o) => o.value === t.holiday_rule)?.label ?? '—',
  }
}

// Chi tiết hợp đồng từ API -> giá trị ban đầu của form.
export function toFormValues(detail) {
  const { contract, items, terms } = detail
  return {
    seafarer_voyage_id: contract.seafarer_voyage_id,
    start_date: contract.start_date ? dayjs(contract.start_date) : null,
    end_date: contract.end_date ? dayjs(contract.end_date) : null,
    notes: contract.notes ?? '',
    items: [...itemRows(items).MONTHLY, ...itemRows(items).ONE_TIME],
    terms: { RECEIVABLE: { ...DEFAULT_TERMS.RECEIVABLE, ...terms?.RECEIVABLE }, PAYABLE: { ...DEFAULT_TERMS.PAYABLE, ...terms?.PAYABLE } },
  }
}

// Giá trị mặc định của form tạo mới từ một chuyến: S = ngày xuống, E = ngày rời dự kiến (chỉ chép lúc mở form, sau đó độc lập).
export function newFormValues(voyage) {
  return {
    seafarer_voyage_id: voyage?.id,
    start_date: voyage?.join_date ? dayjs(voyage.join_date) : null,
    end_date: voyage?.planned_leave_date ? dayjs(voyage.planned_leave_date) : null,
    notes: '',
    items: [...itemRows().MONTHLY, ...itemRows().ONE_TIME],
    terms: structuredClone(DEFAULT_TERMS),
  }
}

// Giá trị form -> body gửi API (voyageId chỉ khi tạo mới: chuyến và thuyền viên của hợp đồng không đổi được). Bỏ dòng tự đặt tên chưa có tên; ô tiền trống gửi null.
export function toPayload(values, { voyageId } = {}) {
  const money = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
  return {
    ...(voyageId ? { seafarer_voyage_id: voyageId } : {}),
    start_date: fromDay(values.start_date),
    end_date: fromDay(values.end_date),
    notes: values.notes?.trim() || null,
    items: (values.items || [])
      .filter((i) => i.item_code || (i.custom_name && i.custom_name.trim()))
      .map((i) => ({
        kind: i.kind,
        ...(i.item_code ? { item_code: i.item_code } : { custom_name: i.custom_name.trim() }),
        receivable_usd: money(i.receivable_usd),
        payable_usd: money(i.payable_usd),
      })),
    terms: values.terms,
  }
}

// ---------- Duyệt lại: bản xem trước bill (kết quả GET /contracts/:id/bill-plan) ----------
export const BILL_STATUS_TEXT = { OPEN: 'Chưa duyệt', APPROVED: 'Đã duyệt', SENT: 'Đã gửi', PAID: 'Đã thu' }

const dmy = (value) => dayjs(value).format('DD/MM/YYYY')
const dm = (value) => dayjs(value).format('DD/MM')

// "01/10 – 31/10/2026"; khác năm thì ghi đủ năm hai đầu.
export function periodText(start, end) {
  return dayjs(start).year() === dayjs(end).year() ? `${dm(start)} – ${dmy(end)}` : `${dmy(start)} – ${dmy(end)}`
}

// Plan đổi bill (khác NONE / FIRST) thì duyệt cần hộp xác nhận.
export const planChangesBills = (plan) => Boolean(plan) && !['NONE', 'FIRST'].includes(plan.mode)

// Các dòng bảng "Kỳ | Hiện tại | Sau khi duyệt | Trạng thái" của hộp duyệt lại.
export function planRows(plan) {
  const rows = []
  for (const b of plan.cut) {
    rows.push({ key: `cut-${b.bill_id}`, label: `${b.seq}`, current: periodText(b.from.start, b.from.end), after: `${periodText(b.to.start, b.to.end)} · tiền giữ đủ tháng`, status: BILL_STATUS_TEXT[b.status] })
  }
  for (const b of plan.remove) {
    rows.push({ key: `remove-${b.bill_id}`, label: `${b.seq}`, current: periodText(b.start, b.end), after: 'Xoá mềm', status: BILL_STATUS_TEXT[b.status], removed: true, edited: b.edited })
  }
  for (const b of plan.create) {
    rows.push({ key: `create-${b.seq}`, label: `${b.seq} mới`, current: '—', after: `${periodText(b.start, b.end)}${b.with_one_time ? ' · gồm khoản một lần' : ' · đủ tháng'}`, status: 'Chưa duyệt' })
  }
  return rows
}

// Dòng "Ngày kết thúc 31/12/2026 → 17/10/2026" ở đầu hộp.
export function planHeadline(plan) {
  const { contract_range: now, bills_range: before } = plan
  if (!before) return null
  const parts = []
  if (now.start !== before.start) parts.push(`Ngày bắt đầu ${dmy(before.start)} → ${dmy(now.start)}`)
  if (now.end !== before.end) parts.push(`Ngày kết thúc ${dmy(before.end)} → ${dmy(now.end)}`)
  return parts.join(' · ') || null
}

// Một câu cho banner Màn 9: ngày bill đang có so với ngày đang lưu, và việc sẽ làm khi duyệt.
export function planSummary(plan) {
  if (!plan?.bills_range) return null
  const { contract_range: now, bills_range: before } = plan
  const seqs = (list) => list.map((b) => b.seq).join(', ')
  if (plan.mode === 'REGENERATE') {
    return `Ngày bắt đầu: bill đang từ ${dmy(before.start)}, hợp đồng đang lưu ${dmy(now.start)}. Khi duyệt: xoá mềm ${plan.remove.length} bill và sinh lại ${plan.create.length} kỳ từ ${dmy(now.start)}.`
  }
  const lead = `Ngày kết thúc: bill đang tới ${dmy(before.end)}, hợp đồng đang lưu ${dmy(now.end)}.`
  if (plan.mode === 'CUT') {
    const steps = [
      plan.cut.length ? `kỳ ${seqs(plan.cut)} cắt về ${dm(now.end)}` : null,
      plan.remove.length ? `kỳ ${seqs(plan.remove)} xoá mềm` : null,
    ].filter(Boolean)
    return `${lead} Khi duyệt: ${steps.join(', ')}.`
  }
  if (plan.mode === 'EXTEND') return `${lead} Khi duyệt: thêm ${plan.create.length} kỳ (${seqs(plan.create)}), chỉ khoản hằng tháng.`
  return 'Ngày không đổi so với bill đang có: duyệt không đổi bill.'
}

// Nhãn lệch ngày ở danh sách hợp đồng: "Đã rời tàu 17/10".
export const dateMismatchText = (mismatch) => `Đã rời tàu ${dm(mismatch.leave_date)}`

// Số tháng của hợp đồng như backend (monthsBetween): m tháng trọn + ngày lẻ / 30, làm tròn 2 chữ số. Ghi "6 tháng", "2,5 tháng".
export function contractMonthsLabel(start, end) {
  const a = dayjs(start)
  const b = dayjs(end)
  if (!a.isValid() || !b.isValid() || b.isBefore(a, 'day')) return ''
  let months = (b.year() - a.year()) * 12 + (b.month() - a.month())
  while (months > 0 && a.add(months, 'month').isAfter(b, 'day')) months -= 1
  const days = b.startOf('day').diff(a.add(months, 'month').startOf('day'), 'day')
  const value = round2(months + days / 30)
  return `${String(value).replace('.', ',')} tháng`
}

// Hợp đồng Hiệu lực sắp hết hạn: số ngày còn lại tới ngày kết thúc (âm là đã quá). Trạng thái khác, hoặc chưa có ngày: null.
export function daysLeft(row, today = dayjs()) {
  if (row.status !== 'ACTIVE' || !row.end_date) return null
  return dayjs(row.end_date).startOf('day').diff(today.startOf('day'), 'day')
}

// Ngưỡng sắp hết hạn: ô Thời hạn đổi màu khi còn ≤ 30 ngày, dải cảnh báo khi còn ≤ 7 ngày (kế hoạch danh sách mobile, mục 8 câu 3).
export const EXPIRY_WARN_DAYS = 30
export const EXPIRY_ALERT_DAYS = 7

// Việc kế tiếp của hợp đồng trên danh sách, theo trạng thái và quyền (cùng quyền với nút ở trang chi tiết).
// Trả về mảng tối đa 2 nút: Chờ duyệt → Duyệt, Từ chối; Nháp / Bị từ chối → Sửa. Hiệu lực, Đã kết thúc: không có.
export function contractNextActions(row, can) {
  if (row.status === 'PENDING' && can('contract.approve')) {
    return [{ action: 'approve', label: 'Duyệt' }, { action: 'reject', label: 'Từ chối', danger: true }]
  }
  if (row.status === 'DRAFT' && can('contract.update')) return [{ action: 'edit', label: 'Sửa nháp' }]
  if (row.status === 'REJECTED' && can('contract.update')) return [{ action: 'edit', label: 'Sửa lại' }]
  return []
}
