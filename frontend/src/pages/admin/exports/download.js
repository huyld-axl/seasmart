// Lưu file trả về từ API (blob) xuống máy người dùng.
export function saveBlob(res, fallbackName) {
  const header = res.headers?.['content-disposition'] || ''
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  const name = match ? decodeURIComponent(match[1]) : fallbackName
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
