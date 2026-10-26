import { describe, it, expect } from 'vitest'
import {
  displayStatus, deadlineFlag, leaveFlag, requirementFit, experienceFromHistory, compareSuggestions, overlapsRange,
} from '../opportunity_rules'

const cand = (extra = {}) => ({ status: 'PICKED', owner_selected_at: null, last_sent_at: null, ...extra })

describe('displayStatus', () => {
  it('đủ 7 nhánh', () => {
    expect(displayStatus({ status: 'OPEN', candidates: [] })).toBe('NEW')
    expect(displayStatus({ status: 'OPEN', candidates: [cand({ status: 'REMOVED' })] })).toBe('NEW')
    expect(displayStatus({ status: 'OPEN', candidates: [cand()] })).toBe('PICKING')
    expect(displayStatus({ status: 'OPEN', candidates: [cand(), cand({ last_sent_at: '2026-10-14' })] })).toBe('WAITING')
    expect(displayStatus({ status: 'OPEN', candidates: [cand({ last_sent_at: '2026-10-14' }), cand({ owner_selected_at: '2026-10-20' })] })).toBe('OWNER_SELECTED')
    expect(displayStatus({ status: 'WON', candidates: [cand()] })).toBe('WON')
    expect(displayStatus({ status: 'LOST' })).toBe('LOST')
    expect(displayStatus({ status: 'CANCELLED' })).toBe('CANCELLED')
  })
})

describe('deadlineFlag', () => {
  const today = '2026-10-26'
  it('còn 0 và 7 ngày là SOON, 8 ngày thì không', () => {
    expect(deadlineFlag({ status: 'OPEN', deadline: '2026-10-26', today })).toEqual({ kind: 'SOON', days: 0 })
    expect(deadlineFlag({ status: 'OPEN', deadline: '2026-11-02', today })).toEqual({ kind: 'SOON', days: 7 })
    expect(deadlineFlag({ status: 'OPEN', deadline: '2026-11-03', today })).toBeNull()
  })
  it('quá 1 ngày là LATE; cơ hội đã đóng thì không cảnh báo', () => {
    expect(deadlineFlag({ status: 'OPEN', deadline: '2026-10-25', today })).toEqual({ kind: 'LATE', days: 1 })
    expect(deadlineFlag({ status: 'WON', deadline: '2026-10-25', today })).toBeNull()
  })
})

describe('leaveFlag', () => {
  it('chỉ chuyến đang trên tàu', () => {
    expect(leaveFlag({ status: 'ONBOARD', planned_leave_date: '2026-11-25', today: '2026-10-26' })).toEqual({ kind: 'SOON', days: 30 })
    expect(leaveFlag({ status: 'ONBOARD', planned_leave_date: '2026-10-20', today: '2026-10-26' })).toEqual({ kind: 'LATE', days: 6 })
    expect(leaveFlag({ status: 'LEFT', planned_leave_date: '2026-10-20', today: '2026-10-26' })).toBeNull()
  })
})

