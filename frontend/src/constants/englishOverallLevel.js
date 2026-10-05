/** Mức tiếng Anh tổng quan (Level): A / B / C - xuất CV tiếng Anh */

export const ENGLISH_OVERALL_LEVEL_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

export function formatEnglishOverallLevelLabel(raw) {
  if (raw == null || raw === '') return ''
  const u = String(raw).trim().toUpperCase()
  const opt = ENGLISH_OVERALL_LEVEL_OPTIONS.find((o) => o.value === u)
  return opt ? opt.label : String(raw).trim()
}
