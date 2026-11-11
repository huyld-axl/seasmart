// Chuỗi đem ký của latest.json: JSON với khoá sắp xếp, để máy ký và máy kiểm ra cùng một chuỗi.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}

module.exports = { canonical }
