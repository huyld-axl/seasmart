// Trang "Điều khoản và quyền riêng tư" hiện ở bước đồng ý của bộ cài Windows (nsis.license trong package.json).
// Lấy nội dung từ trang pháp lý trên web (frontend/public/legal/terms.html, privacy.html) để bộ cài luôn khớp bản web.
// Bộ cài hiện HTML bằng trình duyệt nhúng kiểu cũ (IE) nên trang ra chỉ dùng CSS đơn giản, không script.
//   node scripts/license-page.js   -> dist/license/license.html
const fs = require('fs')
const path = require('path')

const DESKTOP = path.join(__dirname, '..')
const LEGAL = path.join(DESKTOP, '../frontend/public/legal')
const OUT = path.join(DESKTOP, 'dist/license/license.html')

// Một trang pháp lý -> { title, updated, body }. Thiếu phần nào thì báo lỗi, không ra trang thiếu nội dung.
function readLegal(file) {
  // Chỉ tìm trong <body>: chú thích CSS ở <head> có nhắc chữ <article>.
  const full = fs.readFileSync(path.join(LEGAL, file), 'utf8')
  const start = full.indexOf('<body')
  if (start < 0) throw new Error(`${file}: không có <body>`)
  const html = full.slice(start)
  const pick = (re, what) => {
    const m = html.match(re)
    if (!m) throw new Error(`${file}: không tìm thấy ${what}`)
    return m[1].trim()
  }
  return {
    title: pick(/<h1>([\s\S]*?)<\/h1>/, '<h1>'),
    updated: pick(/<p class="muted">(Cập nhật lần cuối:[\s\S]*?)<\/p>/, 'dòng "Cập nhật lần cuối"'),
    body: pick(/<article>([\s\S]*?)<\/article>/, '<article>').replace(/<!--[\s\S]*?-->/g, '').trim(),
  }
}

function buildLicensePage({ webOrigin }) {
  const parts = [
    { ...readLegal('terms.html'), url: `${webOrigin}/legal/terms` },
    { ...readLegal('privacy.html'), url: `${webOrigin}/legal/privacy` },
  ]
  const sections = parts.map((p) => `<h1>${p.title}</h1>
<p class="muted">${p.updated}. Bản trên web: <a href="${p.url}" target="_blank">${p.url}</a></p>
<div class="doc">
${p.body}
</div>`).join('\n<hr>\n')
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Catoro - Điều khoản và quyền riêng tư</title>
<style>
  body { margin: 0; padding: 12px 16px; background: #ffffff; color: #2c2c2c; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 13px; line-height: 1.6; }
  h1 { margin: 8px 0 4px; font-size: 16px; color: #003366; }
  p { margin: 0 0 8px; }
  .muted { color: #707070; font-size: 12px; }
  .doc { margin-bottom: 12px; }
  a { color: #003366; }
  hr { border: 0; border-top: 1px solid #e5e6ea; margin: 16px 0; }
</style>
</head>
<body>
<p>Vui lòng đọc Điều khoản sử dụng và Chính sách quyền riêng tư của Catoro. Bấm đồng ý để tiếp tục cài đặt.</p>
${sections}
</body>
</html>
`
}

if (require.main === module) {
  const { cloud_url } = JSON.parse(fs.readFileSync(path.join(DESKTOP, 'endpoints.json'), 'utf8'))
  const html = buildLicensePage({ webOrigin: new URL(cloud_url).origin })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, html)
  console.log(`Trang điều khoản cho bộ cài: ${OUT}`)
}

module.exports = { buildLicensePage, readLegal }
