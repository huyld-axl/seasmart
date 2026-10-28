import dayjs from 'dayjs'

// Hàm thuần cho các màn cơ hội.

// Nhãn hạn chốt từ deadline_flag của API: { kind: 'SOON' | 'LATE', days } hoặc null.
export function deadlineLabel(flag) {
  if (!flag) return null
  if (flag.kind === 'LATE') return { tone: 'error', text: `quá ${flag.days} ngày` }
  return { tone: 'warning', text: flag.days === 0 ? 'hôm nay' : `còn ${flag.days} ngày` }
}

// Ứng viên được chốt của cơ hội (đã chốt, hoặc chủ tàu đã chọn); chưa có thì null.
export function chosenCandidate(row) {
  if (row.placed_name) return { name: row.placed_name, seafarerId: row.placed_seafarer_id }
  if (row.selected_name) return { name: row.selected_name, seafarerId: row.selected_seafarer_id }
  return null
}

// ---------- Form tạo / sửa ----------

const API_DATE = 'YYYY-MM-DD'
const toDay = (value) => (value ? dayjs(value) : null)
const fromDay = (value) => (value ? dayjs(value).format(API_DATE) : null)

// Nhóm hiển thị của một yêu cầu: giấy tờ (loại giấy DOCUMENT, MEDICAL), chứng chỉ, kinh nghiệm, mẫu giấy.
// Hồ sơ yêu cầu chia ba nhóm: giấy tờ (nạp từ thuyền viên: tuỳ thân, chứng chỉ), biểu mẫu (mình điền rồi nộp), kinh nghiệm.
export const REQUIREMENT_GROUPS = [
  { key: 'doc', title: 'Giấy tờ', hint: 'Giấy lấy trọn vẹn từ thuyền viên: tuỳ thân, chứng chỉ, sức khoẻ.', add: 'Thêm giấy tờ', empty: 'Chưa yêu cầu giấy tờ nào.' },
  { key: 'tpl', title: 'Biểu mẫu', hint: 'Giấy trống mình điền rồi nộp chủ tàu: CV, quyết định điều động, thư bảo lãnh…', add: 'Thêm biểu mẫu', empty: 'Chưa yêu cầu biểu mẫu nào.' },
  { key: 'exp', title: 'Kinh nghiệm', hint: 'Số tháng đã đi một chức danh, hoặc số chuyến trên một loại tàu.', add: 'Thêm kinh nghiệm', empty: 'Chưa yêu cầu kinh nghiệm.' },
]

export function requirementGroup(row) {
  if (row.kind === 'TEMPLATE') return 'tpl'
  if (row.kind === 'EXPERIENCE') return 'exp'
  return 'doc'
}

// Dòng yêu cầu từ API (opportunity hoặc mẫu) -> dòng của bảng trong form.
export function toRequirementRows(requirements = []) {
  return requirements.map((r) => ({
    kind: r.kind,
    certificate_type_id: r.certificate_type_id ?? null,
    certificate_category: r.certificate_category ?? null,
    rank_id: r.rank_id ?? null,
    vessel_type_id: r.vessel_type_id ?? null,
    min_months: r.min_months ?? null,
    min_trips: r.min_trips ?? null,
    template_key: r.template_key ?? null,
    level: r.level || 'REQUIRED',
    valid_until: r.valid_until || (r.kind === 'CERTIFICATE' ? 'LEAVE' : 'ANY'),
    plus_months: r.plus_months ?? null,
  }))
}

