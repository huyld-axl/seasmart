// Gói báo lỗi: gom log (đã ẩn thông tin cá nhân + tên người dùng trong đường dẫn), gửi, và lưu tệp khi gửi không được.
require('./fake-electron')
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const { build, toText, sendOrSave } = require('../src/bug-report')

function setup() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mcah-report-'))
  fs.mkdirSync(path.join(userData, 'logs'))
  fs.writeFileSync(path.join(userData, 'logs', 'main.log'), 'ERROR mở C:\\Users\\Nguyen An\\AppData\\x lỗi, mail an@abc.vn\n')
  fs.writeFileSync(path.join(userData, 'db-secret'), 'KHONG-DUOC-GUI')
  return userData
}

test('chỉ gom tệp log, ẩn email và tên người dùng, không đụng khoá', () => {
  const userData = setup()
  const report = build({ userData, errorCode: 'DB_MIGRATE', errorMessage: 'lỗi tại /home/an/mcah', at: 'x', note: 'ghi chú', appVersion: '0.9.5', packaged: true })
  assert.deepStrictEqual(Object.keys(report.files), ['main.log'])
  const text = toText(report)
  assert.ok(!text.includes('KHONG-DUOC-GUI'))
  assert.ok(!text.includes('an@abc.vn'))
  assert.ok(!text.includes('Nguyen'))
  assert.ok(text.includes('C:\\Users\\[user]\\AppData'))
  assert.ok(report.meta.errorMessage.includes('/home/[user]/mcah'))
  assert.strictEqual(report.meta.errorCode, 'DB_MIGRATE')
})

test('log lớn chỉ lấy phần cuối', () => {
  const userData = setup()
  fs.writeFileSync(path.join(userData, 'logs', 'backend.log'), ('a'.repeat(99) + '\n').repeat(3000) + 'CUOI')
  const { files } = build({ userData, errorCode: 'X', appVersion: '1' })
  assert.ok(files['backend.log'].startsWith('[…cắt bớt'))
  assert.ok(files['backend.log'].endsWith('CUOI'))
  assert.ok(files['backend.log'].length < 210 * 1024)
})

test('một dòng rất dài không làm treo việc ẩn thông tin', () => {
  const userData = setup()
  fs.writeFileSync(path.join(userData, 'logs', 'backend.log'), 'a'.repeat(190 * 1024))
  const started = Date.now()
  build({ userData, errorCode: 'X', appVersion: '1' })
  assert.ok(Date.now() - started < 3000)
})

test('gửi được: thân là JSON nén gzip, trả mã báo lỗi', async () => {
  const report = build({ userData: setup(), errorCode: 'X', appVersion: '1' })
  let got
  const fetchImpl = async (url, opts) => {
    got = { url, opts }
    return { ok: true, json: async () => ({ id: 7 }) }
  }
  const out = await sendOrSave(report, { cloudUrl: 'https://c.vn', dir: os.tmpdir(), fetchImpl })
  assert.deepStrictEqual(out, { status: 'sent', id: 7 })
  assert.strictEqual(got.url, 'https://c.vn/api/bug-report')
  assert.strictEqual(JSON.parse(zlib.gunzipSync(got.opts.body)).meta.errorCode, 'X')
})

test('gửi không được (mất mạng / máy chủ lỗi): lưu tệp .txt để gửi tay', async () => {
  const report = build({ userData: setup(), errorCode: 'X', appVersion: '1' })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcah-dl-'))
  for (const fetchImpl of [async () => { throw new Error('offline') }, async () => ({ ok: false, status: 503 })]) {
    const out = await sendOrSave(report, { cloudUrl: 'https://c.vn', dir, fetchImpl })
    assert.strictEqual(out.status, 'saved')
    assert.ok(fs.readFileSync(out.path, 'utf8').includes('===== main.log ====='))
  }
})
