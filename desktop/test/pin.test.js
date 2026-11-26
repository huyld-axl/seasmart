// Mã PIN theo máy: đổi PIN cần đúng mã hiện tại; sai cùng đếm với mở khoá, sai 5 lần thì xoá PIN.
require('./fake-electron')
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const electron = require('electron')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcah-pin-'))
electron.app.getPath = () => dir
// Két giả: "mã hoá" giữ nguyên nội dung, đủ để thử logic.
electron.safeStorage = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: (s) => Buffer.from(s),
  decryptString: (b) => b.toString(),
}
const pin = require('../src/pin')

test.after(() => fs.rmSync(dir, { recursive: true, force: true }))

test('đổi PIN: sai mã hiện tại thì báo số lần còn lại, đúng thì mã mới dùng được', () => {
  pin.setPin('123456')
  assert.deepStrictEqual(pin.changePin('000000', '654321'), { ok: false, left: 4 })
  assert.deepStrictEqual(pin.changePin('123456', '654321'), { ok: true })
  assert.strictEqual(pin.unlock('123456').ok, false)
  assert.strictEqual(pin.unlock('654321').ok, true)
})

test('đổi PIN: mã mới phải đúng 6 chữ số, máy chưa có PIN thì không đổi được', () => {
  pin.setPin('111111')
  assert.throws(() => pin.changePin('111111', '12ab56'), /6 chữ số/)
  pin.clear()
  assert.throws(() => pin.changePin('111111', '222222'), /chưa có mã PIN/)
})

test('đổi PIN: sai đủ 5 lần thì xoá PIN (người dùng phải đăng nhập lại)', () => {
  pin.setPin('123456')
  let result
  for (let i = 0; i < 5; i++) result = pin.changePin('999999', '222222')
  assert.deepStrictEqual(result, { ok: false, left: 0, exhausted: true })
  assert.strictEqual(pin.hasPin(), false)
})
