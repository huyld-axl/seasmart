import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { fieldRules, ownerRules, notBefore } from '../fieldRules'

async function validate(rules, value) {
  for (const rule of rules) {
    if (value && rule.pattern && !rule.pattern.test(value)) throw new Error(rule.message)
    if (rule.validator) await rule.validator(null, value)
  }
}
describe('validate dữ liệu nhập hồi quy', () => {
  it.each(['!!!', '---', '😀', '123', 'Nguyễn 123'])('chặn họ tên %s', async (value) => {
    await expect(validate(fieldRules.personName, value)).rejects.toThrow()
  })
  it.each(['Lê Tiến Linh', "O’Neill", 'Jean-Luc', '李明', 'Nguyễ̃n An'])('giữ tên hợp lệ %s', async (value) => {
    await expect(validate(fieldRules.personName, value)).resolves.toBeUndefined()
  })
  it.each(['0000000000', '+00 0000 0000', '(000) 000-0000'])('chặn điện thoại %s', async (value) => {
    await expect(validate(fieldRules.phone, value)).rejects.toThrow('không được toàn số 0')
  })
  it.each(['0901234567', '+84 901 234 567', '', null])('giữ điện thoại hợp lệ/rỗng %s', async (value) => {
    await expect(validate(fieldRules.phone, value)).resolves.toBeUndefined()
  })
  it.each(['-----', '.....', ' -.-.- ', '0000000000'])('chặn mã số thuế %s', async (value) => {
    await expect(validate(ownerRules.taxId, value)).rejects.toThrow()
  })
  it.each(['0123456789', 'SG-12345', '0123456789-001', '', null])('giữ mã số thuế %s', async (value) => {
    await expect(validate(ownerRules.taxId, value)).resolves.toBeUndefined()
  })
  it('kiểm tra lại ngày hết hạn theo ngày cấp đang có trong form', async () => {
    const rule = notBefore('issued_date', 'Ngày hết hạn không được trước ngày cấp')({ getFieldValue: () => dayjs('2026-11-02') })
    await expect(rule.validator(null, dayjs('2025-01-01'))).rejects.toThrow('Ngày hết hạn không được trước ngày cấp')
    await expect(rule.validator(null, dayjs('2026-11-02'))).resolves.toBeUndefined()
    await expect(rule.validator(null, dayjs('2027-01-01'))).resolves.toBeUndefined()
  })
})
