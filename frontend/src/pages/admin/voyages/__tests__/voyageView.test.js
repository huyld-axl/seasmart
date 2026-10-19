import { describe, it, expect } from 'vitest'
import { monthsBetween, splitBudget, dueLabel, crewMoves, toFormValues, toPayload } from '../voyageView'

describe('monthsBetween', () => {
  it('đúng các ví dụ của kế hoạch (cùng bộ với backend)', () => {
    expect(monthsBetween('2026-11-05', '2027-08-05')).toBe(9)
    expect(monthsBetween('2027-01-01', '2027-01-16')).toBe(0.5)
    expect(monthsBetween('2027-01-31', '2027-02-28')).toBe(1)
    expect(monthsBetween('2027-01-01', '2027-01-01')).toBe(0)
    expect(monthsBetween('2026-11-05', '2027-01-20')).toBe(2.5)
  })
  it('ngày kết thúc trước ngày bắt đầu thì lỗi', () => {
    expect(() => monthsBetween('2027-02-01', '2027-01-01')).toThrow()
  })
})

describe('splitBudget', () => {
  it('sửa ô nào thì ô kia tự tính', () => {
    expect(splitBudget({ total: 17100, months: 9 })).toEqual({ total: 17100, monthly: 1900 })
    expect(splitBudget({ monthly: 1900, months: 9 })).toEqual({ total: 17100, monthly: 1900 })
    expect(splitBudget({ total: 1000, months: 3 }).monthly).toBe(333.33)
    expect(splitBudget({ months: 9 })).toEqual({ total: null, monthly: null })
  })
})

describe('dueLabel', () => {
  it('nhãn vàng sắp tới, đỏ quá hạn, không có thì null', () => {
    expect(dueLabel(null)).toBeNull()
    expect(dueLabel({ kind: 'SOON', days: 2 })).toEqual({ tone: 'warning', text: 'Còn 2 ngày' })
    expect(dueLabel({ kind: 'LATE', days: 2 })).toEqual({ tone: 'error', text: 'Quá 2 ngày chưa bắt đầu' })
  })
})

describe('crewMoves', () => {
  const pos = (rank, status, crewStatus, id) => ({ rank_name: rank, contract: status ? { seafarer_id: id, seafarer_name: `N${id}`, status, seafarer_status: crewStatus } : null })
  const positions = [pos('Master', 'ACTIVE', 'AVAILABLE', 1), pos('AB', 'PENDING', 'AVAILABLE', 2), pos('Oiler', 'DRAFT', 'AVAILABLE', 3), pos('Cook', null), pos('Mate', 'ENDED', 'AVAILABLE', 4)]
  it('bắt đầu: chỉ hợp đồng hiệu lực chuyển sang Đang trên tàu, chưa hiệu lực bị bỏ qua', () => {
    const { moved, skipped } = crewMoves(positions, 'start')
    expect(moved).toEqual([{ seafarerId: 1, name: 'N1', rank: 'Master', from: 'AVAILABLE', to: 'ON_VESSEL' }])
    expect(skipped.map((s) => [s.seafarerId, s.contractStatus])).toEqual([[2, 'PENDING'], [3, 'DRAFT']])
  })
  it('kết thúc: chỉ người hiệu lực đang trên tàu về Ở bờ', () => {
    const onboard = [pos('Master', 'ACTIVE', 'ON_VESSEL', 1), pos('AB', 'ACTIVE', 'AVAILABLE', 2), pos('Oiler', 'REJECTED', 'AVAILABLE', 3)]
    const { moved, skipped } = crewMoves(onboard, 'end')
    expect(moved.map((m) => [m.seafarerId, m.from, m.to])).toEqual([[1, 'ON_VESSEL', 'AVAILABLE']])
    expect(skipped.map((s) => s.seafarerId)).toEqual([3])
  })
})

describe('toFormValues / toPayload', () => {
  const voyage = {
    vessel_id: 1, ship_owner_id: 2, planned_embark_date: '2026-11-05', planned_disembark_date: '2027-08-05',
    embark_port_id: 3, disembark_port_id: null, actual_embark_date: null, actual_disembark_date: null, notes: null,
    positions: [{ id: 7, rank_id: 4, budget_total_usd: 17100, budget_monthly_usd: 1900, contract: null }],
  }
  it('đi vòng qua form giữ nguyên dữ liệu', () => {
    const payload = toPayload(toFormValues(voyage))
    expect(payload).toMatchObject({
      vessel_id: 1, ship_owner_id: 2, planned_embark_date: '2026-11-05', planned_disembark_date: '2027-08-05',
      embark_port_id: 3, disembark_port_id: null, notes: null,
    })
    expect(payload.positions).toEqual([{ id: 7, rank_id: 4, budget_total_usd: 17100, budget_monthly_usd: 1900 }])
    expect(payload).not.toHaveProperty('actual_embark_date')
  })
  it('chỉ gửi ngày thực tế khi chuyến đã bắt đầu', () => {
    const values = toFormValues({ ...voyage, actual_embark_date: '2026-11-06' })
    expect(toPayload(values, { started: true })).toMatchObject({ actual_embark_date: '2026-11-06', actual_disembark_date: null })
  })
})
