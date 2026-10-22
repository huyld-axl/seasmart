import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { countChanges, groupItems, overdueLabel, payLabel, toPayload } from '../billView'

const items = [
  { id: 1, kind: 'MONTHLY', name: 'Lương cơ bản', amount_usd: 1000 },
  { id: 2, kind: 'ONE_TIME', name: 'Vé máy bay đi', amount_usd: 650 },
  { id: 3, kind: 'ADJUSTMENT', name: 'Trừ', amount_usd: -100 },
]

describe('billView', () => {
  it('nhóm và cộng dòng tiền', () => {
    expect(groupItems(items).totals).toEqual({ monthly: 1000, once: 650, adjust: -100, all: 1550 })
  })

  it('payload: khoản hợp đồng gửi id và số, dòng điều chỉnh gửi tên, dòng mới không id', () => {
    expect(toPayload({ note: '  ', items: [...items, { kind: 'ADJUSTMENT', name: ' Mới ', amount_usd: -5 }] })).toEqual({
      note: null,
      items: [{ id: 1, amount_usd: 1000 }, { id: 2, amount_usd: 650 }, { id: 3, name: 'Trừ', amount_usd: -100 }, { name: 'Mới', amount_usd: -5 }],
    })
  })

  it('đếm thay đổi: sửa số, thêm, xoá dòng, ghi chú', () => {
    const initial = { note: '', items }
    expect(countChanges(initial, initial)).toBe(0)
    expect(countChanges(initial, { note: 'x', items: [{ ...items[0], amount_usd: 900 }, items[1], { kind: 'ADJUSTMENT', name: 'Mới', amount_usd: 1 }] })).toBe(4)
  })

  it('đổi hạn thanh toán: đếm là một thay đổi, payload gửi YYYY-MM-DD', () => {
    const initial = { note: '', due_date: dayjs('2026-11-10'), items }
    const values = { ...initial, due_date: dayjs('2026-11-12') }
    expect(countChanges(initial, values)).toBe(1)
    expect(toPayload(values).due_date).toBe('2026-11-12')
  })

  it('nhãn quá hạn và ngày thanh toán', () => {
    expect(overdueLabel({ display_status: 'OVERDUE', due_date: '2026-10-12' }, dayjs('2026-10-21'))).toBe('Quá hạn 9 ngày')
    expect(overdueLabel({ display_status: 'SENT', due_date: '2026-10-12' }, dayjs('2026-10-21'))).toBeUndefined()
    expect(payLabel({ pay_day: 10, pay_month_offset: 1 })).toBe('Ngày 10 tháng sau')
    expect(payLabel({ pay_day: 31, pay_month_offset: 2 })).toBe('Cuối tháng sau 2 tháng')
  })
})
