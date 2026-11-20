import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { DEFAULT_ITEMS } from '../../../../constants/voyageContract'
import { applyEdit, billChanged, isChanged, paidLabel, payRow, previousMonth, shiftMonth, shownAmounts } from '../payoutView'

const zero = () => Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.code, 0]))
const row = (over = {}) => ({
  bill: { id: 41, total_usd: 2150 },
  payout: { id: null, version: null, status: 'UNPAID', amounts: { ...zero(), BASIC_WAGE: 1300, FLIGHT_OUT: 500 }, total_usd: 1800, ...over },
})

describe('payoutView', () => {
  it('tháng mặc định là tháng trước; lùi / tiến tháng qua năm', () => {
    expect(previousMonth(dayjs('2026-11-20'))).toBe('2026-10')
    expect(previousMonth(dayjs('2027-01-05'))).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  })

  it('sửa ô: lưu bản sửa của dòng; sửa về đúng số cũ thì bỏ', () => {
    const r = row()
    let edits = applyEdit({}, r, 'BASIC_WAGE', 1100)
    expect(shownAmounts(r, edits).BASIC_WAGE).toBe(1100)
    expect(isChanged(r, edits, 'BASIC_WAGE')).toBe(true)
    expect(isChanged(r, edits, 'FLIGHT_OUT')).toBe(false)
    edits = applyEdit(edits, r, 'BASIC_WAGE', 1300)
    expect(edits).toEqual({})
    expect(applyEdit({}, r, 'BONUS', null)).toEqual({})
  })

  it('payload chốt: số đang hiện và phiên bản', () => {
    const r = row({ version: 3 })
    expect(payRow(r, applyEdit({}, r, 'BONUS', 50))).toMatchObject({ bill_id: 41, version: 3, amounts: { BONUS: 50, BASIC_WAGE: 1300 } })
    expect(payRow(row(), {}).version).toBeNull()
  })

  it('bill đổi sau khi chốt và nhãn ngày trả', () => {
    expect(billChanged(row({ status: 'PAID', bill_total_usd: 2000, paid_date: '2026-11-18' }))).toBe(true)
    expect(billChanged(row({ status: 'PAID', bill_total_usd: 2150, paid_date: '2026-11-18' }))).toBe(false)
    expect(billChanged(row())).toBe(false)
    expect(paidLabel(row({ status: 'PAID', paid_date: '2026-11-18' }))).toBe('Đã trả 18/11')
    expect(paidLabel(row())).toBeUndefined()
  })
})
