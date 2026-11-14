const test = require('node:test')
const assert = require('node:assert')
const { scrub } = require('../src/logs')

test('log: ẩn email, số điện thoại, số giấy tờ, tên trong đường dẫn hồ sơ', () => {
  const out = scrub('gửi an@abc.vn 0912345678 hộ chiếu C1234567 CCCD 079123456789 tệp Thuyền viên/NGUYỄN VĂN AN - TV1/x.pdf port 7443 reqId req-12 time 1794469617491')
  assert.ok(!/an@abc|0912345678|C1234567|079123456789|NGUYỄN/.test(out), out)
  assert.ok(out.includes('port 7443') && out.includes('req-12'), out)
})
