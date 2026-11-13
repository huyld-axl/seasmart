const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { plan } = require('../scripts/release')

// Thư mục giả: desktop/ (package.json, dist/installer, release-notes) + backend/migrations.
function setup({ win = true, linux = true, notes = true, winCommit = 'abc', dirty = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'))
  const d = path.join(root, 'desktop')
  fs.mkdirSync(path.join(d, 'dist/installer'), { recursive: true })
  fs.mkdirSync(path.join(root, 'backend/migrations/postgres'), { recursive: true })
  fs.writeFileSync(path.join(root, 'backend/migrations/postgres/048_x.sql'), '')
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: 'mcah-desktop', version: '1.2.0', build: { productName: 'MCAH', directories: { output: 'dist/installer' } } }))
  const put = (platform, name, commit) => {
    fs.writeFileSync(path.join(d, 'dist/installer', name), 'x')
    fs.writeFileSync(path.join(d, 'dist/installer', `build-info-${platform}.json`), JSON.stringify({ version: '1.2.0', commit, scan: 'clean', dirty }))
  }
  if (linux) put('linux', 'mcah-desktop_1.2.0_amd64.deb', 'abc')
  if (win) put('win', 'MCAH Setup 1.2.0.exe', winCommit)
  if (notes) {
    fs.mkdirSync(path.join(d, 'release-notes'))
    fs.writeFileSync(path.join(d, 'release-notes/1.2.0.md'), '- Sửa lỗi')
  }
  return { root, d }
}

test('phát hành: đủ hai bản cùng commit, có ghi chú thì không chặn', () => {
  const { root, d } = setup()
  const p = plan({ desktop: d })
  assert.deepStrictEqual(p.problems, [])
  assert.deepStrictEqual(Object.keys(p.files), ['linux', 'win'])
  assert.strictEqual(p.lastMigration, '048_x.sql')
  fs.rmSync(root, { recursive: true })
})

test('phát hành: chặn khi thiếu Ubuntu, khác commit, thiếu ghi chú, còn thay đổi chưa commit', () => {
  for (const [opts, want] of [[{ linux: false }, /Thiếu bộ cài Ubuntu/], [{ winCommit: 'zzz' }, /khác commit/], [{ notes: false }, /ghi chú/], [{ dirty: true }, /chưa commit/]]) {
    const { root, d } = setup(opts)
    const p = plan({ desktop: d })
    assert.ok(p.problems.some((x) => want.test(x)), `${JSON.stringify(opts)}: ${p.problems}`)
    fs.rmSync(root, { recursive: true })
  }
})
