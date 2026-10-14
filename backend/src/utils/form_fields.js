// Preview metadata is kept outside Excel cell models, so workbook styles stay
// independent of the visual filling guide.
const fields = new WeakMap()
const PLACEHOLDER = /\bHD?\s?(\d{1,3})\b/g
const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== ''
const master = (cell) => cell.isMerged ? cell.master : cell

function getFieldMarks(cell) { return fields.get(master(cell)) }
function markCell(cell, value) {
  fields.set(master(cell), { full: hasValue(value) ? 'filled' : 'missing' })
}
function markParts(cell, parts) {
  if (parts.length) fields.set(master(cell), { parts })
}

function fillMarkedText(text, data, ignored = new Set()) {
  let value = '', cursor = 0
  const parts = []
  for (const match of text.matchAll(PLACEHOLDER)) {
    value += text.slice(cursor, match.index)
    const code = `HD${match[1]}`
    const replacement = data[code] ?? data[`H${match[1]}`]
    const written = replacement === undefined ? match[0] : String(replacement)
    const start = value.length
    value += written
    if (!ignored.has(code)) parts.push({ start, end: value.length, state: hasValue(replacement) ? 'filled' : 'missing' })
    cursor = match.index + match[0].length
  }
  return { value: value + text.slice(cursor), parts }
}

// An input changes just a part of a sentence (for example a port/date). Keep
// earlier profile markers and mark the inserted portion, including rich text.
function markInput(cell, before, after, filled) {
  const at = master(cell)
  if (!filled) { fields.set(at, { full: 'missing' }); return }
  if (before === after) { markCell(at, after); return }
  let start = 0, suffix = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1
  const oldEnd = before.length - suffix, end = after.length - suffix
  const delta = after.length - before.length
  const parts = (getFieldMarks(at)?.parts || []).flatMap((part) => {
    if (part.end <= start) return [part]
    if (part.start >= oldEnd) return [{ ...part, start: part.start + delta, end: part.end + delta }]
    return []
  })
  parts.push({ start, end, state: 'filled' })
  fields.set(at, { parts: parts.sort((a, b) => a.start - b.start) })
}

module.exports = { getFieldMarks, markCell, markParts, fillMarkedText, markInput }
