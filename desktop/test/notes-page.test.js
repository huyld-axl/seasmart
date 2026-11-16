const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { versions, render, PAGE } = require('../scripts/notes-page')

test('trang ghi chú phát hành khớp desktop/release-notes (chạy npm run notes:page nếu lệch)', () => {
  const html = fs.readFileSync(PAGE, 'utf8')
  assert.strictEqual(render(html, versions()), html)
})

test('bản mới nhất lên đầu, so số chứ không so chữ, thoát ký tự HTML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'))
  fs.writeFileSync(path.join(dir, '0.9.2.md'), '- Cũ')
  fs.writeFileSync(path.join(dir, '0.10.0.md'), '- Mới <b>\n\n* Thêm')
  fs.writeFileSync(path.join(dir, 'README.md'), 'bỏ qua')
  const list = versions(dir)
  assert.deepStrictEqual(list.map((v) => v.version), ['0.10.0', '0.9.2'])
  const html = render('<nav>\n  <!-- MỤC LỤC: tự sinh -->\n  <!-- /MỤC LỤC -->\n</nav>\n<!-- BẢN PHÁT HÀNH: tự sinh -->\n<!-- /BẢN PHÁT HÀNH -->', list)
  assert.match(html, /<a href="#v0\.10\.0">Bản 0\.10\.0<\/a>\n {2}<a href="#v0\.9\.2">/)
  assert.match(html, /Bản 0\.10\.0 <span class="ver">Mới nhất<\/span>/)
  assert.match(html, /<li>Mới &lt;b&gt;<\/li>\n {4}<li>Thêm<\/li>/)
})
