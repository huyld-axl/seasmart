// Dựng PDF tối thiểu cho test (không phụ thuộc thư viện). Mỗi phần tử của `pages` là:
//  - chuỗi: chữ in lên một trang trắng; hoặc
//  - { jpeg: Buffer, width, height }: trang là một ảnh JPEG (giống PDF scan thật).
// `rotate` (0|90|180|270) áp cho mọi trang. Chỉ dùng trong test tự động.
function makePdf(pages, { width = 595, height = 842, rotate = 0 } = {}) {
  const objects = []
  const add = (body) => objects.push(body) // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  const pageIds = pages.map((_, i) => 4 + i * 3)
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  // Mỗi trang dùng 3 object: Page, Contents, XObject ảnh (trang chữ để object ảnh rỗng cho đơn giản).
  pages.forEach((page, i) => {
    const isImage = typeof page === 'object'
    const stream = isImage
      ? `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`
      : `BT /F1 36 Tf 60 ${height - 120} Td (${String(page).replace(/[()\\]/g, '')}) Tj ET\n0 0 0 rg 60 60 ${width - 120} 40 re f`
    add(`<< /Type /Page /Parent 2 0 R /Rotate ${rotate} /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${6 + i * 3} 0 R >> >> /Contents ${5 + i * 3} 0 R >>`)
    add({ text: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream` })
    add(isImage
      ? { binary: page.jpeg, dict: `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>` }
      : { text: '<< >>' })
  })
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')]
  let size = chunks[0].length
  const offsets = []
  const push = (data) => { const b = Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1'); chunks.push(b); size += b.length }
  objects.forEach((body, i) => {
    offsets.push(size)
    push(`${i + 1} 0 obj\n`)
    if (typeof body === 'string') push(body)
    else if (body.text) push(body.text)
    else { push(`${body.dict}\nstream\n`); push(body.binary); push('\nendstream') }
    push('\nendobj\n')
  })
  const xref = size
  let tail = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  tail += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  tail += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  push(tail)
  return Buffer.concat(chunks)
}

module.exports = { makePdf }
