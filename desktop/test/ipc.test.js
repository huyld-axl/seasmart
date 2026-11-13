// Kiểm dữ liệu vào của các kênh giao diện gọi app (ipc.js) và xoay vòng nhật ký (logs.js).
require('./fake-electron')
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { checkMail, checkSettings } = require('../src/ipc')
const { rotatingLog } = require('../src/logs')

test('thư hợp lệ đi qua', () => {
  const m = checkMail({ to: ['a@b.vn'], cc: [], subject: 'Hồ sơ', body: 'x', files: ['Nguyễn Văn An.zip'] })
  assert.deepStrictEqual(m.files, ['Nguyễn Văn An.zip'])
  assert.deepStrictEqual(m.bcc, [])
})

test('tệp đính kèm chỉ nhận tên, không nhận đường dẫn', () => {
  for (const bad of ['../../etc/passwd', '/home/x/.ssh/id_rsa', 'a/b.zip', 'C:\\Windows\\x.dll']) {
    assert.throws(() => checkMail({ to: ['a@b.vn'], files: [bad] }), /Tệp đính kèm không hợp lệ/, bad)
  }
})

test('người nhận sai bị từ chối', () => {
  assert.throws(() => checkMail({ to: ['khong-phai-email'] }), /Người nhận/)
  assert.throws(() => checkMail({ to: ['a@b.vn'], cc: 'a@b.vn' }), /CC/)
})

test('cài đặt: chỉ nhận giá trị đã định', () => {
  assert.deepStrictEqual(checkSettings({ mailMode: 'app' }), { mailMode: 'app' })
  assert.throws(() => checkSettings({ mailMode: 'fax' }), /Cách gửi email/)
  assert.throws(() => checkSettings({ smtp: { provider: 'gmail', user: 'x' } }), /Email gửi/)
  assert.throws(() => checkSettings({ smtp: { provider: 'other', user: 'a@b.vn', host: 'h', port: 99999 } }), /Cổng/)
})

test('nhật ký xoay vòng khi quá cỡ, giữ 2 tệp cũ', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcah-log-'))
  const file = path.join(dir, 'backend.log')
  const log = rotatingLog(file, { maxBytes: 100, keep: 2 })
  for (let i = 0; i < 10; i++) log.write('x'.repeat(60) + '\n')
  log.close()
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['backend.log', 'backend.log.1', 'backend.log.2'])
  assert.ok(fs.statSync(file).size <= 100)
  fs.rmSync(dir, { recursive: true })
})
