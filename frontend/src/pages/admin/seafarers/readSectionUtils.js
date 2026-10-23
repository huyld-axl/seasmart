export const filled = (v) => v !== undefined && v !== null && v !== ''

// Số trường đã có giá trị của một khối chỉ đọc ("5/8"), hoặc số mục của khối danh sách ("2 người").
export function countFilled(section) {
  if (section.countLabel !== undefined) return section.countLabel
  const all = [...(section.fields || []), ...(section.groups || []).flatMap((g) => g.fields)]
  const done = all.filter(([, v]) => filled(v)).length
  if (section.items) return `${section.items.length} ${section.unit || 'mục'}`
  return `${done}/${all.length}`
}

