// Sinh phần danh sách bản của trang ghi chú phát hành (frontend/public/phat-hanh/index.html) từ desktop/release-notes/*.md.
//   npm run notes:page            ghi lại trang
//   npm run notes:page -- --check báo lỗi nếu trang chưa khớp ghi chú (test chạy kiểm này)
// Chỉ thay phần giữa các dấu <!-- MỤC LỤC: tự sinh --> và <!-- BẢN PHÁT HÀNH: tự sinh -->; còn lại của trang sửa tay.
const fs = require('fs')
const path = require('path')

const NOTES = path.join(__dirname, '../release-notes')
const PAGE = path.join(__dirname, '../../frontend/public/phat-hanh/index.html')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const byVersionDesc = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
  return 0
}

function versions(dir = NOTES) {
  return fs.readdirSync(dir)
    .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f))
    .map((f) => {
      const items = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean)
      return { version: f.slice(0, -3), items }
    })
    .sort((a, b) => byVersionDesc(a.version, b.version))
}

function replaceBlock(html, name, lines) {
  const start = `<!-- ${name}: tự sinh -->`
  const end = `<!-- /${name} -->`
  const i = html.indexOf(start)
  const j = html.indexOf(end)
  if (i < 0 || j < i) throw new Error(`Trang thiếu dấu ${start} … ${end}`)
  const indent = html.slice(html.lastIndexOf('\n', i) + 1, i)
  return html.slice(0, i + start.length) + '\n' + lines.map((l) => indent + l).join('\n') + '\n' + indent + html.slice(j)
}

function render(html, list) {
  const toc = list.map(({ version }) => `<a href="#v${version}">Bản ${version}</a>`)
  const body = list.flatMap(({ version, items }, i) => [
    `<section id="v${version}">`,
    `  <h2>Bản ${version}${i === 0 ? ' <span class="ver">Mới nhất</span>' : ''}</h2>`,
    '  <ul>',
    ...items.map((t) => `    <li>${esc(t)}</li>`),
    '  </ul>',
    '</section>',
  ])
  return replaceBlock(replaceBlock(html, 'MỤC LỤC', toc), 'BẢN PHÁT HÀNH', body)
}

if (require.main === module) {
  const html = fs.readFileSync(PAGE, 'utf8')
  const next = render(html, versions())
  if (process.argv.includes('--check')) {
    if (next !== html) {
      console.error('Trang ghi chú phát hành chưa khớp desktop/release-notes. Chạy: npm run notes:page')
      process.exitCode = 1
    }
  } else {
    fs.writeFileSync(PAGE, next)
    console.log(`Đã ghi ${path.relative(process.cwd(), PAGE)}`)
  }
}

module.exports = { versions, render, PAGE }
