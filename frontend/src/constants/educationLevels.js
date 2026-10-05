/** Mã văn bằng lưu vào graduation_level - đồng bộ detail + form */

export const EDUCATION_LEVEL_OPTIONS = [
  { value: 'ĐH', label: 'Đại học' },
  { value: 'CĐ', label: 'Cao đẳng' },
  { value: 'TC', label: 'Trung cấp' },
]

export function formatEducationLevelLabel(value) {
  if (value == null || value === '' || value === '-') return '-'
  const s = String(value).trim()
  const opt = EDUCATION_LEVEL_OPTIONS.find((o) => o.value === s)
  return opt ? opt.label : s
}
