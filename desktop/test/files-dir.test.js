const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { defaultFilesDir, legacyFilesDirToPin } = require('../src/files-dir')

const DOCS = path.join('/home', 'a', 'Documents')
const OLD = path.join(DOCS, 'MCAH - Hồ sơ')

test('thư mục hồ sơ: máy cài mới dùng "Catoro - Hồ sơ"', () => {
  assert.strictEqual(defaultFilesDir(DOCS), path.join(DOCS, 'Catoro - Hồ sơ'))
  assert.strictEqual(legacyFilesDirToPin({ savedFilesDir: null, documentsDir: DOCS, exists: () => false }), null)
})

test('thư mục hồ sơ: máy đã dùng MCAH (chưa đặt thư mục, có "MCAH - Hồ sơ") thì ghim thư mục cũ', () => {
  assert.strictEqual(legacyFilesDirToPin({ savedFilesDir: null, documentsDir: DOCS, exists: (p) => p === OLD }), OLD)
})

test('thư mục hồ sơ: đã đặt thư mục thì không đụng, kể cả khi có thư mục cũ', () => {
  assert.strictEqual(legacyFilesDirToPin({ savedFilesDir: '/data/ho-so', documentsDir: DOCS, exists: () => true }), null)
})
