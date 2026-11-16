// Dùng cùng cách so khớp cho ô tìm kiếm và các danh sách chọn trên trình duyệt.
export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function matchesSearch(value, query) {
  return normalizeSearch(value).includes(normalizeSearch(query))
}

export function filterSearchOption(input, option, field = 'label') {
  return matchesSearch(option?.[field] ?? option?.label ?? option?.value, input)
}
