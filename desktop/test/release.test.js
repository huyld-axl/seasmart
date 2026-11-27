const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { plan } = require('../scripts/release')

// Thư mục giả: desktop/ (package.json, dist/installer, release-notes) + backend/migrations.
function setup(opts = {}) {
  const { win = true, linux = true, mac = true, notes = true, winCommit = 'abc', macCommit = 'abc', dirty = false } = opts
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'))
  const d = path.join(root, 'desktop')
  fs.mkdirSync(path.join(d, 'dist/installer'), { recursive: true })
  fs.mkdirSync(path.join(root, 'backend/migrations/postgres'), { recursive: true })
  fs.writeFileSync(path.join(root, 'backend/migrations/postgres/048_x.sql'), '')
  fs.writeFileSync(path.join(d, 'endpoints.json'), JSON.stringify({ cloud_url: 'https://a.vn/account', update_url: 'https://a.vn/download/files' }))
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: 'catoro-desktop', version: '1.2.0', build: { productName: 'Catoro', directories: { output: 'dist/installer' } } }))
  const put = (platform, name, commit) => {
    fs.writeFileSync(path.join(d, 'dist/installer', name), 'x')
    fs.writeFileSync(path.join(d, 'dist/installer', `build-info-${platform}.json`), JSON.stringify({ version: '1.2.0', commit, scan: 'clean', dirty, cloud_url: platform === 'win' && opts.wrongUrl ? 'http://localhost:4100' : 'https://a.vn/account', update_url: 'https://a.vn/download/files', cloud_key: platform === 'win' && opts.wrongKey ? 'dev' : 'prod' }))
  }
  if (linux) put('linux', 'catoro-desktop_1.2.0_amd64.deb', 'abc')
  if (win) put('win', 'Catoro Setup 1.2.0.exe', winCommit)
  if (mac) {
    put('mac-arm64', 'Catoro-1.2.0-arm64.dmg', macCommit)
    put('mac-x64', 'Catoro-1.2.0-x64.dmg', macCommit)
  }
  if (notes) {
    fs.mkdirSync(path.join(d, 'release-notes'))
    fs.writeFileSync(path.join(d, 'release-notes/1.2.0.md'), '- Sửa lỗi')
  }
  return { root, d }
}

test('phát hành: đủ bốn bản cùng commit, có ghi chú thì không chặn', () => {
  const { root, d } = setup()
  const p = plan({ desktop: d })
  assert.deepStrictEqual(p.problems, [])
  assert.deepStrictEqual(Object.keys(p.files), ['linux', 'win', 'mac-arm64', 'mac-x64'])
  assert.strictEqual(p.lastMigration, '048_x.sql')
  fs.rmSync(root, { recursive: true })
})

test('phát hành: chặn khi thiếu Ubuntu, khác commit, thiếu ghi chú, còn thay đổi chưa commit', () => {
  for (const [opts, want] of [[{ linux: false }, /Thiếu bộ cài Ubuntu/], [{ winCommit: 'zzz' }, /khác commit/], [{ macCommit: 'zzz' }, /khác commit/], [{ mac: false }, /Thiếu bộ cài macOS chip Apple/], [{ notes: false }, /ghi chú/], [{ dirty: true }, /chưa commit/], [{ wrongUrl: true }, /khác endpoints\.json/]]) {
    const { root, d } = setup(opts)
    const p = plan({ desktop: d })
    assert.ok(p.problems.some((x) => want.test(x)), `${JSON.stringify(opts)}: ${p.problems}`)
    fs.rmSync(root, { recursive: true })
  }
})

test('phát hành: --allow-missing win,mac cho phát một mình bản Ubuntu, vẫn chặn khi chẳng có bản nào', () => {
  let { root, d } = setup({ win: false, mac: false })
  assert.ok(plan({ desktop: d }).problems.some((x) => /Thiếu bộ cài Windows/.test(x)))
  assert.ok(plan({ desktop: d, allowMissing: ['win'] }).problems.some((x) => /Thiếu bộ cài macOS chip Intel/.test(x)))
  const p = plan({ desktop: d, allowMissing: ['win', 'mac'] })
  assert.deepStrictEqual(p.problems, [])
  assert.deepStrictEqual(Object.keys(p.files), ['linux'])
  assert.strictEqual(p.commit, 'abc')
  fs.rmSync(root, { recursive: true })
  ;({ root, d } = setup({ win: false, linux: false, mac: false }))
  assert.ok(plan({ desktop: d, allowMissing: ['win', 'linux', 'mac'] }).problems.includes('Không có bộ cài nào'))
  fs.rmSync(root, { recursive: true })
})

test('phát hành: chặn khi bộ cài gói khoá đăng nhập khác khoá máy chủ thật', () => {
  const { root, d } = setup({ wrongKey: true })
  assert.deepStrictEqual(plan({ desktop: d, cloudKey: 'prod' }).problems.map((x) => /khoá đăng nhập/.test(x) && x.slice(0, 7)), ['Bản win'])
  fs.rmSync(root, { recursive: true })
})

test('dấu vân tay khoá: không phụ thuộc thứ tự, PEM lạ thì báo lỗi', () => {
  const { fingerprint } = require('../scripts/cloud-key')
  const pem = () => require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })
  const a = pem(), b = pem()
  assert.strictEqual(fingerprint(a + b), fingerprint(b + a))
  assert.notStrictEqual(fingerprint(a), fingerprint(b))
  assert.throws(() => fingerprint('x'))
})

test('releases.json: liệt kê các bản còn giữ, mới nhất trước, gồm tên bộ cài cũ và bản macOS', () => {
  const { writeReleases } = require('../scripts/release')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-list-'))
  for (const name of ['mcah-desktop_0.9.9_amd64.deb', 'MCAH Setup 0.9.9.exe', 'catoro-desktop_0.9.15_amd64.deb', 'Catoro Setup 0.9.15.exe', 'Catoro-0.9.15-arm64.dmg', 'Catoro-0.9.15-x64.dmg', 'latest.json']) fs.writeFileSync(path.join(dir, name), name)
  writeReleases(dir, { version: '0.9.15', channel: 'beta', released_at: '2026-11-27T03:00:00.000Z' })
  const { channel, releases } = JSON.parse(fs.readFileSync(path.join(dir, 'releases.json'), 'utf8'))
  assert.strictEqual(channel, 'beta')
  assert.deepStrictEqual(releases.map((r) => r.version), ['0.9.15', '0.9.9'])
  assert.deepStrictEqual(Object.keys(releases[0].files).sort(), ['linux', 'mac-arm64', 'mac-x64', 'win'])
  assert.strictEqual(releases[0].released_at, '2026-11-27T03:00:00.000Z')
  assert.strictEqual(releases[1].files.win.name, 'MCAH Setup 0.9.9.exe')
  assert.match(releases[1].files.linux.sha256, /^[0-9a-f]{64}$/)
  // Lần phát sau: ngày phát của bản cũ giữ nguyên.
  const oldDate = releases[1].released_at
  writeReleases(dir, { version: '0.9.15', channel: 'beta', released_at: '2026-11-28T00:00:00.000Z' })
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'releases.json'), 'utf8')).releases[1].released_at, oldDate)
  fs.rmSync(dir, { recursive: true })
})
