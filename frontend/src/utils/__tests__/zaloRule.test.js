import { expect, it } from 'vitest'
import { ownerRules } from '../fieldRules'

it('Zalo nhận số điện thoại và link QR, chặn chữ tùy ý và toàn số 0', async () => {
  const validate = ownerRules.zalo[0].validator
  for (const value of ['abc', '0000000000', '123', 'https://example.com/abc', 'https://zalo.me.evil.com/abc']) {
    await expect(validate(null, value)).rejects.toThrow('Zalo phải là')
  }
  for (const value of ['', null, '0912345678', '+84 912 345 678', 'https://zalo.me/0912345678', 'https://zalo.me/qr/abc123']) {
    await expect(validate(null, value)).resolves.toBeUndefined()
  }
})
