const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')

// Thay settings (lưu trong bộ nhớ) và paths (tệp gói lúc build) để chạy ngoài Electron.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'))
fs.writeFileSync(path.join(dir, 'cloud-url.txt'), 'https://mcah.axalize.vn/tai-khoan')
fs.writeFileSync(path.join(dir, 'update-url.txt'), 'https://mcah.axalize.vn/download/files')
let saved = {}
const load = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === './settings') return { getSettings: () => ({ endpoints: saved.endpoints || null }), saveSettings: (s) => { saved = { ...saved, ...s } } }
  if (request === './paths') return { cloudUrlFile: path.join(dir, 'cloud-url.txt'), updateUrlFile: path.join(dir, 'update-url.txt') }
  return load.call(this, request, parent, ...rest)
}
delete process.env.MCAH_CLOUD_URL
delete process.env.MCAH_UPDATE_URL
const endpoints = require('../src/endpoints')

test('địa chỉ: mặc định theo bộ cài, học địa chỉ mới từ bản tin, từ chối địa chỉ không https', () => {
  assert.strictEqual(endpoints.cloudUrl(), 'https://mcah.axalize.vn/tai-khoan')
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://mcah.axalize.vn/tai-khoan', update_url: 'https://mcah.axalize.vn/download/files' }), false)
  assert.strictEqual(endpoints.learn({ cloud_url: 'http://lạ.vn/x', update_url: 'https://moi.vn/d' }), false)
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://moi.vn/tai-khoan/', update_url: 'https://moi.vn/download/files' }), true)
  assert.strictEqual(endpoints.cloudUrl(), 'https://moi.vn/tai-khoan')
  assert.strictEqual(endpoints.updateUrl(), 'https://moi.vn/download/files')
  assert.strictEqual(endpoints.learn({ cloud_url: 'https://moi.vn/tai-khoan', update_url: 'https://moi.vn/download/files' }), false)
  process.env.MCAH_CLOUD_URL = 'http://127.0.0.1:4100'
  assert.strictEqual(endpoints.cloudUrl(), 'http://127.0.0.1:4100')
  delete process.env.MCAH_CLOUD_URL
  fs.rmSync(dir, { recursive: true, force: true })
})
