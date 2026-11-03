import { describe, expect, it } from 'vitest'
import { nextCode, nextVoyageCode, uniqueCode } from '../code_counter'

const connWith = (rows) => ({ query: async () => rows })

describe('code_counter', () => {
  it('cơ hội: năm 2 số + số thứ tự tối thiểu 2 số, quá 99 thì dài ra', async () => {
    expect(await nextCode(connWith([{ rows: [{ last_value: 1 }] }]), 'OPPORTUNITY', 2026, 'CH', 2, true)).toBe('CH2601')
    expect(await nextCode(connWith([{ rows: [{ last_value: 99 }] }]), 'OPPORTUNITY', 2026, 'CH', 2, true)).toBe('CH2699')
    expect(await nextCode(connWith([{ rows: [{ last_value: 100 }] }]), 'OPPORTUNITY', 2026, 'CH', 2, true)).toBe('CH26100')
  })

  it('chuyến từ cơ hội: đuôi = số lớn nhất đã dùng + 1', async () => {
    expect(await nextVoyageCode(connWith([[]]), 'CH2601')).toBe('CH2601-01')
    expect(await nextVoyageCode(connWith([[{ code: 'CH2601-01' }, { code: 'CH2601-02' }]]), 'CH2601')).toBe('CH2601-03')
    expect(await nextVoyageCode(connWith([[{ code: 'CH2601-99' }]]), 'CH2601')).toBe('CH2601-100')
  })

  it('mã con trùng với bản ghi đã xoá mềm thì thêm đuôi .2, .3', async () => {
    expect(await uniqueCode(connWith([[{ taken: 0 }]]), 'contract_bill', 'code', 'CH2601-01/HĐ/T1')).toBe('CH2601-01/HĐ/T1')
    expect(await uniqueCode(connWith([[{ taken: 1 }]]), 'contract_bill', 'code', 'CH2601-01/HĐ/T1')).toBe('CH2601-01/HĐ/T1.2')
  })
})