describe('requirementFit', () => {
  const dates = { join: '2026-10-25', leave: '2027-07-25' }
  const req = (extra) => ({ id: 1, kind: 'CERTIFICATE', level: 'REQUIRED', valid_until: 'LEAVE', ...extra })

  it('chứng chỉ có, thiếu, hết hạn trước mốc', () => {
    const certificates = [
      { certificate_type_id: 10, expiry_date: '2028-01-01', status: 'VALID' },
      { certificate_type_id: 11, expiry_date: '2027-01-01', status: 'VALID' },
      { certificate_type_id: 12, expiry_date: '2030-01-01', status: 'REVOKED' },
    ]
    const fit = requirementFit({
      certificates, dates,
      requirements: [req({ id: 1, certificate_type_id: 10 }), req({ id: 2, certificate_type_id: 11 }), req({ id: 3, certificate_type_id: 12 })],
    })
    expect(fit.items.map((i) => i.state)).toEqual(['ok', 'expires_early', 'missing'])
    expect(fit.required).toEqual({ ok: 1, total: 3 })
  })

  it('mốc JOIN, LEAVE_PLUS và ANY', () => {
    const certificates = [{ certificate_type_id: 10, expiry_date: '2027-03-01', status: 'VALID' }]
    const run = (extra) => requirementFit({ certificates, dates, requirements: [req({ certificate_type_id: 10, ...extra })] }).items[0]
    expect(run({ valid_until: 'JOIN' }).state).toBe('ok')
    expect(run({ valid_until: 'LEAVE' }).state).toBe('expires_early')
    expect(run({ valid_until: 'LEAVE_PLUS', plus_months: 6 })).toMatchObject({ state: 'expires_early', needed_until: '2028-01-25' })
    expect(run({ valid_until: 'ANY' }).state).toBe('ok')
  })

  it('no_expiry coi như còn hạn', () => {
    const fit = requirementFit({ certificates: [{ certificate_type_id: 10, expiry_date: '2020-01-01', no_expiry: 1, status: 'VALID' }], dates, requirements: [req({ certificate_type_id: 10 })] })
    expect(fit.items[0].state).toBe('ok')
  })

  it('hộ chiếu, sổ thuyền viên, sức khỏe đọc từ cột seafarer', () => {
    const seafarer = { passport_number: 'C1', passport_expiry: '2031-11-01', seaman_book_number: '', medical_cert_number: 'M1', medical_cert_expiry: '2026-10-20' }
    const fit = requirementFit({
      seafarer, dates,
      requirements: [
        req({ id: 1, certificate_code: 'PASSPORT', certificate_type_id: 1 }),
        req({ id: 2, certificate_code: 'SEAMAN_BOOK', certificate_type_id: 2 }),
        req({ id: 3, certificate_code: 'MEDICAL_FITNESS', certificate_type_id: 3, valid_until: 'JOIN', level: 'PREFERRED' }),
      ],
    })
    expect(fit.items.map((i) => i.state)).toEqual(['ok', 'missing', 'expires_early'])
    expect(fit.required).toEqual({ ok: 1, total: 2 })
    expect(fit.preferred).toEqual({ ok: 0, total: 1 })
  })

  it('kinh nghiệm theo tháng và theo chuyến; bỏ qua mẫu giấy', () => {
    const experience = { rankMonths: { 5: 14.5 }, vesselTypeTrips: { 3: 1 } }
    const fit = requirementFit({
      experience, dates,
      requirements: [
        { id: 1, kind: 'EXPERIENCE', level: 'REQUIRED', rank_id: 5, min_months: 12 },
        { id: 2, kind: 'EXPERIENCE', level: 'PREFERRED', vessel_type_id: 3, min_trips: 2 },
        { id: 3, kind: 'TEMPLATE', level: 'REQUIRED', template_key: 'cv' },
      ],
    })
    expect(fit.items.map((i) => [i.state, i.value])).toEqual([['ok', 14.5], ['missing', 1]])
    expect(fit.required).toEqual({ ok: 1, total: 1 })
  })
})

describe('experienceFromHistory', () => {
  it('cộng tháng theo chức danh, đếm chuyến theo loại tàu, chuyến đang chạy tính tới hôm nay', () => {
    const out = experienceFromHistory([
      { rank_id: 5, vessel_type_id: 3, start: '2025-01-01', end: '2025-07-01' },
      { rank_id: 5, vessel_type_id: 4, start: '2026-04-26', end: null },
      { rank_id: 6, vessel_type_id: 3, start: null, end: null },
    ], '2026-10-26')
    expect(out.rankMonths).toEqual({ 5: 12 })
    expect(out.vesselTypeTrips).toEqual({ 3: 1, 4: 1 })
  })
})

describe('compareSuggestions', () => {
  const fit = (r, rt, p) => ({ required: { ok: r, total: rt }, preferred: { ok: p, total: 3 } })
  const base = { today: '2026-10-26', join: '2026-12-15' }
  it('đủ bắt buộc trước, rồi nhiều nên có, rồi ngày rảnh gần ngày xuống', () => {
    const rows = [
      { name: 'thiếu', fit: fit(7, 8, 3), ...base },
      { name: 'đủ, 1 nên có', fit: fit(8, 8, 1), ...base },
      { name: 'đủ, 3 nên có, rảnh xa', fit: fit(8, 8, 3), ...base, free_from: null },
      { name: 'đủ, 3 nên có, rảnh gần', fit: fit(8, 8, 3), ...base, free_from: '2026-12-01' },
    ]
    expect(rows.sort(compareSuggestions).map((r) => r.name)).toEqual(['đủ, 3 nên có, rảnh gần', 'đủ, 3 nên có, rảnh xa', 'đủ, 1 nên có', 'thiếu'])
  })
})

describe('overlapsRange', () => {
  const from = '2026-10-01'; const to = '2026-10-31'
  it('đang trên tàu, đã rời trong khoảng, rời trước khoảng, lên sau khoảng', () => {
    expect(overlapsRange({ join_date: '2026-06-05', planned_leave_date: '2027-03-05' }, from, to)).toBe(true)
    expect(overlapsRange({ join_date: '2026-06-05', leave_date: '2026-10-01', planned_leave_date: '2027-03-05' }, from, to)).toBe(true)
    expect(overlapsRange({ join_date: '2026-06-05', leave_date: '2026-09-14', planned_leave_date: '2027-02-05' }, from, to)).toBe(false)
    expect(overlapsRange({ join_date: '2026-11-01', planned_leave_date: '2027-08-01' }, from, to)).toBe(false)
  })
})
