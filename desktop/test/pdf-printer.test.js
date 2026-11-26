// Cổng in PDF: chân trang Excel ("Page &P", "&L…&C…&R…") thành mẫu chân trang của Chromium; sai mã cổng bị từ chối.
require('./fake-electron')
const test = require('node:test')
const assert = require('node:assert')
const os = require('os')
const electron = require('electron')

electron.BrowserWindow = function () {}
electron.session = { fromPartition: () => ({ webRequest: { onBeforeRequest() {} } }) }
const { start, footerTemplate } = require('../src/pdf-printer')

test('chân trang: số trang, tổng số trang, ba phần trái giữa phải', () => {
  assert.strictEqual(footerTemplate(null), null)
  const center = footerTemplate('Page &P')
  assert.match(center, /text-align:center">Page <span class="pageNumber"><\/span><\/div>/)
  const sides = footerTemplate('&LMCAH&C&P / &N&R<b>')
  assert.match(sides, /text-align:left">MCAH</)
  assert.match(sides, /<span class="pageNumber"><\/span> \/ <span class="totalPages"><\/span>/)
  assert.match(sides, /text-align:right">&lt;b&gt;</)
})

test('sai mã cổng hoặc thân sai thì không in', async () => {
  const printer = await start({ tmpDir: os.tmpdir() })
  try {
    const bad = await fetch(`${printer.url}/pdf`, { method: 'POST', headers: { 'x-pdf-token': 'sai' }, body: '{}' })
    assert.strictEqual(bad.status, 401)
    const empty = await fetch(`${printer.url}/pdf`, { method: 'POST', headers: { 'x-pdf-token': printer.token }, body: JSON.stringify({ pages: [] }) })
    assert.strictEqual(empty.status, 400)
  } finally {
    printer.close()
  }
})
