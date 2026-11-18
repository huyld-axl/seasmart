import { expect, it } from 'vitest'
import { ownerRules } from '../fieldRules'

it('chặn nhãn tên miền sai, giữ tên miền con và địa chỉ hợp lệ', async () => {
  const validate = ownerRules.website[0].validator
  for (const value of ['https://a..com', 'https://-abc.com', 'https://abc-.com', 'https://a_b.com', `https://${'a'.repeat(64)}.com`]) {
    await expect(validate(null, value)).rejects.toThrow('Tên miền website không hợp lệ')
  }
  for (const value of ['', 'https://example.com', 'https://sub.example.com:8080/a?q=1', 'https://my-company.vn', 'http://192.168.1.10']) {
    await expect(validate(null, value)).resolves.toBeUndefined()
  }
})
