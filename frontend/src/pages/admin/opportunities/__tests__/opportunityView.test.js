import { describe, it, expect } from 'vitest'
import { chosenCandidate, candidateStages, candidateTags, deadlineLabel, stageIndex, nextPositionValues, toFormValues, toPayload, toRequirementPayload } from '../opportunityView'


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

  it('hồ sơ yêu cầu xếp theo nhóm giấy tờ, biểu mẫu, kinh nghiệm; bỏ dòng chưa chọn', () => {
    const out = toRequirementPayload([
      { kind: 'TEMPLATE', template_key: 'cv' },
      { kind: 'CERTIFICATE', certificate_type_id: 2, level: 'REQUIRED', valid_until: 'LEAVE' },
      { kind: 'EXPERIENCE', rank_id: 5, min_months: 12, level: 'PREFERRED' },
      { kind: 'CERTIFICATE', certificate_type_id: 1, level: 'REQUIRED', valid_until: 'LEAVE_PLUS', plus_months: 6 },
      { kind: 'CERTIFICATE', _group: 'doc', certificate_type_id: null },
    ], categoryOf)
    expect(out.map((r) => r.certificate_type_id || r.rank_id || r.template_key)).toEqual([2, 1, 'cv', 5])
    expect(out[1]).toMatchObject({ valid_until: 'LEAVE_PLUS', plus_months: 6 })
    expect(out[0].plus_months).toBeNull()
    expect(out[3]).toEqual({ kind: 'EXPERIENCE', rank_id: 5, min_months: 12, level: 'PREFERRED', valid_until: 'ANY' })
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

describe('stageIndex', () => {
  it('đang mở lấy theo display_status, đã chốt là mốc cuối', () => {
    expect(stageIndex({ status: 'OPEN', display_status: 'NEW' })).toBe(0)
    expect(stageIndex({ status: 'OPEN', display_status: 'WAITING' })).toBe(2)
    expect(stageIndex({ status: 'WON', display_status: 'WON' })).toBe(4)
  })

  it('đã đóng thì lấy mốc đã tới từ ứng viên, bỏ người đã bỏ', () => {
    const closed = (candidates) => stageIndex({ status: 'LOST', display_status: 'LOST', candidates })
    expect(closed([])).toBe(0)
    expect(closed([{ status: 'REMOVED', last_sent_at: '2026-10-01' }])).toBe(0)
    expect(closed([{ status: 'PICKED' }])).toBe(1)
    expect(closed([{ status: 'PICKED', last_sent_at: '2026-10-01' }])).toBe(2)
    expect(closed([{ status: 'PICKED', last_sent_at: '2026-10-01', owner_selected_at: '2026-10-02' }])).toBe(3)
  })
})

describe('candidateTags', () => {
  const fmt = (d) => d
  const opportunity = { rank_id: 5, planned_join_date: '2026-10-15', requirements: [{ id: 1, kind: 'CERTIFICATE', certificate_name: 'GMDSS' }] }
  const fit = (state) => ({ required: { ok: state === 'ok' ? 1 : 0, total: 1 }, preferred: { ok: 0, total: 0 }, items: [{ requirement_id: 1, kind: 'CERTIFICATE', level: 'REQUIRED', state }] })
  const base = { current_rank_id: 5, fit: fit('ok') }

  it('đủ hồ sơ, ở bờ, đúng chức danh: không có cảnh báo', () => {
    const tags = candidateTags(base, opportunity, fmt)
    expect(tags.docs).toEqual({ tone: 'ok', label: 'Đủ hồ sơ' })
    expect(tags.availability).toBeNull()
    expect(tags.position).toBeNull()
  })

  it('thiếu giấy bắt buộc đếm số mục', () => {
    expect(candidateTags({ ...base, fit: fit('missing') }, opportunity, fmt).docs).toEqual({ tone: 'warn', label: 'Thiếu giấy tờ · 1' })
  })

  it('đang trên tàu: bận nếu rời sau ngày xuống, kịp thì chỉ ghi chữ', () => {
    const onboard = { ...base, onboard_voyage_id: 9, onboard_vessel_name: 'MV A' }
    expect(candidateTags({ ...onboard, onboard_until: '2026-11-01' }, opportunity, fmt).availability).toEqual({ tone: 'warn', label: 'Bận' })
    expect(candidateTags({ ...onboard, onboard_until: '2026-10-02' }, opportunity, fmt).availability).toBeNull()
  })

  it('khác chức danh thì Không trùng vị trí', () => {
    expect(candidateTags({ ...base, current_rank_id: 7 }, opportunity, fmt).position).toEqual({ tone: 'warn', label: 'Không trùng vị trí' })
  })
})

describe('candidateStages', () => {
  it('chặng chưa xong đầu tiên là next, sau nó là todo', () => {
    expect(candidateStages({}).states).toEqual(['next', 'todo', 'todo'])
    expect(candidateStages({ export_pack: { created_at: '2026-10-29' } }).states).toEqual(['done', 'next', 'todo'])
    expect(candidateStages({ export_pack: { created_at: '2026-10-29' }, last_sent_at: '2026-10-29' }).states).toEqual(['done', 'done', 'next'])
  })

  it('xong cả ba thì complete', () => {
    const full = { export_pack: { created_at: 'a' }, last_sent_at: 'b', owner_selected_at: 'c' }
    expect(candidateStages(full).states).toEqual(['complete', 'complete', 'complete'])
    expect(candidateStages(full).dates).toEqual(['a', 'b', 'c'])
  })
})
