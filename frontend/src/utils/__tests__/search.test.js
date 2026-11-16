import { expect, it } from 'vitest'
import { filterSearchOption, matchesSearch, normalizeSearch } from '../search'

it.each(['Linh', 'linh', 'Tiến Linh', 'Tien Linh', 'LE TIEN LINH', '  le  tien linh  '])('khớp tên có dấu với từ khoá %s', (query) => {
  expect(matchesSearch('Lê Tiến Linh', query)).toBe(true)
  expect(matchesSearch('Lê Tiến Linh'.normalize('NFD'), query)).toBe(true)
})

it('xử lý đ/Đ, khoảng trắng, ô trống và từ khoá không khớp', () => {
  expect(normalizeSearch(' Đặng\u00a0Thị Hồng ')).toBe('dang thi hong')
  expect(matchesSearch('Đặng Thị Hồng', 'dang thi')).toBe(true)
  expect(matchesSearch('Lê Tiến Linh', 'Nguyen')).toBe(false)
  expect(matchesSearch(null, '')).toBe(true)
  expect(matchesSearch(null, 'Linh')).toBe(false)
})

it('tìm theo nhãn, giá trị AutoComplete và trường tuỳ chọn', () => {
  expect(filterSearchOption('viet nam', { label: '🇻🇳 Việt Nam', value: 1 })).toBe(true)
  expect(filterSearchOption('vo', { value: 'Vợ' })).toBe(true)
  expect(filterSearchOption('dai pho', { name: 'Đại phó', value: 1 }, 'name')).toBe(true)
})
