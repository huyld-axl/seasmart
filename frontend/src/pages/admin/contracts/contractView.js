// Hàm thuần của màn Hợp đồng: cân đối, danh sách khoản, kỳ thanh toán, đổi dữ liệu form <-> API.
// `balance` phải cho cùng kết quả với contractBalance ở backend/src/utils/voyage_math.js.
import dayjs from 'dayjs'
import { DEFAULT_ITEMS, DEFAULT_TERMS, CLOSING_DAYS, PAY_DAYS, PAY_MONTH_OFFSETS } from '../../../constants/voyageContract'

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
    seafarer_id: contract.seafarer_id,
    start_date: contract.start_date ? dayjs(contract.start_date) : null,
    end_date: contract.end_date ? dayjs(contract.end_date) : null,
    notes: contract.notes ?? '',
    items: [...itemRows(items).MONTHLY, ...itemRows(items).ONE_TIME],
    terms: { RECEIVABLE: { ...DEFAULT_TERMS.RECEIVABLE, ...terms?.RECEIVABLE }, PAYABLE: { ...DEFAULT_TERMS.PAYABLE, ...terms?.PAYABLE } },
  }
}

// Giá trị mặc định của form tạo mới từ một vị trí của chuyến.
export function newFormValues(voyage) {
  return {
    seafarer_id: undefined,
    start_date: voyage?.planned_embark_date ? dayjs(voyage.planned_embark_date) : null,
    end_date: voyage?.planned_disembark_date ? dayjs(voyage.planned_disembark_date) : null,
    notes: '',
    items: [...itemRows().MONTHLY, ...itemRows().ONE_TIME],
    terms: structuredClone(DEFAULT_TERMS),
  }
}

// Giá trị form -> body gửi API. Bỏ dòng tự đặt tên chưa có tên; ô tiền trống gửi null.
export function toPayload(values, { positionId } = {}) {
  const money = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
  return {
    ...(positionId ? { voyage_position_id: positionId } : {}),
    seafarer_id: values.seafarer_id,
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
