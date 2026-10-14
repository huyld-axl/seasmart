// Đọc và vẽ nội dung một ô sửa tay trên trang giấy xem trước.
// Giá trị một ô:
//   chuỗi: chữ thường, giữ định dạng của ô;
//   mảng đoạn [{ text, bold, italic, underline, strike?, color?, size? }] khi có định dạng trong ô
//     (strike, color '#rrggbb', size theo pt chỉ ghi khi khác ô gốc);
//   { runs: chuỗi | mảng đoạn, align } khi đổi căn lề ngang của ô (left, center, right, justify).

export const ALIGNS = ['left', 'center', 'right', 'justify']

const isBold = (style) => Number(style.fontWeight) >= 600 || style.fontWeight === 'bold'
// Gạch chân, gạch ngang của thẻ cha cũng vẽ lên chữ con, nên dò ngược lên tới ô.
const hasLine = (node, td, line) => {
  for (let el = node; el; el = el === td ? null : el.parentElement) {
    const style = el.ownerDocument.defaultView.getComputedStyle(el)
    if (`${style.textDecorationLine || ''} ${style.textDecoration || ''}`.includes(line)) return true
  }
  return false
}
export function toHex(color) {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '')
  return match ? `#${match.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : null
}
// Cỡ chữ tính toán thường ra px; giữ nguyên nếu đã là pt.
export const pxToPt = (size) => Math.round(parseFloat(size) * (/pt$/.test(size) ? 1 : 0.75) * 2) / 2

const formatOf = (el, td) => {
  const style = el.ownerDocument.defaultView.getComputedStyle(el)
  return {
    bold: isBold(style),
    italic: style.fontStyle === 'italic',
    underline: hasLine(el, td, 'underline'),
    strike: hasLine(el, td, 'line-through'),
    color: toHex(style.color),
    size: pxToPt(style.fontSize),
  }
}
const same = (a, b) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
  && !!a.strike === !!b.strike && (a.color || null) === (b.color || null) && (a.size || null) === (b.size || null)

// Gộp các đoạn liền nhau cùng định dạng.
export function mergeRuns(runs) {
  const out = []
  for (const run of runs) {
    if (!run.text) continue
    const last = out[out.length - 1]
    if (last && same(last, run)) last.text += run.text
    else out.push({ ...run })
  }
  return out
}

// Đoạn để lưu: màu và cỡ chữ giống ô gốc thì bỏ, để đổi phông của mẫu không làm lệch.
function compact(run, base) {
  const out = { text: run.text, bold: run.bold, italic: run.italic, underline: run.underline }
  if (run.strike) out.strike = true
  if (run.color && run.color !== base.color) out.color = run.color
  if (run.size && run.size !== base.size) out.size = run.size
  return out
}

// Tách giá trị đã lưu thành nội dung và căn lề.
export function splitValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { runs: value.runs, align: value.align || null } : { runs: value, align: null }
}

// Nội dung ô đang hiện → chuỗi nếu cả ô một kiểu chữ như ô gốc, không thì mảng đoạn.
// baseAlign: căn lề gốc của ô; đổi khác thì trả về { runs, align }.
export function readCell(td, baseAlign = '') {
  const base = formatOf(td, td)
  const runs = []
  const walk = (node) => {
    node.childNodes.forEach((child, index) => {
      if (child.nodeType === 3) runs.push({ text: child.nodeValue.replace(/\u00a0/g, ' '), ...formatOf(child.parentElement, td) })
      else if (child.nodeName === 'BR') runs.push({ text: '\n', ...formatOf(child.parentElement, td) })
      else if (child.nodeType === 1) {
        // Trình duyệt bọc dòng mới trong <div>.
        if (child.nodeName === 'DIV' && (index > 0 || runs.length)) runs.push({ text: '\n', ...formatOf(child, td) })
        walk(child)
      }
    })
  }
  walk(td)
  const merged = mergeRuns(runs)
  if (merged.length && merged[merged.length - 1].text.endsWith('\n')) merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\n$/, '')
  const clean = merged.filter((run) => run.text)
  const text = clean.map((run) => run.text).join('')
  const content = clean.every((run) => same(run, base)) ? text : clean.map((run) => compact(run, base))
  const align = td.style.textAlign || ''
  return ALIGNS.includes(align) && align !== baseAlign ? { runs: content, align } : content
}

// Vẽ một giá trị sửa tay vào ô. baseAlign: căn lề gốc, dùng khi giá trị không đổi căn lề.
export function writeCell(td, value, baseAlign = '') {
  const { runs, align } = splitValue(value)
  td.style.textAlign = align || baseAlign
  if (typeof runs === 'string') { td.textContent = runs; return }
  td.textContent = ''
  for (const run of runs) {
    const span = td.ownerDocument.createElement('span')
    span.style.fontWeight = run.bold ? '700' : '400'
    span.style.fontStyle = run.italic ? 'italic' : 'normal'
    const lines = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean)
    if (lines.length) span.style.textDecoration = lines.join(' ')
    if (run.color) span.style.color = run.color
    if (run.size) span.style.fontSize = `${run.size}pt`
    span.textContent = run.text
    td.appendChild(span)
  }
}
