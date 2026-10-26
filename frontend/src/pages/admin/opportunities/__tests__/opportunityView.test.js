import { describe, it, expect } from 'vitest'
import { chosenCandidate, deadlineLabel, nextPositionValues, toFormValues, toPayload, toRequirementPayload } from '../opportunityView'


describe('deadlineLabel', () => {
  it('quá hạn đỏ, sắp tới vàng, hôm nay', () => {
    expect(deadlineLabel({ kind: 'LATE', days: 11 })).toEqual({ tone: 'error', text: 'quá 11 ngày' })
    expect(deadlineLabel({ kind: 'SOON', days: 4 })).toEqual({ tone: 'warning', text: 'còn 4 ngày' })
    expect(deadlineLabel({ kind: 'SOON', days: 0 }).text).toBe('hôm nay')
    expect(deadlineLabel(null)).toBeNull()
  })
})

describe('chosenCandidate', () => {
  it('lấy người đã chốt, rồi người chủ tàu chọn, không có thì null', () => {
    expect(chosenCandidate({ placed_name: 'A', placed_seafarer_id: 1, selected_name: 'B' })).toEqual({ name: 'A', seafarerId: 1 })
    expect(chosenCandidate({ selected_name: 'B', selected_seafarer_id: 2 })).toEqual({ name: 'B', seafarerId: 2 })
    expect(chosenCandidate({ candidates_count: 4 })).toBeNull()
  })
})

describe('form cơ hội', () => {
  const categoryOf = (id) => ({ 1: 'DOCUMENT', 2: 'STCW', 3: 'MEDICAL' })[id]

  it('hồ sơ yêu cầu xếp theo nhóm giấy tờ, chứng chỉ, kinh nghiệm, mẫu giấy; bỏ dòng chưa chọn', () => {
    const out = toRequirementPayload([
      { kind: 'TEMPLATE', template_key: 'cv' },
      { kind: 'CERTIFICATE', certificate_type_id: 2, level: 'REQUIRED', valid_until: 'LEAVE' },
      { kind: 'EXPERIENCE', rank_id: 5, min_months: 12, level: 'PREFERRED' },
      { kind: 'CERTIFICATE', certificate_type_id: 1, level: 'REQUIRED', valid_until: 'LEAVE_PLUS', plus_months: 6 },
      { kind: 'CERTIFICATE', _group: 'doc', certificate_type_id: null },
    ], categoryOf)
    expect(out.map((r) => r.certificate_type_id || r.rank_id || r.template_key)).toEqual([1, 2, 5, 'cv'])
    expect(out[0]).toMatchObject({ valid_until: 'LEAVE_PLUS', plus_months: 6 })
    expect(out[1].plus_months).toBeNull()
    expect(out[2]).toEqual({ kind: 'EXPERIENCE', rank_id: 5, min_months: 12, level: 'PREFERRED', valid_until: 'ANY' })
  })

  it('đọc từ API rồi gửi lại ra cùng ngày, cùng số', () => {
    const api = { ship_owner_id: 1, vessel_id: null, rank_id: 2, budget_monthly_usd: 4900, budget_total_usd: 44100, planned_join_date: '2026-10-25', planned_leave_date: '2027-07-25', deadline: '2026-10-15', owner_user_id: 3, notes: null, requirements: [] }
    expect(toPayload(toFormValues(api), categoryOf)).toMatchObject({ vessel_id: null, planned_join_date: '2026-10-25', planned_leave_date: '2027-07-25', deadline: '2026-10-15', budget_monthly_usd: 4900, notes: null, requirements: [] })
  })

  it('Lưu & thêm vị trí khác giữ chủ tàu, tàu, mốc, hạn chốt; xoá chức danh, budget, hồ sơ yêu cầu', () => {
    const next = nextPositionValues({ ship_owner_id: 1, vessel_id: 4, rank_id: 2, budget_monthly_usd: 4900, budget_total_usd: 44100, deadline: 'd', owner_user_id: 3, requirements: [{ kind: 'TEMPLATE' }] })
    expect(next).toMatchObject({ ship_owner_id: 1, vessel_id: 4, deadline: 'd', owner_user_id: 3, rank_id: undefined, budget_monthly_usd: null, budget_total_usd: null, requirements: [] })
  })
})
