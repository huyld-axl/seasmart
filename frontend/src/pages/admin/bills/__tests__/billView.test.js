import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { billNextAction, countChanges, groupItems, overdueLabel, payLabel, periodLabel, toPayload } from '../billView'

const items = [
  { item_code: 'BASIC_WAGE', kind: 'MONTHLY', name: 'Lương cơ bản', amount_usd: 1000 },
  { item_code: 'OTHER_MONTHLY', kind: 'MONTHLY', name: 'Khác (hằng tháng)', amount_usd: 0 },
  { item_code: 'FLIGHT_OUT', kind: 'ONE_TIME', name: 'Vé máy bay đi', amount_usd: 650 },
]

describe('billView', () => {
  it('nhóm và cộng dòng tiền', () => {
    expect(groupItems(items).totals).toEqual({ monthly: 1000, once: 650, all: 1650 })
  })

  it('payload: mỗi khoản gửi mã và số', () => {
    expect(toPayload({ note: '  ', items: [...items.slice(0, 2), { ...items[2], amount_usd: null }] })).toEqual({
      note: null,
      items: [{ item_code: 'BASIC_WAGE', amount_usd: 1000 }, { item_code: 'OTHER_MONTHLY', amount_usd: 0 }, { item_code: 'FLIGHT_OUT', amount_usd: 0 }],
    })
  })

  it('đếm thay đổi: mỗi khoản đổi số, ghi chú', () => {
    const initial = { note: '', items }
    expect(countChanges(initial, initial)).toBe(0)
    expect(countChanges(initial, { note: 'x', items: [{ ...items[0], amount_usd: 900 }, { ...items[1], amount_usd: 5 }, items[2]] })).toBe(3)
  })

  it('đổi hạn thanh toán: đếm là một thay đổi, payload gửi YYYY-MM-DD', () => {
    const initial = { note: '', due_date: dayjs('2026-11-10'), items }
    const values = { ...initial, due_date: dayjs('2026-11-12') }
    expect(countChanges(initial, values)).toBe(1)
    expect(toPayload(values).due_date).toBe('2026-11-12')
    expect(countChanges(initial, { ...initial, due_date: null })).toBe(1)
  })

  it('nhãn quá hạn và ngày thanh toán', () => {
    expect(overdueLabel({ display_status: 'OVERDUE', due_date: '2026-10-12' }, dayjs('2026-10-21'))).toBe('Quá hạn 9 ngày')
    expect(overdueLabel({ display_status: 'SENT', due_date: '2026-10-12' }, dayjs('2026-10-21'))).toBeUndefined()
    expect(payLabel({ pay_day: 10, pay_month_offset: 1 })).toBe('Ngày 10 tháng sau')
    expect(payLabel({ pay_day: 31, pay_month_offset: 2 })).toBe('Cuối tháng sau 2 tháng')
  })
})

describe('billNextAction', () => {
  const all = () => true
  const none = () => false
  it('mỗi trạng thái một việc kế tiếp', () => {
    expect(billNextAction({ display_status: 'TO_APPROVE' }, all)).toMatchObject({ action: 'approve', label: 'Duyệt' })
    expect(billNextAction({ display_status: 'TO_SEND' }, all)).toMatchObject({ action: 'send', label: 'Đánh dấu đã gửi' })
    expect(billNextAction({ display_status: 'SENT' }, all)).toMatchObject({ action: 'collect', label: 'Ghi nhận đã thu' })
    expect(billNextAction({ display_status: 'OVERDUE' }, all)).toMatchObject({ action: 'collect' })
  })
  it('đã thu, chưa đến kỳ: không có việc', () => {
    expect(billNextAction({ display_status: 'PAID' }, all)).toBeNull()
    expect(billNextAction({ display_status: 'UPCOMING' }, all)).toBeNull()
  })
  it('thiếu quyền thì không có nút', () => {
    expect(billNextAction({ display_status: 'TO_APPROVE' }, none)).toBeNull()
    expect(billNextAction({ display_status: 'TO_APPROVE' }, (code) => code === 'bill.send')).toBeNull()
    expect(billNextAction({ display_status: 'TO_SEND' }, (code) => code === 'bill.send')).toMatchObject({ action: 'send' })
  })
})

describe('periodLabel', () => {
  it('cùng năm bỏ năm đầu, dấu gạch liền, khác năm ghi đủ', () => {
    expect(periodLabel('2026-09-01', '2026-09-30')).toBe('01/09–30/09/2026')
    expect(periodLabel('2026-12-16', '2027-01-15')).toBe('16/12/2026–15/01/2027')
  })
  it('thiếu ngày thì rỗng', () => {
    expect(periodLabel(null, '2026-09-30')).toBe('')
  })
})
