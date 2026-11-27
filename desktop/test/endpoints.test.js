const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')

// Thay settings (lưu trong bộ nhớ) và paths (tệp gói lúc build) để chạy ngoài Electron.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'))
fs.writeFileSync(path.join(dir, 'cloud-url.txt'), 'https://mcah.axalize.vn/account')
fs.writeFileSync(path.join(dir, 'update-url.txt'), 'https://mcah.axalize.vn/download/files')
let saved = {}
const load = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === './settings') return { getSettings: () => ({ endpoints: saved.endpoints || null }), saveSettings: (s) => { saved = { ...saved, ...s } } }
  if (request === './paths') return { cloudUrlFile: path.join(dir, 'cloud-url.txt'), updateUrlFile: path.join(dir, 'update-url.txt') }
  return load.call(this, request, parent, ...rest)
}
for (const k of ['CATORO_CLOUD_URL', 'CATORO_UPDATE_URL', 'MCAH_CLOUD_URL', 'MCAH_UPDATE_URL']) delete process.env[k]
const endpoints = require('../src/endpoints')

test('địa chỉ: mặc định theo bộ cài, học địa chỉ mới từ bản tin, từ chối địa chỉ không https', () => {
  assert.strictEqual(endpoints.cloudUrl(), 'https://mcah.axalize.vn/account')
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://mcah.axalize.vn/account', update_url: 'https://mcah.axalize.vn/download/files' }), false)
  assert.strictEqual(endpoints.learn({ cloud_url: 'http://lạ.vn/x', update_url: 'https://moi.vn/d' }), false)
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://moi.vn/account/', update_url: 'https://moi.vn/download/files' }), true)
  assert.strictEqual(endpoints.cloudUrl(), 'https://moi.vn/account')
  assert.strictEqual(endpoints.updateUrl(), 'https://moi.vn/download/files')
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://moi.vn/account', update_url: 'https://moi.vn/download/files' }), false)
  process.env.CATORO_CLOUD_URL = 'http://127.0.0.1:4100'
  assert.strictEqual(endpoints.cloudUrl(), 'http://127.0.0.1:4100')
  delete process.env.CATORO_CLOUD_URL
  // Tên cũ trước khi đổi MCAH → Catoro vẫn nhận; tên mới thắng khi đặt cả hai.
  process.env.MCAH_CLOUD_URL = 'http://127.0.0.1:4101'
  assert.strictEqual(endpoints.cloudUrl(), 'http://127.0.0.1:4101')
  process.env.CATORO_CLOUD_URL = 'http://127.0.0.1:4102'
  assert.strictEqual(endpoints.cloudUrl(), 'http://127.0.0.1:4102')
  delete process.env.CATORO_CLOUD_URL
  delete process.env.MCAH_CLOUD_URL
  fs.rmSync(dir, { recursive: true, force: true })
})
