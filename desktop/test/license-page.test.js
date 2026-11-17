const test = require('node:test')
const assert = require('node:assert')
const { buildLicensePage, readLegal } = require('../scripts/license-page')

test('trang điều khoản bộ cài lấy đủ hai trang pháp lý trên web', () => {
  const html = buildLicensePage({ webOrigin: 'https://example.vn' })
  for (const file of ['terms.html', 'privacy.html']) {
    const p = readLegal(file)
    assert.ok(html.includes(`<h1>${p.title}</h1>`), `thiếu tiêu đề ${file}`)
    assert.ok(html.includes(p.body), `thiếu nội dung ${file}`)
  }
  assert.ok(html.includes('https://example.vn/legal/terms'))
  assert.ok(html.includes('https://example.vn/legal/privacy'))
  // Trình duyệt nhúng của bộ cài là IE: không script, không biến CSS.
  assert.ok(!/<script/i.test(html))
  assert.ok(!html.includes('var(--'))
})