// Dòng bảng -> body API, xếp theo nhóm. Dòng chưa chọn gì thì bỏ.
export function toRequirementPayload(rows = []) {
  const order = Object.fromEntries(REQUIREMENT_GROUPS.map((g, i) => [g.key, i]))
  return rows
    .filter((r) => r.certificate_type_id || r.rank_id || r.vessel_type_id || r.template_key)
    .map((r, i) => ({ r, i, g: order[requirementGroup(r)] }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .map(({ r }) => {
      if (r.kind === 'TEMPLATE') return { kind: 'TEMPLATE', template_key: r.template_key, level: 'REQUIRED', valid_until: 'ANY' }
      if (r.kind === 'EXPERIENCE') {
        return r.rank_id
          ? { kind: 'EXPERIENCE', rank_id: r.rank_id, min_months: Number(r.min_months) || 1, level: r.level, valid_until: 'ANY' }
          : { kind: 'EXPERIENCE', vessel_type_id: r.vessel_type_id, min_trips: Number(r.min_trips) || 1, level: r.level, valid_until: 'ANY' }
      }
      return {
        kind: 'CERTIFICATE',
        certificate_type_id: r.certificate_type_id,
        level: r.level,
        valid_until: r.valid_until,
        plus_months: r.valid_until === 'LEAVE_PLUS' ? Number(r.plus_months) || 6 : null,
      }
    })
}

export const EMPTY_FORM = {
  ship_owner_id: undefined, vessel_id: undefined, rank_id: undefined, budget_monthly_usd: null, budget_total_usd: null,
  planned_join_date: null, planned_join_port_id: undefined, planned_leave_date: null, planned_leave_port_id: undefined,
  deadline: null, owner_user_id: undefined, notes: '', requirements: [],
}

export function toFormValues(o) {
  return {
    ship_owner_id: o.ship_owner_id,
    vessel_id: o.vessel_id ?? undefined,
    rank_id: o.rank_id,
    budget_monthly_usd: o.budget_monthly_usd,
    budget_total_usd: o.budget_total_usd,
    planned_join_date: toDay(o.planned_join_date),
    planned_join_port_id: o.planned_join_port_id ?? undefined,
    planned_leave_date: toDay(o.planned_leave_date),
    planned_leave_port_id: o.planned_leave_port_id ?? undefined,
    deadline: toDay(o.deadline),
    owner_user_id: o.owner_user_id,
    notes: o.notes ?? '',
    requirements: toRequirementRows(o.requirements),
  }
}

export function toPayload(values) {
  return {
    ship_owner_id: values.ship_owner_id,
    vessel_id: values.vessel_id || null,
    rank_id: values.rank_id,
    budget_monthly_usd: values.budget_monthly_usd == null ? null : Number(values.budget_monthly_usd),
    budget_total_usd: values.budget_total_usd == null ? null : Number(values.budget_total_usd),
    planned_join_date: fromDay(values.planned_join_date),
    planned_join_port_id: values.planned_join_port_id || null,
    planned_leave_date: fromDay(values.planned_leave_date),
    planned_leave_port_id: values.planned_leave_port_id || null,
    deadline: fromDay(values.deadline),
    ...(values.owner_user_id ? { owner_user_id: values.owner_user_id } : {}),
    notes: values.notes?.trim() || null,
    requirements: toRequirementPayload(values.requirements),
  }
}

// "Lưu & thêm vị trí khác": giữ chủ tàu, tàu, bốn mốc, hạn chốt, người phụ trách; xoá chức danh, budget, hồ sơ yêu cầu.
export function nextPositionValues(values) {
  return { ...EMPTY_FORM, ...values, rank_id: undefined, budget_monthly_usd: null, budget_total_usd: null, requirements: [] }
}

// ---------- Chi tiết ----------

// Tên một yêu cầu để hiện cho người dùng.
export function requirementName(r) {
  if (r.kind === 'TEMPLATE') return r.template_key
  if (r.kind === 'EXPERIENCE') return r.rank_id ? `Đã đi ${r.rank_name} ${r.min_months} tháng` : `Đã đi tàu ${r.vessel_type_name} ${r.min_trips} chuyến`
  return r.certificate_name
}

// Các mục thiếu hoặc hết hạn trước mốc của một ứng viên, bắt buộc trước.
export function fitIssues(fit, requirements, formatDate) {
  const byId = new Map(requirements.map((r) => [r.id, r]))
  return (fit?.items || [])
    .filter((item) => item.state !== 'ok')
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'REQUIRED' ? -1 : 1))
    .map((item) => {
      const name = requirementName(byId.get(item.requirement_id) || {}) || 'Yêu cầu'
      const text = item.state === 'expires_early' ? `${name} hết hạn ${formatDate(item.expiry)}` : item.kind === 'EXPERIENCE' ? `Chưa đủ: ${name}` : `Thiếu ${name}`
      return { text, required: item.level === 'REQUIRED', expiring: item.state === 'expires_early' }
    })
}

// Tóm tắt hồ sơ yêu cầu: "8 bắt buộc · 3 nên có" (không tính mẫu giấy) và số mẫu giấy.
export function requirementSummary(requirements = []) {
  const rows = requirements.filter((r) => r.kind !== 'TEMPLATE')
  const required = rows.filter((r) => r.level === 'REQUIRED').length
  const templates = requirements.length - rows.length
  return { required, preferred: rows.length - required, templates }
}
