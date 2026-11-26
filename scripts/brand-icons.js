// Sinh mọi icon / logo của Catoro từ một tệp nguồn: docs/branding/catoro-mark.svg (docs/catoro-ke-hoach-doi-ten.md 3.1).
// Chạy tay ở thư mục gốc repo: `node scripts/brand-icons.js`. Có logo thật thì chỉ thay tệp nguồn rồi chạy lại.
// Dùng sharp sẵn có của backend/ (không thêm thư viện). Tệp không đổi nội dung thì không ghi lại.
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = path.join(__dirname, '..')
const sharp = createRequire(path.join(ROOT, 'backend', 'package.json'))('sharp')

const SOURCE = path.join(ROOT, 'docs', 'branding', 'catoro-mark.svg')
const TILE = '#003366'
const INK = '#ffffff'

// Dấu nguồn: viewBox 24, một màu currentColor. Lấy thuộc tính trình bày ở thẻ <svg> và các hình bên trong (bỏ comment).
function readMark() {
  const svg = fs.readFileSync(SOURCE, 'utf8')
  const open = /<svg\b([^>]*)>/.exec(svg)
  if (!open || !/viewBox="0 0 24 24"/.test(open[1])) throw new Error(`${SOURCE}: cần thẻ <svg viewBox="0 0 24 24">`)
  const attrs = {}
  for (const [, k, v] of open[1].matchAll(/([A-Za-z-]+)="([^"]*)"/g)) if (!['xmlns', 'viewBox'].includes(k)) attrs[k] = v
  const inner = svg.slice(open.index + open[0].length, svg.lastIndexOf('</svg>')).replace(/<!--[\s\S]*?-->/g, '').trim()
  return { attrs, inner }
}

const attrText = (attrs) => Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')
const inked = (text) => text.replace(/currentColor/g, INK)

// Ô bo góc (favicon, logo splash), cùng bố cục với logo cũ: ô 32, dấu 24 lùi vào 4.
const tileSvg = ({ attrs, inner }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${TILE}"/>` +
  `<g transform="translate(4 4)"${inked(attrText(attrs))}>${inked(inner.replace(/\s*\n\s*/g, ''))}</g></svg>\n`

// Ô vuông tràn viền cho PNG / ICO. pad: lề quanh khung 24 (8 cho maskable để dấu nằm trong vùng an toàn).
const squareSvg = ({ attrs, inner }, size, pad = 4) => {
  const box = 24 + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${box} ${box}">` +
    `<rect x="${-pad}" y="${-pad}" width="${box}" height="${box}" fill="${TILE}"/><g${inked(attrText(attrs))}>${inked(inner)}</g></svg>`
}

const png = (svg) => sharp(Buffer.from(svg)).flatten({ background: TILE }).png({ compressionLevel: 9 }).toBuffer()

// ICO chứa các ảnh PNG (Windows Vista trở lên đọc được), cùng các cỡ bộ cài cũ đã dùng.
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, at)
    head.writeUInt8(size >= 256 ? 0 : size, at + 1)
    head.writeUInt16LE(1, at + 4)
    head.writeUInt16LE(32, at + 6)
    head.writeUInt32LE(data.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map((i) => i.data)])
}

// Component React của dấu: cùng hình, thuộc tính đổi sang kiểu JSX.
const jsx = (text) => text.replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, k) => ` ${k.replace(/-([a-z])/g, (__, c) => c.toUpperCase())}=`)
const productMark = ({ attrs, inner }) => `// Dấu sản phẩm. TỆP SINH TỰ ĐỘNG bởi scripts/brand-icons.js từ docs/branding/catoro-mark.svg: đừng sửa tay.
// Một màu currentColor, viewBox 24, vẽ trong vùng 4–20.
export default function ProductMark(props) {
  return (
    <svg viewBox="0 0 24 24"${jsx(attrText(attrs))} aria-hidden="true" {...props}>
${inner.split('\n').map((l) => `      ${jsx(l.trim())}`).join('\n')}
    </svg>
  )
}
`

// Dấu cho trang HTML của máy chủ dịch vụ (cloud/ đóng gói riêng, không đọc được tệp của frontend/).
const cloudMark = ({ attrs, inner }) => `// Dấu sản phẩm cho trang của máy chủ dịch vụ. TỆP SINH TỰ ĐỘNG bởi scripts/brand-icons.js từ docs/branding/catoro-mark.svg: đừng sửa tay.
module.exports = ${JSON.stringify(`<svg viewBox="0 0 24 24"${attrText(attrs)} aria-hidden="true">${inner.replace(/\s*\n\s*/g, '')}</svg>`)}
`

const written = []
function write(rel, data) {
  const file = path.join(ROOT, rel)
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, buf)
  written.push(rel)
}

async function main() {
  const mark = readMark()
  write('frontend/src/components/common/ProductMark.jsx', productMark(mark))
  write('frontend/public/favicon.svg', tileSvg(mark))
  write('desktop/src/pages/logo.svg', tileSvg(mark))
  write('cloud/src/views/brand_mark.js', cloudMark(mark))

  write('frontend/public/icons-app/icon-192.png', await png(squareSvg(mark, 192)))
  write('frontend/public/icons-app/icon-512.png', await png(squareSvg(mark, 512)))
  write('frontend/public/icons-app/icon-maskable-512.png', await png(squareSvg(mark, 512, 8)))
  write('frontend/public/icons-app/apple-touch-icon.png', await png(squareSvg(mark, 180)))
  write('desktop/build/icon.png', await png(squareSvg(mark, 512)))
  write('desktop/build/icon.ico', ico(await Promise.all([16, 32, 48, 64, 128, 256].map(async (size) => ({ size, data: await png(squareSvg(mark, size)) })))))
  write('docs/branding/catoro-logo-120.png', await png(squareSvg(mark, 120)))
  write('docs/branding/catoro-logo-512.png', await png(squareSvg(mark, 512)))

  console.log(written.length ? `Đã ghi ${written.length} tệp:\n  ${written.join('\n  ')}` : 'Không có tệp nào đổi.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
