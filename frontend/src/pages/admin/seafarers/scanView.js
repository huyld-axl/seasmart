// Quét giấy tờ ở form thêm / sửa thuyền viên: tên nút, gộp kết quả nhiều tệp, dòng tóm tắt từng khối, so khớp quốc tịch.

export const SCAN_BUTTONS = {
  cccd: 'Quét CCCD',
  passport: 'Quét hộ chiếu',
  seaman_book: 'Quét sổ thuyền viên',
  diploma: 'Quét bằng tốt nghiệp',
}

// Loại giấy server trả về → cách gọi trong câu "Đã điền 5 ô từ …".
export const SOURCE_NAMES = {
  national_id: 'CCCD',
  passport: 'hộ chiếu',
  seaman_book_info: 'sổ thuyền viên',
  diploma: 'bằng tốt nghiệp',
}

// Giấy trên thắng khi hai giấy cùng có một ô (giống server).
const PRIORITY = ['national_id', 'passport', 'seaman_book_info', 'diploma']

// Nhiều kết quả quét (mỗi tệp một) → một mảng ô, mỗi ô một lần.
export function mergeScans(results) {
  const all = results.flatMap((r) => r.fields || [])
  const rank = (item) => {
    const i = PRIORITY.indexOf(item.source)
    return i === -1 ? PRIORITY.length : i
  }
  const seen = new Map()
  for (const item of [...all].sort((a, b) => rank(a) - rank(b))) if (!seen.has(item.field)) seen.set(item.field, item)
  return [...seen.values()]
}

const strip = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// "VIỆT NAM", "VIETNAMESE", "VNM" → id nước trong danh mục; không khớp thì null.
export function matchCountry(text, countries = []) {
  const key = strip(text)
  if (!key) return null
  if (/^(vietnamese|vnm|vn)$/.test(key)) {
    const vn = countries.find((c) => String(c.code).toUpperCase() === 'VN')
    if (vn) return vn.id
  }
  const hit = countries.find((c) => [c.name_vi, c.name_en, c.code].some((n) => strip(n) === key))
  if (hit) return hit.id
  const loose = countries.find((c) => [c.name_vi, c.name_en].some((n) => strip(n).length >= 4 && (key.startsWith(strip(n)) || strip(n).startsWith(key))))
  return loose ? loose.id : null
}

// marks: { [field]: { state, source } }; sections: [{ key, title, fields, list? }].
// Trả mỗi khối có ô vừa điền: { key, filled, check, sources, others: [{ title, count }] }.
export function sectionSummaries(marks, sections) {
  const owner = new Map()
  for (const s of sections) for (const field of s.fields) owner.set(field, s.key)
  const byKey = new Map()
  for (const [field, mark] of Object.entries(marks)) {
    const key = owner.get(field)
    if (!key) continue
    const row = byKey.get(key) || { key, filled: 0, check: 0, sources: [] }
    row.filled += 1
    if (mark.state === 'check') row.check += 1
    const name = SOURCE_NAMES[mark.source] || 'giấy tờ'
    if (!row.sources.includes(name)) row.sources.push(name)
    byKey.set(key, row)
  }
  return sections
    .filter((s) => byKey.has(s.key))
    .map((s) => ({
      ...byKey.get(s.key),
      others: sections.filter((o) => o.key !== s.key && byKey.has(o.key)).map((o) => ({ title: o.title, count: byKey.get(o.key).filled })),
    }))
}

export function summaryText(row) {
  const parts = [`Đã điền ${row.filled} ô từ ${row.sources.join(', ')}`]
  if (row.check) parts.push(`${row.check} ô cần kiểm tra`)
  let text = parts.join(', ')
  if (row.others.length) {
    text += `. Khối khác cũng được điền: ${row.others.map((o) => `${o.title} (${o.count} ô)`).join(', ')}`
  }
  return `${text}.`
}
