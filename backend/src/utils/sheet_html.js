// Dựng một sheet Excel (exceljs) thành HTML để xem trước đúng như file mẫu:
// độ rộng cột, ô gộp, phông chữ, căn lề, viền. Chỉ vẽ vùng in nếu sheet có đặt.

const PX_PER_CHAR = 7
const DEFAULT_COL_WIDTH = 8.43
const OVERFLOW_ROOM = 16 // chữ không xuống dòng ở cột cuối tràn ra ngoài bảng như trong Excel
const { getFieldMarks } = require('./form_fields')
const BORDER = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', medium: '2px solid', thick: '3px solid', double: '3px double' }

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const color = (c) => (c?.argb && /^[0-9a-f]{8}$/i.test(c.argb) ? `#${c.argb.slice(2)}` : null)
const pad = (n) => String(n).padStart(2, '0')

function colNumber(letters) {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
}

// "A1:J29" → { top, left, bottom, right }
function parseRange(ref) {
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(String(ref || '').split(',')[0].trim())
  if (!match) return null
  return { left: colNumber(match[1]), top: Number(match[2]), right: colNumber(match[3]), bottom: Number(match[4]) }
}

function fontCss(font = {}) {
  const css = []
  if (font.name) css.push(`font-family:'${font.name.replace(/[^\w \-]/g, '')}','Times New Roman',serif`)
  if (font.size) css.push(`font-size:${font.size}pt`)
  if (font.bold) css.push('font-weight:700')
  if (font.italic) css.push('font-style:italic')
  const lines = [font.underline && 'underline', font.strike && 'line-through'].filter(Boolean)
  if (lines.length) css.push(`text-decoration:${lines.join(' ')}`)
  if (color(font.color)) css.push(`color:${color(font.color)}`)
  return css
}

