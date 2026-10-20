// Hàm thuần của màn Chuyến tàu: số tháng, budget, nhãn trễ ngày, danh sách chuyển trạng thái thuyền viên, đổi dữ liệu form <-> API.
// monthsBetween / splitBudget phải cho cùng kết quả với backend/src/utils/voyage_math.js (cùng bộ ví dụ trong test).
import dayjs from 'dayjs'

const API_DATE = 'YYYY-MM-DD'
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const filled = (v) => v !== undefined && v !== null && v !== ''

// Số tháng giữa hai ngày: m tháng trọn + d ngày lẻ / 30, làm tròn 2 chữ số. Lỗi nếu end < start.
export function monthsBetween(start, end) {
  const s = dayjs(start).startOf('day')
  const e = dayjs(end).startOf('day')
  if (!s.isValid() || !e.isValid()) throw new Error('Ngày không hợp lệ')
  if (e.isBefore(s)) throw new Error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
  let months = (e.year() - s.year()) * 12 + (e.month() - s.month())
  while (months > 0 && s.add(months, 'month').isAfter(e)) months -= 1
  const days = e.diff(s.add(months, 'month'), 'day')
  return round2(months + days / 30)
}

// Sửa ô nào thì ô kia tự tính. Trả { total, monthly }; ô để trống (chưa nhập) thì trả null cho ô kia.
export function splitBudget({ total, monthly, months }) {
  if (filled(total)) return { total: round2(total), monthly: months > 0 ? round2(Number(total) / months) : round2(total) }
  if (filled(monthly)) return { total: round2(Number(monthly) * months), monthly: round2(monthly) }
  return { total: null, monthly: null }
}

// Nhãn trễ ngày từ trường `due` của API: { kind: 'SOON' | 'LATE', days } hoặc null.
export function dueLabel(due) {
  if (!due) return null
  if (due.kind === 'LATE') return { tone: 'error', text: `Quá ${due.days} ngày chưa bắt đầu` }
  return { tone: 'warning', text: due.days === 0 ? 'Xuống tàu hôm nay' : `Còn ${due.days} ngày` }
}

const NOT_EFFECTIVE = ['DRAFT', 'PENDING', 'REJECTED']

// Ai chuyển trạng thái, ai bị bỏ qua khi Bắt đầu (kind 'start') hoặc Kết thúc (kind 'end') chuyến.
// Khớp backend: chỉ hợp đồng Hiệu lực; khi kết thúc chỉ người đang ON_VESSEL.
export function crewMoves(positions, kind) {
  const moved = []
  const skipped = []
  for (const position of positions || []) {
    const contract = position.contract
    if (!contract) continue
    const person = { seafarerId: contract.seafarer_id, name: contract.seafarer_name, rank: position.rank_name }
    if (NOT_EFFECTIVE.includes(contract.status)) {
      skipped.push({ ...person, contractStatus: contract.status })
    } else if (contract.status === 'ACTIVE') {
      if (kind === 'start') moved.push({ ...person, from: contract.seafarer_status, to: 'ON_VESSEL' })
      else if (contract.seafarer_status === 'ON_VESSEL') moved.push({ ...person, from: 'ON_VESSEL', to: 'AVAILABLE' })
    }
  }
  return { moved, skipped }
}

const toDay = (value) => (value ? dayjs(value) : null)
const fromDay = (value) => (value ? dayjs(value).format(API_DATE) : null)

// Chi tiết chuyến từ API -> giá trị ban đầu của form (ngày là dayjs).
export function toFormValues(voyage) {
  return {
    vessel_id: voyage.vessel_id,
    ship_owner_id: voyage.ship_owner_id,
    planned_embark_date: toDay(voyage.planned_embark_date),
    planned_disembark_date: toDay(voyage.planned_disembark_date),
    embark_port_id: voyage.embark_port_id ?? null,
    disembark_port_id: voyage.disembark_port_id ?? null,
    actual_embark_date: toDay(voyage.actual_embark_date),
    actual_disembark_date: toDay(voyage.actual_disembark_date),
    notes: voyage.notes ?? '',
    positions: (voyage.positions || []).map((p) => ({
      id: p.id,
      rank_id: p.rank_id,
      budget_total_usd: p.budget_total_usd,
      budget_monthly_usd: p.budget_monthly_usd,
      hasContract: !!p.contract,
    })),
  }
}

// Giá trị form -> body gửi API. Ngày thực tế chỉ gửi khi chuyến đã bắt đầu (`started`).
export function toPayload(values, { started = false } = {}) {
  const payload = {
    vessel_id: values.vessel_id,
    ship_owner_id: values.ship_owner_id,
    planned_embark_date: fromDay(values.planned_embark_date),
    planned_disembark_date: fromDay(values.planned_disembark_date),
    embark_port_id: values.embark_port_id || null,
    disembark_port_id: values.disembark_port_id || null,
    notes: values.notes?.trim() || null,
    positions: (values.positions || []).map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      rank_id: p.rank_id,
      budget_total_usd: Number(p.budget_total_usd ?? 0),
      budget_monthly_usd: Number(p.budget_monthly_usd ?? 0),
    })),
  }
  if (started) {
    payload.actual_embark_date = fromDay(values.actual_embark_date)
    payload.actual_disembark_date = fromDay(values.actual_disembark_date)
  }
  return payload
}
