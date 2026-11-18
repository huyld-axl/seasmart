import { expect, it } from 'vitest'
import { ownerErrors } from '../field_rules'

it('chặn Zalo sai ở công ty và người liên hệ, giữ số và link QR hợp lệ', () => {
  for (const zalo of ['abc', '0000000000', '123', 'https://example.com/abc', 'https://zalo.me.evil.com/abc']) {
    expect(ownerErrors({ zalo })).toHaveLength(1)
    expect(ownerErrors({ contacts: [{ name: 'QA', zalo }] })).toHaveLength(1)
  }
  for (const zalo of ['', null, '0912345678', '+84 912 345 678', 'https://zalo.me/0912345678', 'https://zalo.me/qr/abc123']) {
    expect(ownerErrors({ zalo, contacts: [{ name: 'QA', zalo }] })).toEqual([])
  }
})
