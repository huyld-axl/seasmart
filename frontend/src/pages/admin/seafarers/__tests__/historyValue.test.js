import { describe, expect, it } from 'vitest'
import { historyValue } from '../historyValue'

describe('history labels', () => {
  it.each([[1, 0], ['1', '0'], [true, false], ['ACTIVE', 'INACTIVE']])('labels partner transition %s → %s', (from, to) => {
    expect(`${historyValue('is_active', from, true)} → ${historyValue('is_active', to, true)}`).toBe('Đang hợp tác → Ngừng hợp tác')
    expect(historyValue('is_active', to, true)).not.toBe('trống')
  })
  it('labels seafarer statuses consistently', () => {
    expect(historyValue('status', 'ON_VESSEL')).toBe('Đang trên tàu')
    expect(historyValue('status', 'AVAILABLE')).toBe('Ở bờ')
    expect(historyValue('status', 'INACTIVE')).toBe('Tạm ngưng')
  })
  it('labels gender and insurance without treating false as empty', () => {
    expect(historyValue('gender', 'M')).toBe('Nam')
    expect(historyValue('social_insurance_joined', false)).toBe('Không')
    expect(historyValue('social_insurance_joined', true)).toBe('Có')
  })
  it('preserves unknown values, numbers, objects and empty values', () => {
    expect(historyValue('status', 'FUTURE')).toBe('FUTURE')
    expect(historyValue('children_count', 0)).toBe('0')
    expect(historyValue('notes', null)).toBe('trống')
    expect(historyValue('contacts', [{ name: 'Linh' }])).toBe('[{"name":"Linh"}]')
  })
})
