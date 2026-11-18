import { expect, it } from 'vitest'
import { ownerErrors } from '../field_rules'

it('chặn website có nhãn tên miền sai trước khi lưu đối tác', () => {
  for (const website of ['https://a..com', 'https://-abc.com', 'https://abc-.com', 'https://a_b.com', `https://${'a'.repeat(64)}.com`]) {
    expect(ownerErrors({ website })).toEqual(['Tên miền website không hợp lệ'])
  }
  for (const website of ['', 'https://example.com', 'https://sub.example.com:8080/a?q=1', 'https://my-company.vn', 'http://192.168.1.10']) {
    expect(ownerErrors({ website })).toEqual([])
  }
})