function rawCellHtml(cell) {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
  if (value.richText) {
    // Mỗi đoạn mang kiểu chữ riêng: đoạn không đậm trong ô đậm vẫn là chữ thường, như Excel.
    return value.richText.map((run) => `<span style="${['font-weight:400', 'font-style:normal', ...fontCss(run.font)].join(';')}">${esc(run.text)}</span>`).join('')
  }
  const result = value.formula || value.sharedFormula ? value.result : value
  if (typeof result === 'number' && /#,##0/.test(cell.numFmt || '')) return esc(result.toLocaleString('vi-VN'))
  if (result && typeof result === 'object') return esc(cell.text || '')
  return esc(result ?? '')
}

function markedText(text, parts, offset = 0, last = true) {
  const end = offset + text.length
  let cursor = offset, html = ''
  for (const part of parts) {
    const empty = part.start === part.end
    if (empty && !(part.start >= offset && (part.start < end || (last && part.start === end)))) continue
    const start = Math.max(offset, part.start, cursor), stop = Math.min(end, part.end)
    if (!empty && start >= stop) continue
    html += esc(text.slice(cursor - offset, start - offset))
    const label = part.state === 'missing' ? 'Chưa điền' : 'Đã điền'
    html += `<span data-fill-state="${part.state}"${empty ? ' data-fill-empty="true"' : ''} title="${label}">${esc(text.slice(start - offset, stop - offset))}</span>`
    cursor = stop
  }
  return html + esc(text.slice(cursor - offset))
}

function cellHtml(cell) {
  const marks = getFieldMarks(cell)
  if (!marks?.parts) return rawCellHtml(cell)
  const value = cell.value
  if (value?.richText) {
    let offset = 0
    return value.richText.map((run, index) => {
      const html = markedText(run.text, marks.parts, offset, index === value.richText.length - 1)
      offset += run.text.length
      return `<span style="${['font-weight:400', 'font-style:normal', ...fontCss(run.font)].join(';')}">${html}</span>`
    }).join('')
  }
  return markedText(cell.text || '', marks.parts)
}

function cellCss(cell) {
  const { font, alignment = {}, border = {}, fill } = cell.style || {}
  const css = fontCss(font)
  const numeric = typeof cell.value === 'number'
  css.push(`text-align:${{ center: 'center', centerContinuous: 'center', right: 'right', justify: 'justify' }[alignment.horizontal] || (numeric && !alignment.horizontal ? 'right' : 'left')}`)
  css.push(`vertical-align:${{ top: 'top', middle: 'middle' }[alignment.vertical] || 'bottom'}`)
  css.push(alignment.wrapText ? 'white-space:pre-wrap;overflow-wrap:anywhere' : 'white-space:pre')
  if (alignment.indent) css.push(`padding-left:${alignment.indent * 9 + 3}px`)
  for (const side of ['top', 'left', 'bottom', 'right']) {
    const line = border[side]
    if (line?.style && BORDER[line.style]) css.push(`border-${side}:${BORDER[line.style]} ${color(line.color) || '#000'}`)
  }
  if (fill?.type === 'pattern' && fill.pattern === 'solid' && color(fill.fgColor)) css.push(`background:${color(fill.fgColor)}`)
  return css.join(';')
}

const EMU_PER_PX = 9525
const IMAGE_TYPES = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif' }

// Ảnh neo theo ô (logo, ảnh thẻ) → thẻ img đặt tuyệt đối trên bảng.
function imagesHtml(ws, wb, cols, rowTops, range) {
  const left = (anchor) => cols.filter((col) => col.index <= anchor.nativeCol).reduce((sum, col) => sum + col.px, 0) + Math.round((anchor.nativeColOff || 0) / EMU_PER_PX)
  const top = (anchor) => (rowTops[anchor.nativeRow + 1] ?? 0) + Math.round((anchor.nativeRowOff || 0) / EMU_PER_PX)
  return ws.getImages().map(({ imageId, range: at }) => {
    const image = wb.getImage(imageId)
    const type = IMAGE_TYPES[String(image?.extension).toLowerCase()]
    if (!type || !image.buffer || !at?.tl || !at.br || at.tl.nativeRow + 1 < range.top || at.tl.nativeRow + 1 > range.bottom) return ''
    const x = left(at.tl)
    const y = top(at.tl)
    return `<img alt="" src="data:${type};base64,${Buffer.from(image.buffer).toString('base64')}" style="position:absolute;left:${x}px;top:${y}px;width:${left(at.br) - x}px;height:${top(at.br) - y}px">`
  }).join('')
}

// Trả về { html, width }: tài liệu HTML hoàn chỉnh và bề rộng trang tính bằng px.
// Truyền thêm workbook để vẽ cả ảnh trong sheet.
function sheetToHtml(ws, wb) {
  const dims = ws.dimensions
  const range = parseRange(ws.pageSetup?.printArea) || { top: dims.top, left: dims.left, bottom: dims.bottom, right: dims.right }
  const defaultWidth = ws.properties?.defaultColWidth || DEFAULT_COL_WIDTH

  const cols = []
  for (let c = range.left; c <= range.right; c += 1) {
    const column = ws.getColumn(c)
    if (!column.hidden) cols.push({ index: c, px: Math.round((column.width || defaultWidth) * PX_PER_CHAR + 5) })
  }
  const visible = new Set(cols.map((col) => col.index))

  const spans = new Map() // "row:col" của ô chính → { rowspan, colspan }
  const covered = new Set()
  for (const ref of ws.model.merges || []) {
    const m = parseRange(ref)
    if (!m) continue
    let colspan = 0
    for (let c = m.left; c <= m.right; c += 1) if (visible.has(c)) colspan += 1
    spans.set(`${m.top}:${m.left}`, { rowspan: m.bottom - m.top + 1, colspan: colspan || 1 })
    for (let r = m.top; r <= m.bottom; r += 1) {
      for (let c = m.left; c <= m.right; c += 1) if (r !== m.top || c !== m.left) covered.add(`${r}:${c}`)
    }
  }

  const rows = []
  const rowTops = {} // số dòng → vị trí px tính từ đầu bảng
  let offset = 0
  for (let r = range.top; r <= range.bottom; r += 1) {
    const row = ws.getRow(r)
    rowTops[r] = offset
    if (row.hidden) continue
    const cells = []
    for (const { index: c } of cols) {
      if (covered.has(`${r}:${c}`)) continue
      const span = spans.get(`${r}:${c}`)
      const attrs = span ? ` rowspan="${span.rowspan}" colspan="${span.colspan}"` : ''
      const cell = row.getCell(c)
      const marks = getFieldMarks(cell)
      const fillAttrs = marks ? ` data-fill-field="true" data-fill-state="${marks.full || 'mixed'}"` : ''
      cells.push(`<td${attrs} data-cell="${cell.address}"${fillAttrs} style="${cellCss(cell)}">${cellHtml(cell)}</td>`)
    }
    const height = Math.round((row.height || ws.properties?.defaultRowHeight || 15) * 96 / 72)
    rows.push(`<tr style="height:${height}px">${cells.join('')}</tr>`)
    offset += height
  }
  rowTops[range.bottom + 1] = offset

  const width = cols.reduce((sum, col) => sum + col.px, 0)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;background:#fff;color:#000}
body{position:relative}
table{border-collapse:collapse;table-layout:fixed;width:${width}px;font:11pt 'Times New Roman',serif}
td{padding:0 3px;overflow:visible}
</style></head><body><table><colgroup>${cols.map((col) => `<col style="width:${col.px}px">`).join('')}</colgroup>${rows.join('')}</table>${wb ? imagesHtml(ws, wb, cols, rowTops, range) : ''}</body></html>`
  return { html, width: width + OVERFLOW_ROOM }
}

module.exports = { sheetToHtml, parseRange }
