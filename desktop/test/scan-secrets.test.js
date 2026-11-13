const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const SCRIPT = path.join(__dirname, '../scripts/scan-secrets.js')
const run = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })

test('quét bí mật: bắt .map, danh mục tàu, biến khoá, chuỗi trong bytecode; thư mục sạch thì qua', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'))
  try {
    fs.writeFileSync(path.join(dir, 'ok.js'), 'console.log(1)')
    assert.strictEqual(run(dir).status, 0)
    for (const [name, text] of [['a.js.map', '{}'], ['ships_plain.db', 'x'], ['cfg.txt', 'SMS_WEBHOOK_TOKEN=abcdefgh12345'], ['server.jsc', 'xx\u0000sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX\u0000']]) {
      const file = path.join(dir, name)
      fs.writeFileSync(file, text)
      const r = run(dir)
      assert.strictEqual(r.status, 1, `${name} phải bị bắt`)
      fs.rmSync(file)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
