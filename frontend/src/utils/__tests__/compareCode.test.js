import { describe, expect, it } from 'vitest'
import { compareCode } from '../compareCode'

describe('compareCode', () => {
  it('so theo số: CH2699 trước CH26100', () => {
    expect(compareCode('CH2699', 'CH26100')).toBeLessThan(0)
  })

  it('chuyến, hợp đồng, bill cùng gốc đứng liền nhau theo thứ tự', () => {
    const codes = ['CH2601-10', 'CH2601-02/HĐ/T1', 'CH2601-02', 'CH2601-02/HĐ', 'CH2601-02/HĐ/T10', 'CH2601-02/HĐ/T2']
    expect([...codes].sort(compareCode)).toEqual(['CH2601-02', 'CH2601-02/HĐ', 'CH2601-02/HĐ/T1', 'CH2601-02/HĐ/T2', 'CH2601-02/HĐ/T10', 'CH2601-10'])
  })

  it('mã bằng nhau và rỗng', () => {
    expect(compareCode('CT2601', 'CT2601')).toBe(0)
    expect(compareCode(null, 'CT2601')).toBeLessThan(0)
  })
})
